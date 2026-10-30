/**
 * @feature [F15] Kiểm thử E2E - Kịch bản 1: khách chưa đăng nhập chọn sản phẩm, thêm vào giỏ, đặt hàng (COD) rồi tra cứu lại đơn
 * bằng mã đơn + số điện thoại (BR-11, BR-16; US-14, US-16, US-32, US-33).
 */
import { expect, test } from '@playwright/test';
import { SHIPPING, fillShipping, openProduct, readOrderCode } from './helpers.js';

test('khách vãng lai mua hàng không cần đăng nhập rồi tra cứu và hủy đơn', async ({ page }) => {
  // 1. Tìm sản phẩm rồi thêm vào giỏ
  await openProduct(page, 'Sạc dự phòng Anker 737');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).first().click();
  await expect(page.getByRole('link', { name: 'Giỏ hàng (1)' })).toBeVisible();

  // 2. Giỏ hàng -> trang đặt hàng (không bị bắt đăng nhập)
  await page.getByRole('link', { name: 'Giỏ hàng (1)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Giỏ hàng/ })).toBeVisible();
  await page.getByRole('link', { name: 'Tiến hành đặt hàng' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Đặt hàng' })).toBeVisible();
  await expect(page.getByLabel('Mật khẩu')).toHaveCount(0);

  // 3. Điền địa chỉ rồi xác nhận
  await fillShipping(page);
  await page.getByRole('button', { name: /Xác nhận đặt hàng/ }).click();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
  const code = await readOrderCode(page);

  // Giỏ đã được làm trống sau khi đặt
  await expect(page.getByRole('link', { name: 'Giỏ hàng (0)' })).toBeVisible();

  // 4. Tra cứu lại bằng mã đơn và số điện thoại, sai số điện thoại thì không thấy
  await page.goto('/tra-cuu-don-hang');
  await page.getByLabel('Mã đơn hàng').fill(code);
  await page.getByLabel('Số điện thoại nhận hàng').fill('0999999999');
  await page.getByRole('button', { name: 'Tra cứu' }).click();
  await expect(page.getByText('Không tìm thấy đơn hàng').first()).toBeVisible();

  await page.getByLabel('Số điện thoại nhận hàng').fill(SHIPPING['Số điện thoại người nhận']);
  await page.getByRole('button', { name: 'Tra cứu' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(code) })).toBeVisible();
  await expect(page.getByText('Chờ xác nhận').first()).toBeVisible();

  // 5. Khách tự hủy khi đơn còn chờ xác nhận (BR-06): mở khung hủy, chọn lý do rồi xác nhận
  await page.getByRole('button', { name: 'Hủy đơn hàng' }).click();
  await page.getByLabel('Đặt nhầm sản phẩm').check();
  await page.getByRole('button', { name: 'Xác nhận hủy đơn' }).click();
  await expect(page.getByText('Đã hủy').first()).toBeVisible();
});
