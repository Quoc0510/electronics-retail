/**
 * @feature [F16][F15] Kiểm thử E2E - Kịch bản 16: Admin đổi ngưỡng miễn phí vận chuyển ở trang Cài đặt, khách thấy phí vận chuyển ở
 * trang đặt hàng đổi theo ngay (BR-05). Hệ thống kiểm thử không bật GHN nên phí gốc là phí cố định 30.000 đ.
 * Cuối kịch bản luôn trả ngưỡng về mặc định để các kịch bản khác không bị ảnh hưởng.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../playwright.config.js';
import { loginAdmin, openProduct } from './helpers.js';

const PRODUCT = 'Củ sạc Anker Prime 67W GaN 3 cổng'; // 1.520.000 ₫, không có giá khuyến mãi

test('Admin đổi ngưỡng miễn phí vận chuyển thì khách thấy ngay ở trang đặt hàng', async ({
  page,
  context,
}) => {
  await loginAdmin(page);
  await page.goto(`${ADMIN_URL}/cai-dat`);
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible();
  const field = page.getByLabel('Ngưỡng miễn phí vận chuyển (₫)');
  await expect(field).toHaveValue('5000000'); // mặc định của hệ thống

  const setThreshold = async (value) => {
    await field.fill(String(value));
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText(/Đã lưu:/)).toBeVisible();
  };

  // Khách (trình duyệt khác, địa chỉ Client khác Admin nên không dùng chung phiên) có sản phẩm trong giỏ
  const guest = await context.newPage();
  await openProduct(guest, PRODUCT);
  await guest.getByRole('button', { name: 'Thêm vào giỏ' }).first().click();
  await expect(guest.getByRole('link', { name: 'Giỏ hàng (1)' })).toBeVisible();
  const feeRow = () => guest.getByText('Phí vận chuyển').locator('..');
  const openCheckout = async () => {
    await guest.goto('/dat-hang');
    await expect(guest.getByRole('heading', { level: 1, name: 'Đặt hàng' })).toBeVisible();
  };

  try {
    // Ngưỡng mặc định 5.000.000: đơn 1.520.000 chưa được miễn phí
    await openCheckout();
    await expect(feeRow()).toContainText('30.000 ₫');

    // Admin hạ ngưỡng xuống 1.000.000: cùng giỏ hàng nay được miễn phí
    await setThreshold(1000000);
    await openCheckout();
    await expect(feeRow()).toContainText('Miễn phí');

    // Đặt 0: không miễn phí cho đơn nào, phí trở lại
    await setThreshold(0);
    await openCheckout();
    await expect(feeRow()).toContainText('30.000 ₫');
  } finally {
    // Trả về mặc định, kể cả khi các bước trên lỗi
    await page.goto(`${ADMIN_URL}/cai-dat`);
    const reset = page.getByRole('button', { name: /Dùng mặc định/ });
    if (await reset.isEnabled()) await reset.click();
  }

  await expect(page.getByText(/Đã quay về giá trị mặc định/)).toBeVisible();
  await expect(field).toHaveValue('5000000');
});
