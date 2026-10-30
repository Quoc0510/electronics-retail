/**
 * @feature [F14] Nhập sản phẩm từ Excel - Kiểm thử: các hàm đọc ô (lib), file mẫu, xem trước, nhập thêm mới và cập nhật,
 * dòng lỗi, kiểm tra file tải lên và phân quyền (US-35, US-36). Chạy trên PostgreSQL thật; file .xlsx trong test được tạo
 * bằng chính thư viện ghi Excel nên đi qua đúng đường đọc file như khi Admin tải lên.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import readExcelFile, { readSheet } from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  COLUMNS,
  formatSpecs,
  isClearKeyword,
  mapHeaders,
  normalizeHeader,
  normalizeName,
  parseSpecs,
  parseVisibility,
  parseWholeNumber,
} from '../src/lib/productImport.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// ---------------------------------------------------------------------------
// Dữ liệu và hàm hỗ trợ
// ---------------------------------------------------------------------------
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = COLUMNS.map((column) => column.header);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const signIn = async (email = 'admin@example.com', role = 'ADMIN') => {
  await createUser({ email, role });
  const { accessToken } = await loginAs(request, app, email);
  return accessToken;
};

// Danh mục và thương hiệu có sẵn để dòng Excel tham chiếu theo tên
const seedCatalog = async () => ({
  phones: await prisma.category.create({ data: { name: 'Điện thoại', slug: 'dien-thoai' } }),
  accessories: await prisma.category.create({ data: { name: 'Phụ kiện', slug: 'phu-kien' } }),
  apple: await prisma.brand.create({ data: { name: 'Apple', slug: 'apple' } }),
  anker: await prisma.brand.create({ data: { name: 'Anker', slug: 'anker' } }),
});

// Tạo file .xlsx từ các dòng (mảng ô); null = ô trống
const workbook = (rows, headers = HEADERS) =>
  writeExcelFile([{ sheet: 'Sản phẩm', data: [headers, ...rows] }]).toBuffer();

// Một dòng đầy đủ với giá trị mặc định hợp lệ, ghi đè theo tên cột
const line = (overrides = {}) => {
  const base = {
    SKU: 'SP-001',
    'Tên sản phẩm': 'Điện thoại thử 1',
    'Danh mục': 'Điện thoại',
    'Thương hiệu': 'Apple',
    'Giá gốc': 10_000_000,
    'Giá khuyến mãi': null,
    'Tồn kho': null,
    'Mô tả': null,
    'Thông số': null,
    'Hiển thị': null,
    ...overrides,
  };
  return HEADERS.map((header) => base[header]);
};

const binary = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const upload = (path, buffer, mode, token, filename = 'san-pham.xlsx') =>
  request(app)
    .post(`/api/admin/products/import${path}`)
    .query(mode === undefined ? {} : { mode })
    .set(auth(token))
    .attach('file', buffer, { filename, contentType: XLSX });

const preview = (buffer, mode, token) => upload('/preview', buffer, mode, token);
const runImport = (buffer, mode, token) => upload('', buffer, mode, token);
const download = (path, mode, token) =>
  request(app)
    .get(`/api/admin/products/import/${path}`)
    .query({ mode })
    .set(auth(token))
    .buffer(true)
    .parse(binary);

const byRow = (res, rowNumber) => res.body.rows.find((row) => row.row === rowNumber);
const messages = (row) => row.errors.map((error) => `${error.column}: ${error.message}`);
const productBySku = (sku) => prisma.product.findUnique({ where: { sku } });

// ---------------------------------------------------------------------------
// Hàm thuần đọc ô (lib)
// ---------------------------------------------------------------------------
describe('parseWholeNumber', () => {
  it('nhận ô số nguyên và chuỗi số có dấu phân cách hàng nghìn', () => {
    expect(parseWholeNumber(1500000, 'Giá')).toEqual({ ok: true, value: 1500000 });
    expect(parseWholeNumber('1500000', 'Giá')).toEqual({ ok: true, value: 1500000 });
    expect(parseWholeNumber('1.500.000', 'Giá').value).toBe(1500000);
    expect(parseWholeNumber('1,500,000', 'Giá').value).toBe(1500000);
    expect(parseWholeNumber(' 2.500.000 đ ', 'Giá').value).toBe(2500000);
    expect(parseWholeNumber('990 ₫', 'Giá').value).toBe(990);
    expect(parseWholeNumber(0, 'Tồn kho').value).toBe(0);
  });

  it('từ chối số thập phân, số âm và chuỗi sai nhóm để không hiểu nhầm số tiền', () => {
    for (const bad of [99.5, -1, '1,5', '1.5', '12.34.567', 'abc', '1e6', '1 500 0a']) {
      expect(parseWholeNumber(bad, 'Giá').ok).toBe(false);
    }
    expect(parseWholeNumber(99.5, 'Giá gốc').message).toBe('Giá gốc phải là số nguyên');
    expect(parseWholeNumber(Number.NaN, 'Giá').ok).toBe(false);
    expect(parseWholeNumber(Number.POSITIVE_INFINITY, 'Giá').ok).toBe(false);
  });
});

describe('parseSpecs, formatSpecs và parseVisibility', () => {
  it('đọc thông số cách nhau bằng xuống dòng hoặc dấu chấm phẩy; giá trị được chứa dấu hai chấm', () => {
    expect(parseSpecs('Màn hình: 6.1 inch\nRAM: 8GB; Tỉ lệ: 16:9').value).toEqual({
      'Màn hình': '6.1 inch',
      RAM: '8GB',
      'Tỉ lệ': '16:9',
    });
    expect(parseSpecs('').value).toEqual({});
  });

  it('báo lỗi dòng thiếu tên, thiếu giá trị hoặc tên bị lặp', () => {
    expect(parseSpecs('Chỉ có tên').ok).toBe(false);
    expect(parseSpecs('RAM:').ok).toBe(false);
    expect(parseSpecs(': 8GB').ok).toBe(false);
    expect(parseSpecs('RAM: 8GB; RAM: 16GB').message).toContain('bị lặp');
  });

  it('formatSpecs là phép ngược của parseSpecs', () => {
    const specs = { 'Màn hình': '6.1 inch', RAM: '8GB' };
    expect(formatSpecs(specs)).toBe('Màn hình: 6.1 inch\nRAM: 8GB');
    expect(parseSpecs(formatSpecs(specs)).value).toEqual(specs);
    expect(formatSpecs(null)).toBe('');
  });

  it('Hiển thị nhận Có/Không, Yes/No, 1/0, true/false, Hiện/Ẩn, không phân biệt hoa thường và dấu', () => {
    for (const yes of ['Có', 'có', 'CO', 'yes', '1', 'true', 'Hiện', true]) {
      expect(parseVisibility(yes).value).toBe(true);
    }
    for (const no of ['Không', 'khong', 'No', '0', 'false', 'Ẩn', false]) {
      expect(parseVisibility(no).value).toBe(false);
    }
    expect(parseVisibility('có thể').ok).toBe(false);
  });

  it('từ khóa xóa và chuẩn hóa tên', () => {
    expect(['xóa', 'Xóa', 'XOA', ' clear '].every(isClearKeyword)).toBe(true);
    expect(isClearKeyword('xóa hết')).toBe(false);
    expect(isClearKeyword(0)).toBe(false);
    expect(normalizeHeader('  Giá   GỐC ')).toBe('gia goc');
    expect(normalizeHeader('Đơn giá')).toBe('don gia');
    // Tên danh mục giữ dấu: "Điện thoại" khác "Dien thoai" nhưng hoa thường và khoảng trắng thừa thì bỏ qua
    expect(normalizeName('  ĐIỆN   thoại ')).toBe('điện thoại');
    expect(normalizeName('Dien thoai')).not.toBe(normalizeName('Điện thoại'));
  });

  it('mapHeaders nhận tiêu đề không phân biệt dấu/hoa thường, bỏ qua cột lạ và cột trùng', () => {
    const { index, unknown } = mapHeaders([
      'sku',
      'TEN SAN PHAM',
      'Giá gốc',
      'Ghi chú nội bộ',
      'Giá gốc',
      null,
      '',
    ]);
    expect(index).toEqual({ sku: 0, name: 1, price: 2 });
    expect(unknown).toEqual(['Ghi chú nội bộ', 'Giá gốc']);
  });
});

// ---------------------------------------------------------------------------
// Phân quyền và kiểm tra tham số
// ---------------------------------------------------------------------------
describe('Phân quyền và tham số', () => {
  it('chỉ ADMIN dùng được: chưa đăng nhập 401, khách hàng 403, ở cả bốn API', async () => {
    const customer = await signIn('khach@example.com', 'CUSTOMER');
    const file = await workbook([line()]);
    for (const [method, path] of [
      ['get', '/template'],
      ['post', '/preview'],
      ['post', '/errors'],
      ['post', ''],
    ]) {
      const base = request(app)
        [method](`/api/admin/products/import${path}`)
        .query({ mode: 'create' });
      expect((await base.attach('file', file, 'a.xlsx')).status).toBe(401);
      const forbidden = request(app)
        [method](`/api/admin/products/import${path}`)
        .query({ mode: 'create' })
        .set(auth(customer))
        .attach('file', file, 'a.xlsx');
      expect((await forbidden).status).toBe(403);
    }
    expect(await prisma.product.count()).toBe(0);
  });

  it('thiếu hoặc sai chế độ thì 400', async () => {
    const token = await signIn();
    const file = await workbook([line()]);
    expect((await preview(file, undefined, token)).status).toBe(400);
    expect((await preview(file, 'delete', token)).status).toBe(400);
    expect((await download('template', 'xoa', token)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// File mẫu
// ---------------------------------------------------------------------------
describe('GET /api/admin/products/import/template', () => {
  it('file thêm mới: có đủ cột tiêu đề, trang danh mục/thương hiệu và hướng dẫn, chưa có dòng dữ liệu', async () => {
    const token = await signIn();
    await seedCatalog();
    const res = await download('template', 'create', token);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(XLSX);
    expect(res.headers['content-disposition']).toContain('mau-nhap-san-pham.xlsx');
    expect(res.body.subarray(0, 4).toString('hex')).toBe('504b0304'); // file zip thật

    const sheets = await readExcelFile(res.body);
    expect(sheets.map((s) => s.sheet)).toEqual([
      'Sản phẩm',
      'Danh mục và thương hiệu',
      'Hướng dẫn',
    ]);
    expect(sheets[0].data).toEqual([HEADERS]);
    const lookup = sheets[1].data.slice(1).flat().filter(Boolean);
    expect(lookup).toEqual(expect.arrayContaining(['Điện thoại', 'Phụ kiện', 'Apple', 'Anker']));
    expect(sheets[2].data[0][0]).toContain('NHẬP SẢN PHẨM MỚI');
  });

  it('file cập nhật: điền sẵn sản phẩm hiện có (giá, tồn kho, thông số, hiển thị) để sửa tại chỗ', async () => {
    const token = await signIn();
    const catalog = await seedCatalog();
    await prisma.product.create({
      data: {
        sku: 'IP15',
        name: 'iPhone 15',
        slug: 'iphone-15',
        price: 20_000_000,
        salePrice: 18_000_000,
        stock: 7,
        description: 'Mô tả',
        specs: { 'Màn hình': '6.1 inch', RAM: '6GB' },
        isActive: false,
        categoryId: catalog.phones.id,
        brandId: catalog.apple.id,
      },
    });
    const res = await download('template', 'update', token);
    const [sheet] = await readExcelFile(res.body);

    expect(res.headers['content-disposition']).toContain('cap-nhat-san-pham.xlsx');
    expect(sheet.data[0]).toEqual(HEADERS);
    const [row] = sheet.data.slice(1);
    // PostgreSQL (jsonb) không giữ thứ tự khóa nên thông số so sánh theo nội dung, không theo thứ tự dòng
    expect(parseSpecs(row[8]).value).toEqual({ 'Màn hình': '6.1 inch', RAM: '6GB' });
    expect(row.filter((_, i) => i !== 8)).toEqual([
      'IP15',
      'iPhone 15',
      'Điện thoại',
      'Apple',
      20_000_000,
      18_000_000,
      7,
      'Mô tả',
      'Không',
    ]);
  });

  it('file cập nhật tải về dùng lại được ngay: nhập không đổi gì thì mọi dòng đều hợp lệ', async () => {
    const token = await signIn();
    const catalog = await seedCatalog();
    await prisma.product.create({
      data: {
        sku: 'A1',
        name: 'Máy A',
        slug: 'may-a',
        price: 1_000_000,
        specs: { Pin: '5000mAh' },
        categoryId: catalog.accessories.id,
        brandId: catalog.anker.id,
      },
    });
    const template = (await download('template', 'update', token)).body;
    const res = await preview(template, 'update', token);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 1, ok: 1, failed: 0 });
  });
});

// ---------------------------------------------------------------------------
// Xem trước và nhập: thêm mới
// ---------------------------------------------------------------------------
describe('Thêm mới: xem trước', () => {
  it('báo từng dòng hợp lệ hay lỗi kèm đúng cột và lý do, đúng số dòng trong Excel, và không ghi gì vào CSDL', async () => {
    const token = await signIn();
    await seedCatalog();
    await prisma.product.create({
      data: {
        sku: 'DA-CO',
        name: 'Đã có',
        slug: 'da-co',
        price: 1000,
        categoryId: (await prisma.category.findFirst()).id,
        brandId: (await prisma.brand.findFirst()).id,
      },
    });
    const file = await workbook(
      [
        line({ SKU: 'OK-1' }), // dòng 2: hợp lệ
        line({ SKU: 'OK-2', 'Giá gốc': '2.500.000 đ', 'Giá khuyến mãi': '2.000.000' }), // dòng 3: giá dạng chữ vẫn nhận
        HEADERS.map(() => null), // dòng 4: trống, bỏ qua
        line({ SKU: 'LOI-GIA', 'Giá gốc': 99.5 }), // dòng 5
        line({ SKU: 'LOI-KM', 'Giá khuyến mãi': 10_000_000 }), // dòng 6: khuyến mãi không thấp hơn giá gốc
        line({ SKU: 'LOI-DM', 'Danh mục': 'Máy bay' }), // dòng 7
        line({ SKU: 'LOI-TH', 'Thương hiệu': 'Hãng lạ' }), // dòng 8
        line({ SKU: 'LOI TEN', 'Tên sản phẩm': 'x' }), // dòng 9: SKU có khoảng trắng
        line({ SKU: 'OK-1' }), // dòng 10: trùng dòng 2
        line({ SKU: 'DA-CO' }), // dòng 11: đã có trong hệ thống
        line({ SKU: 'LOI-TT', 'Thông số': 'Chỉ có tên' }), // dòng 12
        line({ SKU: 'LOI-HT', 'Hiển thị': 'có thể' }), // dòng 13
        line({ SKU: 'THIEU-TEN', 'Tên sản phẩm': null }), // dòng 14
      ],
      HEADERS,
    );

    const res = await preview(file, 'create', token);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('create');
    expect(res.body.summary).toEqual({ total: 12, ok: 2, failed: 10 });

    expect(byRow(res, 2)).toMatchObject({ sku: 'OK-1', status: 'OK', errors: [] });
    expect(byRow(res, 3)).toMatchObject({ sku: 'OK-2', status: 'OK' });
    expect(byRow(res, 4)).toBeUndefined();
    expect(messages(byRow(res, 5))).toEqual(['Giá gốc: Giá gốc phải là số nguyên']);
    expect(messages(byRow(res, 6))).toEqual([
      'Giá khuyến mãi: Giá khuyến mãi phải thấp hơn giá gốc',
    ]);
    expect(messages(byRow(res, 7))).toEqual([
      'Danh mục: Danh mục "Máy bay" không tồn tại trong hệ thống',
    ]);
    expect(messages(byRow(res, 8))).toEqual([
      'Thương hiệu: Thương hiệu "Hãng lạ" không tồn tại trong hệ thống',
    ]);
    expect(messages(byRow(res, 9))[0]).toContain('SKU: SKU chỉ gồm chữ, số');
    expect(messages(byRow(res, 10))).toEqual(['SKU: SKU trùng với dòng 2 trong file']);
    expect(messages(byRow(res, 11))[0]).toContain('SKU đã tồn tại trong hệ thống');
    expect(messages(byRow(res, 12))[0]).toContain('Thông số "Chỉ có tên" phải có dạng');
    expect(messages(byRow(res, 13))).toEqual(['Hiển thị: Hiển thị phải là "Có" hoặc "Không"']);
    expect(messages(byRow(res, 14))).toEqual(['Tên sản phẩm: Bắt buộc phải nhập']);

    // Xem trước tuyệt đối không ghi: vẫn chỉ có sản phẩm "DA-CO" có sẵn
    expect(await prisma.product.count()).toBe(1);
  });

  it('một dòng có nhiều lỗi thì báo đủ các lỗi', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await workbook([
      line({
        SKU: 'NHIEU',
        'Danh mục': 'Sai',
        'Thương hiệu': 'Sai',
        'Giá gốc': 'abc',
        'Tồn kho': -1,
      }),
    ]);
    const res = await preview(file, 'create', token);
    expect(
      byRow(res, 2)
        .errors.map((e) => e.column)
        .sort(),
    ).toEqual(['Danh mục', 'Giá gốc', 'Thương hiệu', 'Tồn kho'].sort());
  });

  it('cột lạ bị bỏ qua và được báo; tiêu đề không phân biệt dấu và hoa thường', async () => {
    const token = await signIn();
    await seedCatalog();
    const headers = ['sku', 'TEN SAN PHAM', 'danh muc', 'Thuong hieu', 'gia goc', 'Ghi chú nội bộ'];
    const file = await workbook(
      [['OK-1', 'Máy 1', 'Điện thoại', 'Apple', 5_000_000, 'bỏ qua']],
      headers,
    );
    const res = await preview(file, 'create', token);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 1, ok: 1, failed: 0 });
    expect(res.body.ignoredColumns).toEqual(['Ghi chú nội bộ']);
  });

  it('thiếu cột bắt buộc thì 400 và nêu tên cột còn thiếu', async () => {
    const token = await signIn();
    const file = await workbook([['A', 'Tên']], ['SKU', 'Tên sản phẩm']);
    const res = await preview(file, 'create', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMPORT_HEADERS_MISSING');
    expect(res.body.error.details.missing).toEqual(['Danh mục', 'Thương hiệu', 'Giá gốc']);
  });

  it('file chỉ có tiêu đề, hoặc toàn dòng trống, thì 400', async () => {
    const token = await signIn();
    const onlyHeader = await preview(await workbook([]), 'create', token);
    expect(onlyHeader.status).toBe(400);
    expect(onlyHeader.body.error.code).toBe('IMPORT_EMPTY');
    const blanks = await preview(await workbook([HEADERS.map(() => null)]), 'create', token);
    expect(blanks.body.error.code).toBe('IMPORT_EMPTY');
  });
});

describe('Thêm mới: nhập', () => {
  it('tạo các dòng hợp lệ với đúng dữ liệu: danh mục/thương hiệu theo tên, mặc định, thông số, slug', async () => {
    const token = await signIn();
    const catalog = await seedCatalog();
    const file = await workbook([
      line({
        SKU: 'ip15',
        'Tên sản phẩm': 'iPhone 15 Pro',
        'Danh mục': '  ĐIỆN  thoại ',
        'Thương hiệu': 'APPLE',
        'Giá gốc': '28.000.000',
        'Giá khuyến mãi': 26_000_000,
        'Tồn kho': 12,
        'Mô tả': 'Máy mới',
        'Thông số': 'Màn hình: 6.1 inch\nRAM: 8GB',
        'Hiển thị': 'Không',
      }),
      line({
        SKU: 'cap-1',
        'Tên sản phẩm': 'Cáp sạc',
        'Danh mục': 'Phụ kiện',
        'Thương hiệu': 'Anker',
        'Giá gốc': 290000,
      }),
    ]);

    const res = await runImport(file, 'create', token);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 2, created: 2, updated: 0, failed: 0 });
    expect(res.body.rows.map((row) => row.status)).toEqual(['CREATED', 'CREATED']);

    const full = await productBySku('IP15'); // SKU được chuẩn hóa in hoa
    expect(full).toMatchObject({
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      categoryId: catalog.phones.id,
      brandId: catalog.apple.id,
      price: 28_000_000,
      salePrice: 26_000_000,
      stock: 12,
      description: 'Máy mới',
      specs: { 'Màn hình': '6.1 inch', RAM: '8GB' },
      isActive: false,
    });
    const minimal = await productBySku('CAP-1'); // dùng mặc định cho các ô trống
    expect(minimal).toMatchObject({
      salePrice: null,
      stock: 0,
      description: '',
      specs: {},
      isActive: true,
      categoryId: catalog.accessories.id,
      brandId: catalog.anker.id,
    });
  });

  it('chỉ nhập các dòng đúng, dòng sai bị bỏ qua và báo lỗi, không làm hỏng dòng khác', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await workbook([
      line({ SKU: 'TOT-1' }),
      line({ SKU: 'LOI-1', 'Danh mục': 'Sai' }),
      line({ SKU: 'TOT-2', 'Tên sản phẩm': 'Máy tốt hai' }),
    ]);
    const res = await runImport(file, 'create', token);
    expect(res.body.summary).toEqual({ total: 3, created: 2, updated: 0, failed: 1 });
    expect(res.body.rows.map((row) => row.status)).toEqual(['CREATED', 'ERROR', 'CREATED']);
    expect(await productBySku('LOI-1')).toBeNull();
    expect(await prisma.product.count()).toBe(2);
  });

  it('nhập lại cùng một file: không tạo trùng, mọi dòng báo SKU đã tồn tại', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await workbook([
      line({ SKU: 'A-1' }),
      line({ SKU: 'A-2', 'Tên sản phẩm': 'Máy hai' }),
    ]);

    expect((await runImport(file, 'create', token)).body.summary.created).toBe(2);
    const again = await runImport(file, 'create', token);
    expect(again.body.summary).toEqual({ total: 2, created: 0, updated: 0, failed: 2 });
    expect(messages(again.body.rows[0])[0]).toContain('SKU đã tồn tại');
    expect(await prisma.product.count()).toBe(2);
  });

  it('không ghi đè sản phẩm đã có: thêm mới trùng SKU thì giữ nguyên dữ liệu cũ', async () => {
    const token = await signIn();
    const catalog = await seedCatalog();
    await prisma.product.create({
      data: {
        sku: 'GIU-NGUYEN',
        name: 'Tên cũ',
        slug: 'ten-cu',
        price: 5_000_000,
        stock: 3,
        categoryId: catalog.phones.id,
        brandId: catalog.apple.id,
      },
    });
    const file = await workbook([
      line({ SKU: 'GIU-NGUYEN', 'Tên sản phẩm': 'Tên mới', 'Giá gốc': 1_000_000 }),
    ]);
    const res = await runImport(file, 'create', token);

    expect(res.body.summary.failed).toBe(1);
    expect(await productBySku('GIU-NGUYEN')).toMatchObject({
      name: 'Tên cũ',
      price: 5_000_000,
      stock: 3,
    });
  });

  it('SKU vừa bị người khác tạo giữa lúc xem trước và nhập: dòng đó báo lỗi, không ghi đè', async () => {
    const token = await signIn();
    const catalog = await seedCatalog();
    const file = await workbook([
      line({ SKU: 'DUA-NHAU' }),
      line({ SKU: 'KHAC', 'Tên sản phẩm': 'Máy khác' }),
    ]);

    expect((await preview(file, 'create', token)).body.summary.ok).toBe(2);
    await prisma.product.create({
      data: {
        sku: 'DUA-NHAU',
        name: 'Người khác tạo',
        slug: 'nguoi-khac-tao',
        price: 1000,
        categoryId: catalog.phones.id,
        brandId: catalog.apple.id,
      },
    });

    const res = await runImport(file, 'create', token);
    expect(res.body.summary).toEqual({ total: 2, created: 1, updated: 0, failed: 1 });
    expect((await productBySku('DUA-NHAU')).name).toBe('Người khác tạo');
    expect(await productBySku('KHAC')).not.toBeNull();
  });

  it('hai sản phẩm trùng tên nhưng khác SKU vẫn tạo được (slug tự thêm SKU)', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await workbook([
      line({ SKU: 'TT-1', 'Tên sản phẩm': 'Cùng một tên' }),
      line({ SKU: 'TT-2', 'Tên sản phẩm': 'Cùng một tên' }),
    ]);
    const res = await runImport(file, 'create', token);
    expect(res.body.summary.created).toBe(2);
    const slugs = (await prisma.product.findMany()).map((p) => p.slug).sort();
    expect(new Set(slugs).size).toBe(2);
  });

  it('sản phẩm nhập vào hiện trong danh sách quản trị', async () => {
    const token = await signIn();
    await seedCatalog();
    await runImport(await workbook([line({ SKU: 'HIEN-1' })]), 'create', token);
    const list = await request(app).get('/api/admin/products').set(auth(token));
    expect(list.body.items.map((p) => p.sku)).toContain('HIEN-1');
  });
});

// ---------------------------------------------------------------------------
// Cập nhật
// ---------------------------------------------------------------------------
describe('Cập nhật', () => {
  const seedProduct = async (overrides = {}) => {
    const catalog = await seedCatalog();
    const product = await prisma.product.create({
      data: {
        sku: 'CU-1',
        name: 'Tên cũ',
        slug: 'ten-cu',
        description: 'Mô tả cũ',
        price: 10_000_000,
        salePrice: 9_000_000,
        stock: 5,
        specs: { Pin: '4000mAh' },
        isActive: true,
        categoryId: catalog.phones.id,
        brandId: catalog.apple.id,
        ...overrides,
      },
    });
    return { catalog, product };
  };
  const updateFile = (rows, headers) => workbook(rows, headers);

  it('chỉ đổi cột có giá trị, ô trống giữ nguyên', async () => {
    const token = await signIn();
    await seedProduct();
    const file = await updateFile([['cu-1', 12_000_000, null]], ['SKU', 'Giá gốc', 'Tồn kho']);
    const res = await runImport(file, 'update', token);

    expect(res.body.summary).toEqual({ total: 1, created: 0, updated: 1, failed: 0 });
    expect(res.body.rows[0].status).toBe('UPDATED');
    expect(await productBySku('CU-1')).toMatchObject({
      price: 12_000_000,
      stock: 5, // ô trống: giữ nguyên
      salePrice: 9_000_000,
      name: 'Tên cũ',
      description: 'Mô tả cũ',
      specs: { Pin: '4000mAh' },
    });
  });

  it('đổi được tên, danh mục, thương hiệu, hiển thị, thông số; không đổi SKU', async () => {
    const token = await signIn();
    const { catalog } = await seedProduct();
    const file = await updateFile(
      [['CU-1', 'Tên mới', 'phụ kiện', 'ANKER', 'Không', 'Pin: 5000mAh\nSạc: 20W', 'Mô tả mới']],
      ['SKU', 'Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Hiển thị', 'Thông số', 'Mô tả'],
    );
    const res = await runImport(file, 'update', token);
    expect(res.body.summary.updated).toBe(1);

    expect(await productBySku('CU-1')).toMatchObject({
      name: 'Tên mới',
      slug: 'ten-moi',
      categoryId: catalog.accessories.id,
      brandId: catalog.anker.id,
      isActive: false,
      specs: { Pin: '5000mAh', Sạc: '20W' },
      description: 'Mô tả mới',
    });
  });

  it('ghi "xóa" để bỏ giá khuyến mãi và xóa thông số', async () => {
    const token = await signIn();
    await seedProduct();
    const file = await updateFile([['CU-1', 'xóa', 'Xóa']], ['SKU', 'Giá khuyến mãi', 'Thông số']);
    const res = await runImport(file, 'update', token);
    expect(res.body.summary.updated).toBe(1);
    expect(await productBySku('CU-1')).toMatchObject({ salePrice: null, specs: {} });
  });

  it('SKU chưa có thì báo lỗi và bỏ qua, không tạo mới', async () => {
    const token = await signIn();
    await seedProduct();
    const file = await updateFile(
      [
        ['KHONG-CO', 1_000_000],
        ['CU-1', 11_000_000],
      ],
      ['SKU', 'Giá gốc'],
    );
    const res = await runImport(file, 'update', token);

    expect(res.body.summary).toEqual({ total: 2, created: 0, updated: 1, failed: 1 });
    expect(messages(res.body.rows[0])[0]).toContain('SKU không tồn tại trong hệ thống');
    expect(await productBySku('KHONG-CO')).toBeNull();
    expect((await productBySku('CU-1')).price).toBe(11_000_000);
  });

  it('giá khuyến mãi mới phải thấp hơn giá hiện có (BR-02), kể cả khi dòng chỉ sửa một giá', async () => {
    const token = await signIn();
    await seedProduct(); // giá 10.000.000, khuyến mãi 9.000.000
    const tooHigh = await updateFile([['CU-1', 10_500_000]], ['SKU', 'Giá khuyến mãi']);
    const first = await preview(tooHigh, 'update', token);
    expect(messages(first.body.rows[0])).toEqual([
      'Giá khuyến mãi: Giá khuyến mãi phải thấp hơn giá gốc',
    ]);

    // Hạ giá gốc xuống dưới giá khuyến mãi đang có cũng sai
    const lowerPrice = await updateFile([['CU-1', 8_000_000]], ['SKU', 'Giá gốc']);
    const second = await runImport(lowerPrice, 'update', token);
    expect(second.body.summary.failed).toBe(1);
    expect((await productBySku('CU-1')).price).toBe(10_000_000);

    // Hạ cả hai cùng lúc thì hợp lệ
    const both = await updateFile(
      [['CU-1', 8_000_000, 7_000_000]],
      ['SKU', 'Giá gốc', 'Giá khuyến mãi'],
    );
    expect((await runImport(both, 'update', token)).body.summary.updated).toBe(1);
  });

  it('dòng chỉ có SKU mà không có gì để sửa thì báo lỗi', async () => {
    const token = await signIn();
    await seedProduct();
    const file = await updateFile([['CU-1', null]], ['SKU', 'Giá gốc']);
    const res = await preview(file, 'update', token);
    expect(res.body.summary.failed).toBe(1);
    expect(res.body.rows[0].errors[0].message).toContain('Không có dữ liệu để cập nhật');
  });

  it('file cập nhật chỉ có cột SKU, hoặc không có cột SKU, thì 400', async () => {
    const token = await signIn();
    await seedProduct();
    const onlySku = await preview(await updateFile([['CU-1']], ['SKU']), 'update', token);
    expect(onlySku.status).toBe(400);
    expect(onlySku.body.error.code).toBe('IMPORT_HEADERS_MISSING');
    const noSku = await preview(await updateFile([[1_000_000]], ['Giá gốc']), 'update', token);
    expect(noSku.status).toBe(400);
    expect(noSku.body.error.details.missing).toEqual(['SKU']);
  });

  it('cập nhật không đụng tới ảnh và đơn hàng đã đặt (đơn lưu bản sao tên, giá)', async () => {
    const token = await signIn();
    const { product } = await seedProduct();
    await prisma.productImage.create({
      data: { productId: product.id, url: '/uploads/a.png', sortOrder: 0 },
    });
    const customer = await createUser({ email: 'k@example.com' });
    await prisma.order.create({
      data: {
        code: 'TS261030-ABCD',
        userId: customer.id,
        subtotal: 9_000_000,
        shippingFee: 0,
        total: 9_000_000,
        recipientName: 'A',
        phone: '0900000000',
        shippingAddress: 'B',
        items: {
          create: [
            {
              productId: product.id,
              productName: 'Tên cũ',
              productSku: 'CU-1',
              unitPrice: 9_000_000,
              quantity: 1,
            },
          ],
        },
      },
    });

    const file = await updateFile(
      [['CU-1', 'Tên rất khác', 1_000_000]],
      ['SKU', 'Tên sản phẩm', 'Giá gốc'],
    );
    expect((await runImport(file, 'update', token)).body.summary.failed).toBe(1); // 1.000.000 < giá khuyến mãi 9.000.000
    const fixed = await updateFile(
      [['CU-1', 'Tên rất khác', 1_000_000, 'xóa']],
      ['SKU', 'Tên sản phẩm', 'Giá gốc', 'Giá khuyến mãi'],
    );
    expect((await runImport(fixed, 'update', token)).body.summary.updated).toBe(1);

    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(1);
    const item = await prisma.orderItem.findFirst({ where: { productId: product.id } });
    expect(item).toMatchObject({ productName: 'Tên cũ', unitPrice: 9_000_000 }); // BR-04
  });
});

// ---------------------------------------------------------------------------
// Kiểm tra file tải lên
// ---------------------------------------------------------------------------
describe('Kiểm tra file tải lên', () => {
  it('không chọn file thì 400', async () => {
    const token = await signIn();
    const res = await request(app)
      .post('/api/admin/products/import/preview')
      .query({ mode: 'create' })
      .set(auth(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMPORT_NO_FILE');
  });

  it('file không phải .xlsx (kể cả đổi đuôi) bị từ chối dựa vào nội dung thật', async () => {
    const token = await signIn();
    for (const [name, content] of [
      ['san-pham.xlsx', Buffer.from('SKU,Tên\nA,B\n')], // CSV đổi đuôi
      ['san-pham.xls', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], // Excel cũ
      ['anh.xlsx', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], // ảnh PNG
    ]) {
      const res = await upload('/preview', content, 'create', token, name);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('IMPORT_NOT_XLSX');
    }
  });

  it('file zip hỏng hoặc không phải bảng tính thì 400, không làm sập máy chủ', async () => {
    const token = await signIn();
    const brokenZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rac khong phai zip'),
    ]);
    const res = await upload('/preview', brokenZip, 'create', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMPORT_INVALID_FILE');
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('file lớn hơn 2MB thì 413', async () => {
    const token = await signIn();
    const big = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(2 * 1024 * 1024 + 10),
    ]);
    const res = await upload('/preview', big, 'create', token);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('IMPORT_FILE_TOO_LARGE');
  });

  it('quá 500 dòng thì 400, đúng 500 dòng thì nhận', async () => {
    const token = await signIn();
    await seedCatalog();
    const rows = (count) =>
      Array.from({ length: count }, (_, i) =>
        line({ SKU: `SKU-${i + 1}`, 'Tên sản phẩm': `Máy ${i + 1}` }),
      );

    const over = await preview(await workbook(rows(501)), 'create', token);
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('IMPORT_TOO_MANY_ROWS');

    const exact = await preview(await workbook(rows(500)), 'create', token);
    expect(exact.status).toBe(200);
    expect(exact.body.summary).toEqual({ total: 500, ok: 500, failed: 0 });
  });

  it('chỉ đọc trang tính đầu tiên, các trang khác (hướng dẫn, danh mục) không bị coi là dữ liệu', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await writeExcelFile([
      { sheet: 'Sản phẩm', data: [HEADERS, line({ SKU: 'TRANG-1' })] },
      { sheet: 'Ghi chú', data: [['SKU'], ['KHONG-DUOC-DOC']] },
    ]).toBuffer();
    const res = await preview(file, 'create', token);
    expect(res.body.summary.total).toBe(1);
  });

  it('chuỗi giống công thức trong ô chỉ được coi là chữ, không bị thực thi hay tạo ra giá trị khác', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await workbook([
      line({ SKU: 'CT-1', 'Tên sản phẩm': '=HYPERLINK("http://x","y")' }),
    ]);
    const res = await runImport(file, 'create', token);
    expect(res.body.summary.created).toBe(1);
    expect((await productBySku('CT-1')).name).toBe('=HYPERLINK("http://x","y")');
  });
});

// ---------------------------------------------------------------------------
// Tải các dòng lỗi
// ---------------------------------------------------------------------------
describe('POST /api/admin/products/import/errors', () => {
  it('trả file chỉ gồm các dòng sai (giữ nguyên ô đã nhập) kèm cột "Lỗi" để sửa rồi nhập lại', async () => {
    const token = await signIn();
    await seedCatalog();
    const file = await workbook([
      line({ SKU: 'TOT-1' }),
      line({ SKU: 'SAI-1', 'Danh mục': 'Máy bay', 'Giá gốc': '1.234.567' }),
      line({ SKU: 'SAI-2', 'Giá khuyến mãi': 99_000_000 }),
    ]);
    const res = await upload('/errors', file, 'create', token).buffer(true).parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(XLSX);
    expect(res.headers['content-disposition']).toContain('dong-loi.xlsx');
    const data = await readSheet(res.body);
    expect(data[0]).toEqual([...HEADERS, 'Lỗi']);
    expect(data).toHaveLength(3); // tiêu đề + 2 dòng sai, không có dòng TOT-1
    expect(data[1][0]).toBe('SAI-1');
    expect(data[1][4]).toBe('1.234.567'); // giữ nguyên nội dung ô
    expect(data[1].at(-1)).toContain('Danh mục: Danh mục "Máy bay" không tồn tại');
    expect(data[2][0]).toBe('SAI-2');
    expect(data[2].at(-1)).toContain('Giá khuyến mãi phải thấp hơn giá gốc');
  });

  it('file lỗi sửa xong tải lên lại thì nhập được (vòng sửa và nhập lại)', async () => {
    const token = await signIn();
    await seedCatalog();
    const bad = await workbook([line({ SKU: 'SUA-LAI', 'Danh mục': 'Điện thoai' })]); // gõ sai dấu
    const errors = await upload('/errors', bad, 'create', token).buffer(true).parse(binary);
    const rows = (await readSheet(errors.body)).slice(1).map((row) => row.slice(0, -1)); // bỏ cột Lỗi
    rows[0][2] = 'Điện thoại'; // sửa lại cho đúng

    const fixed = await workbook(rows);
    const res = await runImport(fixed, 'create', token);
    expect(res.body.summary.created).toBe(1);
    expect(await productBySku('SUA-LAI')).not.toBeNull();
  });

  it('file không có dòng nào lỗi thì 400', async () => {
    const token = await signIn();
    await seedCatalog();
    const res = await upload('/errors', await workbook([line()]), 'create', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMPORT_NO_ERRORS');
  });
});
