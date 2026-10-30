/**
 * @feature [F15] Kiểm thử E2E - Hàm dùng chung cho các kịch bản: đăng nhập, điền địa chỉ, đọc mã đơn.
 * Tài khoản dùng là tài khoản mẫu của chính hệ thống kiểm thử tạm (nạp bởi e2e/stack.mjs từ backend/prisma/seed.js), không phải
 * tài khoản thật.
 */
import { expect } from '@playwright/test';
import { ADMIN_URL } from '../playwright.config.js';

export const ADMIN = { email: 'admin@techstore.local', password: 'Admin@123' };
export const CUSTOMER = { email: 'khach@techstore.local', password: 'Khach@123' };

/** Mã đơn dạng TSyymmdd-xxxx (BR-12). */
export const ORDER_CODE = /TS\d{6}-[A-Z0-9]{4}/;

/** Chuỗi khác nhau ở mỗi lần chạy để các kịch bản không đụng nhau (SKU, mã giảm giá, tên). */
export const unique = () => Date.now().toString(36).toUpperCase();

/** Địa chỉ nhập tay ở trang đặt hàng (khách vãng lai hoặc chọn "giao tới địa chỉ khác"). */
export const SHIPPING = {
  'Tên người nhận': 'Nguyễn Kiểm Thử',
  'Số điện thoại người nhận': '0912345678',
  'Tỉnh/Thành phố': 'Đà Nẵng',
  'Phường/Xã': 'Thạch Thang',
  'Số nhà, tên đường': '1 Bạch Đằng',
};

export const fillShipping = async (page, values = SHIPPING) => {
  for (const [label, value] of Object.entries(values)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
};

/**
 * Mở trang chi tiết một sản phẩm bằng cách TÌM theo tên rồi bấm vào kết quả. Không dựa vào vị trí trong danh sách vì danh sách
 * xếp mới nhất trước và có phân trang: sản phẩm do các kịch bản nhập Excel tạo ra sẽ đẩy sản phẩm mẫu sang trang sau.
 */
export const openProduct = async (page, name) => {
  await page.goto(`/san-pham?search=${encodeURIComponent(name)}`);
  await page
    .getByRole('link', { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
};

/** Đăng nhập Client bằng form; chờ tới khi đã vào được (menu tài khoản hiện). */
export const loginClient = async (page, { email, password } = CUSTOMER) => {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/\/dang-nhap/);
};

/** Đăng nhập Admin bằng form (Admin chạy ở một địa chỉ khác Client nên dùng đường dẫn đầy đủ). */
export const loginAdmin = async (page, { email, password } = ADMIN) => {
  await page.goto(`${ADMIN_URL}/dang-nhap`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Menu quản trị' })).toBeVisible();
};

/** Lấy mã đơn đang hiện trên trang (khung "Đặt hàng thành công" hoặc chi tiết đơn). */
export const readOrderCode = async (page) => {
  const text = await page.locator('main').innerText();
  const match = text.match(ORDER_CODE);
  expect(match, 'trang phải hiện mã đơn').not.toBeNull();
  return match[0];
};
