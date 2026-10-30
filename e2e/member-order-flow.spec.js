/**
 * @feature [F15] Kiểm thử E2E - Kịch bản 2: một vòng đời đầy đủ đi qua cả Client lẫn Admin (US-24, US-25, US-16, US-19, US-21, US-23).
 *   A. Admin tạo mã giảm giá và bật "tự động áp dụng".
 *   B. Thành viên thêm hàng vào giỏ: trang đặt hàng tự áp mã; bỏ mã rồi áp lại bằng gợi ý; đặt hàng, đơn ghi đúng số tiền giảm.
 *   C. Admin xử lý đơn: xác nhận, giao hàng, hoàn thành.
 *   D. Thành viên thấy đơn hoàn thành kèm điểm được cộng, rồi viết đánh giá cho sản phẩm vừa mua.
 *   E. Admin ẩn đánh giá: khách không còn thấy nó ở trang sản phẩm.
 *   F. Dọn: Admin tắt mã vừa tạo.
 * Các bước phụ thuộc nhau (đơn tạo ở B được xử lý ở C...) nên chạy tuần tự và dùng chung `state`. Mỗi lần chạy đăng ký một thành
 * viên mới (0 điểm, chưa đánh giá gì) và tạo một mã mới rồi tắt ở bước F, nên chạy lại nhiều lần trên cùng hệ thống vẫn ra cùng kết
 * quả (hai mã tự động cùng giảm 15% còn bật sẽ làm bước B chọn nhầm mã cũ). Bước nào lỗi giữa chừng thì chạy `npm run e2e:down` rồi
 * `npm run e2e:up` để bắt đầu lại từ dữ liệu sạch.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_URL, CLIENT_URL } from '../playwright.config.js';
import {
  fillShipping,
  loginAdmin,
  loginClient,
  openProduct,
  readOrderCode,
  unique,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const PRODUCT_NAME = 'Sạc dự phòng Anker 737';
const PRICE_TEXT = '2.290.000 ₫';
const DISCOUNT_TEXT = '343.500 ₫'; // 15% của 2.290.000
const COMMENT = `Sạc rất tốt, kiểm thử E2E ${unique()}`;
const state = {
  couponCode: `E2E${unique()}`,
  orderCode: '',
  customer: { email: `e2e.${unique().toLowerCase()}@example.com`, password: 'Matkhau123' },
};

test('0. Khách đăng ký tài khoản thành viên mới', async ({ page }) => {
  await page.goto('/dang-ky');
  await page.getByLabel('Họ và tên').fill('Thành Viên Kiểm Thử');
  await page.getByLabel('Email').fill(state.customer.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(state.customer.password);
  await page.getByLabel('Nhập lại mật khẩu').fill(state.customer.password);
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  // Đăng ký xong được đăng nhập luôn và về trang chủ
  await expect(page).not.toHaveURL(/\/dang-ky/);
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toHaveCount(0);
});

test('A. Admin tạo mã giảm giá 15% và bật tự động áp dụng', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${ADMIN_URL}/ma-giam-gia`);
  await page.getByRole('button', { name: /Thêm mã giảm giá/ }).click();

  await page.getByLabel('Mã giảm giá', { exact: true }).fill(state.couponCode);
  await page.getByLabel('Mức giảm (%)').fill('15');
  await page.getByRole('checkbox', { name: /Tự động áp dụng khi thanh toán/ }).check();
  await page.getByRole('button', { name: 'Tạo mã' }).click();

  const row = page.getByRole('row', { name: new RegExp(state.couponCode) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Đang chạy')).toBeVisible();
  await expect(row.getByText('Tự động áp dụng khi thanh toán')).toBeVisible();
});

test('B. Thành viên được tự áp mã, bỏ rồi áp lại bằng gợi ý, đặt hàng đúng số tiền giảm', async ({
  page,
}) => {
  await loginClient(page, state.customer);
  await openProduct(page, PRODUCT_NAME);
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).first().click();
  await expect(page.getByRole('link', { name: 'Giỏ hàng (1)' })).toBeVisible();
  await page.goto('/dat-hang');
  await expect(page.getByRole('heading', { level: 1, name: 'Đặt hàng' })).toBeVisible();

  // Mã được tự điền và tính vào tổng
  const applied = page.getByText(/Đã tự động áp dụng mã/);
  await expect(applied).toContainText(state.couponCode);
  await expect(applied).toContainText(DISCOUNT_TEXT);
  const summary = page.getByRole('complementary', { name: 'Đơn hàng của bạn' });
  await expect(summary.getByText(`Mã giảm giá (${state.couponCode})`)).toBeVisible();

  // Bỏ mã: tổng về như cũ, mã KHÔNG biến mất mà được gợi ý lại
  await page.getByRole('button', { name: 'Bỏ mã' }).click();
  await expect(page.getByText(/Đã tự động áp dụng mã/)).toHaveCount(0);
  await expect(summary.getByText(/Mã giảm giá \(/)).toHaveCount(0);
  const hint = page.getByText(/Mã dành cho bạn/);
  await expect(hint).toContainText(state.couponCode);
  await page.getByRole('button', { name: 'Dùng mã này' }).click();
  await expect(page.getByText(/Đã tự động áp dụng mã/)).toContainText(state.couponCode);

  // Đặt hàng (tài khoản mẫu chưa có địa chỉ nên điền địa chỉ mới)
  await fillShipping(page);
  await page.getByRole('button', { name: /Xác nhận đặt hàng/ }).click();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
  state.orderCode = await readOrderCode(page);

  // Đơn lưu mã và số tiền giảm; điểm dự kiến tính trên tiền hàng sau giảm (2.290.000 - 343.500 = 1.946.500 -> 1 điểm)
  await expect(page.getByText(`Mã giảm giá (${state.couponCode})`)).toBeVisible();
  await expect(page.getByText(`-${DISCOUNT_TEXT}`)).toBeVisible();
  await expect(page.getByText(PRICE_TEXT).first()).toBeVisible();
  await expect(page.getByText('Dự kiến nhận 1 điểm thành viên')).toBeVisible();
});

test('C. Admin xác nhận, giao hàng và hoàn thành đơn', async ({ page }) => {
  expect(state.orderCode, 'cần đơn từ bước B').not.toBe('');
  await loginAdmin(page);
  await page.goto(`${ADMIN_URL}/don-hang`);
  await page.getByLabel('Tìm đơn hàng').fill(state.orderCode);
  await page.getByRole('link', { name: state.orderCode }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(state.orderCode) }),
  ).toBeVisible();
  // Chi tiết đơn của Admin cũng thấy mã và số tiền giảm
  await expect(page.getByText(`Mã giảm giá (${state.couponCode})`)).toBeVisible();

  for (const step of ['Xác nhận đơn', 'Bắt đầu giao hàng', 'Hoàn thành (đã thu tiền)']) {
    await page.getByRole('button', { name: step }).click();
  }
  await expect(page.getByText('Đã thanh toán').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hoàn thành (đã thu tiền)' })).toHaveCount(0);
});

test('D. Thành viên thấy đơn hoàn thành, được cộng điểm và viết đánh giá', async ({ page }) => {
  await loginClient(page, state.customer);
  await page.goto(`/don-hang/${state.orderCode}`);
  await expect(page.getByText('Hoàn thành').first()).toBeVisible();
  await expect(page.getByText('Đã cộng 1 điểm thành viên')).toBeVisible();

  // Chỉ người đã nhận hàng mới viết được đánh giá (BR-13)
  await openProduct(page, PRODUCT_NAME);
  const form = page.getByRole('form', { name: 'Viết đánh giá' });
  await form.getByLabel('5 sao').check({ force: true });
  await form.getByLabel(/Bình luận/).fill(COMMENT);
  await form.getByRole('button', { name: 'Gửi đánh giá' }).click();
  // Sau khi gửi, đánh giá có thể hiện cả trong danh sách lẫn khung "đánh giá của bạn": chỉ cần thấy ít nhất một nơi
  await expect(page.locator('#danh-gia').getByText(COMMENT).first()).toBeVisible();
});

test('E. Admin ẩn đánh giá thì khách không còn thấy ở trang sản phẩm', async ({
  page,
  browser,
}) => {
  await loginAdmin(page);
  await page.goto(`${ADMIN_URL}/danh-gia`);
  await page.getByLabel('Tìm đánh giá').fill(COMMENT);
  const row = page.getByRole('row', { name: new RegExp(COMMENT) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^Ẩn đánh giá/ }).click();
  await expect(row.getByText('Đã ẩn')).toBeVisible();

  // Khách chưa đăng nhập (phiên mới) mở lại trang sản phẩm
  const guest = await browser.newContext({ baseURL: CLIENT_URL });
  const guestPage = await guest.newPage();
  await openProduct(guestPage, PRODUCT_NAME);
  await expect(guestPage.getByText(COMMENT)).toHaveCount(0);
  await guest.close();
});

test('F. Dọn: Admin tắt mã vừa tạo để lần chạy sau không bị mã này tranh chọn', async ({
  page,
}) => {
  await loginAdmin(page);
  await page.goto(`${ADMIN_URL}/ma-giam-gia`);
  await page.getByLabel('Tìm mã giảm giá').fill(state.couponCode);
  const row = page.getByRole('row', { name: new RegExp(state.couponCode) });
  await row.getByRole('button', { name: `Tắt mã ${state.couponCode}` }).click();
  await expect(row.getByText('Đã tắt')).toBeVisible();
});
