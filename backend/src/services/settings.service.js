/**
 * @feature [F16] Cài đặt cửa hàng - Đọc/ghi các cài đặt do Admin chỉnh ở trang Cài đặt (hiện có: ngưỡng miễn phí vận chuyển).
 * Mỗi cài đặt là một dòng khóa/giá trị trong bảng app_settings. Chưa có dòng thì dùng giá trị mặc định từ biến môi trường
 * (SHIPPING_FREE_THRESHOLD), nên hệ thống chạy đúng ngay cả khi chưa ai vào trang Cài đặt. Đặt lại về mặc định = xóa dòng.
 * Luôn đọc thẳng từ CSDL (một truy vấn theo khóa chính) để đổi ở Admin có hiệu lực cho đơn kế tiếp, kể cả khi chạy nhiều bản backend.
 */
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const SETTING_KEYS = { shippingFreeThreshold: 'shipping.freeThreshold' };

// Giá trị trong CSDL sai kiểu (sửa tay) thì bỏ qua và dùng mặc định thay vì làm hỏng việc đặt hàng
const parseThreshold = (raw) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
};

/** Ngưỡng tiền hàng (sau giảm giá) từ đó được miễn phí vận chuyển; 0 = không miễn phí cho đơn nào. */
export const getFreeShippingThreshold = async () => {
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_KEYS.shippingFreeThreshold },
  });
  return (row && parseThreshold(row.value)) ?? env.SHIPPING_FREE_THRESHOLD;
};

/** Cho trang Cài đặt: giá trị đang dùng, giá trị mặc định, và lần sửa gần nhất (null khi đang dùng mặc định). */
export const getShippingSettings = async () => {
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_KEYS.shippingFreeThreshold },
  });
  const custom = row ? parseThreshold(row.value) : null;
  return {
    freeThreshold: custom ?? env.SHIPPING_FREE_THRESHOLD,
    defaultFreeThreshold: env.SHIPPING_FREE_THRESHOLD,
    updatedAt: custom === null ? null : row.updatedAt,
  };
};

/** freeThreshold = số (đồng) để đặt, hoặc null để quay về mặc định. */
export const updateShippingSettings = async ({ freeThreshold }) => {
  const key = SETTING_KEYS.shippingFreeThreshold;
  if (freeThreshold === null) {
    await prisma.appSetting.deleteMany({ where: { key } });
  } else {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(freeThreshold) },
      create: { key, value: String(freeThreshold) },
    });
  }
  return getShippingSettings();
};
