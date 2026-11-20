/**
 * @feature [F16] Cài đặt cửa hàng - Kiểm thử giao diện Admin: trang Cài đặt, đặt ngưỡng miễn phí vận chuyển (BR-05).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const DEFAULTS = { freeThreshold: 5000000, defaultFreeThreshold: 5000000, updatedAt: null };
const CUSTOM = {
  freeThreshold: 8000000,
  defaultFreeThreshold: 5000000,
  updatedAt: '2026-11-20T03:00:00.000Z',
};

const open = (handlers = {}, route = '/cai-dat') => {
  tokenStorage.setTokens(adminSession);
  const calls = mockServer({
    'GET /users/me': [200, admin],
    'GET /admin/settings/shipping': [200, DEFAULTS],
    ...handlers,
  });
  renderApp(route);
  return calls;
};

const field = () => screen.findByLabelText('Ngưỡng miễn phí vận chuyển (₫)');

describe('Trang Cài đặt', () => {
  it('mục "Cài đặt" trong menu dẫn tới trang này', async () => {
    open({}, '/');
    const nav = await screen.findByRole('navigation', { name: 'Menu quản trị' });

    await userEvent.click(within(nav).getByRole('link', { name: 'Cài đặt' }));

    expect(await screen.findByRole('heading', { name: 'Cài đặt', level: 1 })).toBeInTheDocument();
    expect(await field()).toHaveValue('5000000');
  });

  it('chưa chỉnh lần nào: hiện giá trị mặc định và khóa nút "Dùng mặc định"', async () => {
    open();

    expect(await field()).toHaveValue('5000000');
    expect(screen.getByText('Chưa chỉnh, đang dùng mặc định')).toBeInTheDocument();
    expect(screen.getByText('Tương đương 5.000.000 ₫')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dùng mặc định/ })).toBeDisabled();
    // Chưa đổi gì thì chưa cần lưu
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
  });

  it('đã chỉnh: hiện giá trị đang dùng và thời điểm chỉnh gần nhất', async () => {
    open({ 'GET /admin/settings/shipping': [200, CUSTOM] });

    expect(await field()).toHaveValue('8000000');
    expect(screen.queryByText('Chưa chỉnh, đang dùng mặc định')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dùng mặc định/ })).toBeEnabled();
  });

  it('lưu ngưỡng mới: gửi số nguyên, báo thành công và cập nhật trạng thái', async () => {
    const calls = open({
      'PUT /admin/settings/shipping': [200, { ...CUSTOM, freeThreshold: 3000000 }],
    });
    const input = await field();

    await userEvent.clear(input);
    await userEvent.type(input, '3.000.000'); // dấu chấm ngăn cách hàng nghìn vẫn hiểu đúng
    expect(screen.getByText('Tương đương 3.000.000 ₫')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(
      await screen.findByText(/Đã lưu: miễn phí vận chuyển từ 3.000.000 ₫/),
    ).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'PUT /admin/settings/shipping').body).toEqual({
      freeThreshold: 3000000,
    });
    expect(input).toHaveValue('3000000');
    expect(screen.getByRole('button', { name: /Dùng mặc định/ })).toBeEnabled();
  });

  it('nhập 0 thì lưu được và giải thích là không miễn phí cho đơn nào', async () => {
    const calls = open({
      'PUT /admin/settings/shipping': [200, { ...CUSTOM, freeThreshold: 0 }],
    });
    const input = await field();

    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(screen.getByText('Không miễn phí cho đơn nào')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText(/không miễn phí vận chuyển cho đơn nào/)).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'PUT /admin/settings/shipping').body.freeThreshold).toBe(0);
  });

  it.each([
    ['để trống', ''],
    ['chữ', 'năm triệu'],
    ['số âm', '-5'],
    ['số thập phân', '1500,5'],
  ])('%s: báo lỗi ngay ở ô nhập và không gọi API', async (_label, value) => {
    const calls = open();
    const input = await field();

    await userEvent.clear(input);
    if (value) await userEvent.type(input, value);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(
      await screen.findByText('Vui lòng nhập số tiền là số nguyên không âm (đồng)'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'PUT /admin/settings/shipping')).toBe(false);
  });

  it('số quá lớn bị từ chối ở ô nhập', async () => {
    const calls = open();
    const input = await field();

    await userEvent.clear(input);
    await userEvent.type(input, '3000000000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Số tiền quá lớn')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'PUT /admin/settings/shipping')).toBe(false);
  });

  it('"Dùng mặc định" gửi null và đưa ô về giá trị mặc định', async () => {
    const calls = open({
      'GET /admin/settings/shipping': [200, CUSTOM],
      'PUT /admin/settings/shipping': [200, DEFAULTS],
    });
    const input = await field();
    expect(input).toHaveValue('8000000');

    await userEvent.click(screen.getByRole('button', { name: /Dùng mặc định/ }));

    expect(await screen.findByText(/Đã quay về giá trị mặc định/)).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'PUT /admin/settings/shipping').body).toEqual({
      freeThreshold: null,
    });
    await waitFor(() => expect(input).toHaveValue('5000000'));
    expect(screen.getByRole('button', { name: /Dùng mặc định/ })).toBeDisabled();
  });

  it('máy chủ từ chối thì hiện lỗi từ máy chủ', async () => {
    open({
      'PUT /admin/settings/shipping': [
        400,
        apiError('VALIDATION_ERROR', 'Ngưỡng miễn phí vận chuyển không được âm'),
      ],
    });
    const input = await field();

    await userEvent.clear(input);
    await userEvent.type(input, '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ngưỡng miễn phí vận chuyển không được âm',
    );
  });

  it('không tải được cài đặt thì báo lỗi và cho thử lại', async () => {
    let attempts = 0;
    open({
      'GET /admin/settings/shipping': () => {
        attempts += 1;
        return attempts === 1 ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] : [200, DEFAULTS];
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await field()).toHaveValue('5000000');
  });
});
