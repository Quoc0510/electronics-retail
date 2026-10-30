/**
 * @feature [F15] Kiểm thử E2E - Kịch bản 3 và 4: Admin nhập sản phẩm từ Excel và phân quyền (US-35, US-36, US-05, US-02).
 *   - Nhập Excel: tải file mẫu, thêm mới có dòng sai (xem trước rồi chỉ nhập dòng đúng), khách thấy sản phẩm mới ở cửa hàng,
 *     cập nhật giá bằng file Excel và khách thấy giá mới.
 *   - Phân quyền: tài khoản khách không vào được Admin; chưa đăng nhập thì bị chuyển về trang đăng nhập.
 * File Excel được tạo ngay trong kịch bản bằng chính thư viện ghi Excel của backend.
 */
import { expect, test } from '@playwright/test';
import writeExcelFile from 'write-excel-file/node';
import { ADMIN_URL, CLIENT_URL } from '../playwright.config.js';
import { CUSTOMER, loginAdmin, unique } from './helpers.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = [
  'SKU',
  'Tên sản phẩm',
  'Danh mục',
  'Thương hiệu',
  'Giá gốc',
  'Giá khuyến mãi',
  'Tồn kho',
  'Mô tả',
  'Thông số',
  'Hiển thị',
];

const workbook = (rows, headers = HEADERS) =>
  writeExcelFile([{ sheet: 'Sản phẩm', data: [headers, ...rows] }]).toBuffer();
const file = (buffer, name = 'san-pham.xlsx') => ({ name, mimeType: XLSX, buffer });

test.describe('Nhập sản phẩm từ Excel', () => {
  test.describe.configure({ mode: 'serial' });

  const run = unique();
  const good = { sku: `E2E-${run}-1`, name: `Tai nghe kiểm thử ${run}` };
  const second = { sku: `E2E-${run}-2`, name: `Cáp kiểm thử ${run}` };
  const bad = { sku: `E2E-${run}-3`, name: `Sản phẩm lỗi ${run}` };

  test('tải file mẫu về máy', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${ADMIN_URL}/san-pham/nhap-excel`);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải file mẫu' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('mau-nhap-san-pham.xlsx');
  });

  test('thêm mới: xem trước báo dòng sai, chỉ nhập các dòng đúng', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${ADMIN_URL}/san-pham`);
    await page.getByRole('link', { name: 'Nhập từ Excel' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nhập sản phẩm từ Excel' }),
    ).toBeVisible();

    const buffer = await workbook([
      [
        good.sku,
        good.name,
        'phụ kiện',
        'ANKER',
        '1.290.000',
        990000,
        25,
        'Nhập bằng Excel',
        'Pin: 30 giờ',
        'Có',
      ],
      [second.sku, second.name, 'Phụ kiện', 'Anker', 450000, null, 10, null, null, null],
      [bad.sku, bad.name, 'Máy bay', 'Anker', 500000, null, 1, null, null, null],
    ]);
    await page.getByLabel('File Excel (.xlsx)').setInputFiles(file(buffer, 'hang-moi.xlsx'));
    await page.getByRole('button', { name: 'Xem trước' }).click();

    const preview = page.getByRole('region', { name: 'Kết quả xem trước' });
    await expect(
      preview.getByText('Tổng số dòng').locator('xpath=following-sibling::dd'),
    ).toHaveText('3');
    await expect(
      preview.getByText('Hợp lệ', { exact: true }).locator('xpath=following-sibling::dd'),
    ).toHaveText('2');
    const badRow = preview.getByRole('row', { name: new RegExp(bad.sku) });
    await expect(badRow).toContainText('Danh mục "Máy bay" không tồn tại trong hệ thống');
    // Xem trước chưa ghi gì: cửa hàng (một tab khác) vẫn chưa có sản phẩm nào của lần nhập này
    const shop = await page.context().newPage();
    await shop.goto(`${CLIENT_URL}/san-pham?search=${encodeURIComponent(run)}`);
    await expect(shop.getByRole('link', { name: new RegExp(good.name) })).toHaveCount(0);
    await shop.close();

    await page.getByRole('button', { name: 'Thêm 2 dòng hợp lệ' }).click();
    const done = page.getByRole('region', { name: 'Kết quả nhập' });
    await expect(done.getByText('Đã thêm').locator('xpath=following-sibling::dd')).toHaveText('2');
    await expect(
      done.getByText('Bị bỏ qua (lỗi)').locator('xpath=following-sibling::dd'),
    ).toHaveText('1');

    // Nhập lại đúng file đó ở chế độ thêm mới: không tạo trùng, mọi dòng đúng trước đó giờ báo SKU đã tồn tại
    await page.getByRole('button', { name: 'Nhập file khác' }).click();
    await page.getByLabel('File Excel (.xlsx)').setInputFiles(file(buffer, 'hang-moi.xlsx'));
    await page.getByRole('button', { name: 'Xem trước' }).click();
    await expect(page.getByRole('row', { name: new RegExp(good.sku) })).toContainText(
      'SKU đã tồn tại',
    );
    await expect(page.getByRole('button', { name: 'Thêm 0 dòng hợp lệ' })).toBeDisabled();
  });

  test('khách thấy sản phẩm mới ở cửa hàng; dòng sai thì không có', async ({ page }) => {
    await page.goto(`/san-pham?search=${encodeURIComponent(run)}`);
    await expect(page.getByRole('link', { name: new RegExp(good.name) }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(second.name) }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(bad.name) })).toHaveCount(0);

    await page
      .getByRole('link', { name: new RegExp(good.name) })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1, name: good.name })).toBeVisible();
    await expect(page.getByText('990.000 ₫').first()).toBeVisible(); // giá khuyến mãi từ file
  });

  test('cập nhật: sửa giá bằng Excel, ô trống giữ nguyên, SKU lạ bị bỏ qua', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${ADMIN_URL}/san-pham/nhap-excel`);
    await page.getByRole('radio', { name: /Cập nhật sản phẩm đã có/ }).check();

    const buffer = await workbook(
      [
        [good.sku, 790000, 'xóa', null],
        [`KHONG-CO-${run}`, 100000, null, null],
      ],
      ['SKU', 'Giá gốc', 'Giá khuyến mãi', 'Tồn kho'],
    );
    await page.getByLabel('File Excel (.xlsx)').setInputFiles(file(buffer, 'cap-nhat.xlsx'));
    await page.getByRole('button', { name: 'Xem trước' }).click();
    await expect(page.getByRole('row', { name: new RegExp(`KHONG-CO-${run}`) })).toContainText(
      'SKU không tồn tại trong hệ thống',
    );
    await page.getByRole('button', { name: 'Cập nhật 1 dòng hợp lệ' }).click();
    const done = page.getByRole('region', { name: 'Kết quả nhập' });
    await expect(done.getByText('Đã cập nhật').locator('xpath=following-sibling::dd')).toHaveText(
      '1',
    );

    // Khách thấy giá mới 790.000 ₫ và không còn giá khuyến mãi cũ
    await page.goto(`/san-pham?search=${encodeURIComponent(run)}`);
    await page
      .getByRole('link', { name: new RegExp(good.name) })
      .first()
      .click();
    await expect(page.getByText('790.000 ₫').first()).toBeVisible();
    await expect(page.getByText('990.000 ₫')).toHaveCount(0);
  });
});

test.describe('Phân quyền Admin', () => {
  test('tài khoản khách hàng không đăng nhập được vào trang quản trị', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/dang-nhap`);
    await page.getByLabel('Email').fill(CUSTOMER.email);
    await page.getByLabel('Mật khẩu').fill(CUSTOMER.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByText('Tài khoản này không có quyền quản trị')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menu quản trị' })).toHaveCount(0);
  });

  test('chưa đăng nhập mà mở thẳng trang quản trị thì bị chuyển về đăng nhập', async ({ page }) => {
    for (const path of ['/don-hang', '/ma-giam-gia', '/san-pham/nhap-excel']) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page).toHaveURL(/\/dang-nhap/);
    }
  });

  test('khách chưa đăng nhập không vào được trang tài khoản và danh sách yêu thích', async ({
    page,
  }) => {
    for (const path of ['/tai-khoan', '/yeu-thich']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dang-nhap/);
    }
  });
});
