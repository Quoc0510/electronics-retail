/**
 * @feature [F13] Điểm thành viên - Kiểm thử phần tính lại dữ liệu của migration `20261029010000_points_cumulative`
 * (đổi BR-15 sang điểm cộng dồn 1.000.000 đ = 1 điểm). Chạy đúng các câu UPDATE của file migration trên dữ liệu "cũ" giả lập.
 */
import fs from 'node:fs';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Lấy phần tính lại dữ liệu của file migration (bỏ phần ALTER TABLE vì cột đã được tạo sẵn trong DB test)
const backfillStatements = () => {
  const sql = fs.readFileSync(
    new URL('../prisma/migrations/20261029010000_points_cumulative/migration.sql', import.meta.url),
    'utf8',
  );
  return sql
    .slice(sql.indexOf('WITH completed'))
    .split(/;\s*\n/)
    .map((statement) =>
      statement
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
};

const runBackfill = async () => {
  for (const statement of backfillStatements()) await prisma.$executeRawUnsafe(statement);
};

let seq = 0;
const makeOrder = async ({
  userId,
  subtotal,
  status = 'COMPLETED',
  completedAt,
  pointsEarned = 0,
}) => {
  seq += 1;
  return prisma.order.create({
    data: {
      code: `TS261029-M${String(seq).padStart(3, '0')}`,
      userId,
      status,
      subtotal,
      shippingFee: 30000,
      total: subtotal + 30000,
      recipientName: 'Người nhận',
      phone: '0900000000',
      shippingAddress: '1 Đường A',
      pointsEarned,
      history: completedAt
        ? { create: [{ status: 'COMPLETED', createdAt: completedAt }] }
        : undefined,
    },
  });
};

const pointsOf = async (order) =>
  (await prisma.order.findUnique({ where: { id: order.id } })).pointsEarned;
const statsOf = async (user) => {
  const { points, totalSpent } = await prisma.user.findUnique({ where: { id: user.id } });
  return { points, totalSpent };
};

describe('Tính lại điểm theo quy tắc cộng dồn', () => {
  it('điểm của từng đơn theo thứ tự hoàn thành (không theo thứ tự tạo), điểm người dùng = tổng đã mua / 1 triệu', async () => {
    const user = await createUser({ email: 'a@example.com' });
    // Tạo đơn lớn trước nhưng hoàn thành sau cùng
    const big = await makeOrder({
      userId: user.id,
      subtotal: 3_200_000,
      completedAt: new Date('2026-10-03T00:00:00Z'),
      pointsEarned: 320,
    });
    const first = await makeOrder({
      userId: user.id,
      subtotal: 600_000,
      completedAt: new Date('2026-10-01T00:00:00Z'),
      pointsEarned: 60,
    });
    const second = await makeOrder({
      userId: user.id,
      subtotal: 600_000,
      completedAt: new Date('2026-10-02T00:00:00Z'),
      pointsEarned: 60,
    });
    await prisma.user.update({ where: { id: user.id }, data: { points: 440 } }); // điểm theo quy tắc cũ (10.000 đ = 1 điểm)

    await runBackfill();

    expect(await pointsOf(first)).toBe(0); // 600k
    expect(await pointsOf(second)).toBe(1); // 1,2tr
    expect(await pointsOf(big)).toBe(3); // 4,4tr: từ 1 lên 4
    expect(await statsOf(user)).toEqual({ points: 4, totalSpent: 4_400_000 });
  });

  it('đơn chưa hoàn thành, đã hủy hoặc của khách vãng lai không có điểm đã cộng; người chưa mua gì về 0 điểm', async () => {
    const buyer = await createUser({ email: 'b@example.com' });
    const idle = await createUser({ email: 'c@example.com' });
    const pending = await makeOrder({
      userId: buyer.id,
      subtotal: 5_000_000,
      status: 'PENDING',
      pointsEarned: 3,
    });
    const cancelled = await makeOrder({
      userId: buyer.id,
      subtotal: 5_000_000,
      status: 'CANCELLED',
      pointsEarned: 3,
    });
    const guest = await makeOrder({
      userId: null,
      subtotal: 5_000_000,
      completedAt: new Date(),
      pointsEarned: 7,
    });
    await prisma.user.update({ where: { id: buyer.id }, data: { points: 12 } });
    await prisma.user.update({ where: { id: idle.id }, data: { points: 5 } });

    await runBackfill();

    expect(await pointsOf(pending)).toBe(0);
    expect(await pointsOf(cancelled)).toBe(0);
    expect(await pointsOf(guest)).toBe(0);
    expect(await statsOf(buyer)).toEqual({ points: 0, totalSpent: 0 });
    expect(await statsOf(idle)).toEqual({ points: 0, totalSpent: 0 });
  });

  it('đơn hoàn thành thiếu dòng lịch sử vẫn được tính (xếp theo thời điểm cập nhật)', async () => {
    const user = await createUser({ email: 'd@example.com' });
    const order = await makeOrder({ userId: user.id, subtotal: 2_500_000, pointsEarned: 250 });

    await runBackfill();

    expect(await pointsOf(order)).toBe(2);
    expect(await statsOf(user)).toEqual({ points: 2, totalSpent: 2_500_000 });
  });

  it('chạy lại lần nữa cho cùng kết quả (idempotent), mỗi người tính riêng', async () => {
    const one = await createUser({ email: 'e@example.com' });
    const two = await createUser({ email: 'f@example.com' });
    await makeOrder({
      userId: one.id,
      subtotal: 1_500_000,
      completedAt: new Date('2026-10-01T00:00:00Z'),
    });
    await makeOrder({
      userId: two.id,
      subtotal: 900_000,
      completedAt: new Date('2026-10-01T00:00:00Z'),
    });

    await runBackfill();
    await runBackfill();

    expect(await statsOf(one)).toEqual({ points: 1, totalSpent: 1_500_000 });
    expect(await statsOf(two)).toEqual({ points: 0, totalSpent: 900_000 });
  });

  it('DB từ chối tổng đã mua âm (CHECK)', async () => {
    const user = await createUser({ email: 'g@example.com' });

    await expect(
      prisma.user.update({ where: { id: user.id }, data: { totalSpent: -1 } }),
    ).rejects.toThrow();
  });
});
