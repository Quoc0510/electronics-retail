/**
 * @feature [F14] Nhập sản phẩm từ Excel - Nghiệp vụ nhập hàng loạt từ file .xlsx (US-35 thêm mới, US-36 cập nhật).
 *
 * Hai chế độ tách riêng để không sửa nhầm: "create" chỉ thêm sản phẩm mới (SKU đã có thì báo lỗi và bỏ qua dòng đó), "update"
 * chỉ sửa sản phẩm đã có (SKU chưa có thì báo lỗi và bỏ qua). Luồng của Admin gồm hai bước:
 *   1. Xem trước (previewImport): đọc và kiểm tra từng dòng, KHÔNG ghi gì vào CSDL; dòng sai được báo kèm đúng cột và lý do.
 *   2. Nhập (runImport): đọc và kiểm tra lại file từ đầu rồi chỉ ghi các dòng hợp lệ. Máy chủ không lưu gì giữa hai bước và không
 *      tin dữ liệu Client gửi lên, nên nếu dữ liệu đổi giữa hai bước (ai đó vừa thêm cùng SKU) thì dòng đó báo lỗi thay vì ghi sai.
 *
 * Mỗi dòng đi qua đúng hàm tạo/sửa của trang quản lý sản phẩm (createProduct/updateProduct) nên mọi quy tắc đều giống thao tác
 * tay: SKU duy nhất, giá khuyến mãi thấp hơn giá gốc (BR-02), danh mục và thương hiệu có thật, sinh slug. Mỗi dòng là một thao tác
 * độc lập: dòng lỗi không làm hỏng các dòng khác. Ảnh sản phẩm không nằm trong file (tải riêng ở trang sửa sản phẩm).
 */
import { readSheet } from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';
import {
  COLUMNS,
  REQUIRED_COLUMNS,
  cellText,
  formatSpecs,
  headerOf,
  isBlank,
  isClearKeyword,
  mapHeaders,
  normalizeName,
  parseSpecs,
  parseVisibility,
  parseWholeNumber,
} from '../lib/productImport.js';
import {
  createProductSchema,
  skuSchema,
  updateProductSchema,
} from '../validators/product.validator.js';
import { createProduct, updateProduct } from './product.service.js';

export const MAX_IMPORT_ROWS = 500;
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // .xlsx là file zip

// Tên trường của API sản phẩm -> tên cột để báo lỗi đúng chỗ
const FIELD_COLUMN = {
  sku: 'sku',
  name: 'name',
  categoryId: 'category',
  brandId: 'brand',
  price: 'price',
  salePrice: 'salePrice',
  stock: 'stock',
  description: 'description',
  specs: 'specs',
  isActive: 'isActive',
};

const invalidFile = (message, code = 'IMPORT_INVALID_FILE') => new AppError(400, message, code);

// ---------------------------------------------------------------------------
// Đọc file
// ---------------------------------------------------------------------------

/** Kiểm tra bằng nội dung thật (không tin đuôi file) rồi đọc trang tính đầu tiên thành mảng các dòng. */
const readRows = async (buffer) => {
  if (!buffer || buffer.length < 4 || !buffer.subarray(0, 4).equals(XLSX_MAGIC)) {
    throw invalidFile(
      'File phải là Excel định dạng .xlsx (Excel cũ .xls hay CSV chưa được hỗ trợ)',
      'IMPORT_NOT_XLSX',
    );
  }
  try {
    return await readSheet(buffer);
  } catch (error) {
    logger.warn(`Không đọc được file Excel: ${error.message}`);
    throw invalidFile('Không đọc được file Excel, file có thể bị hỏng');
  }
};

const rowIsEmpty = (cells) => cells.every(isBlank);

/**
 * Tách dòng tiêu đề và các dòng dữ liệu (bỏ dòng trống). Dòng đầu tiên không trống là tiêu đề; số dòng báo cho Admin là
 * số dòng thật trong Excel (dòng 1 là dòng đầu của trang tính).
 */
const splitSheet = async (buffer, mode) => {
  const rows = await readRows(buffer);
  const headerAt = rows.findIndex((cells) => !rowIsEmpty(cells));
  if (headerAt === -1) throw invalidFile('File trống, chưa có dòng tiêu đề', 'IMPORT_EMPTY');

  const { index, unknown } = mapHeaders(rows[headerAt]);
  const missing = REQUIRED_COLUMNS[mode].filter((key) => index[key] === undefined);
  if (missing.length > 0) {
    throw new AppError(
      400,
      `Thiếu cột bắt buộc: ${missing.map(headerOf).join(', ')}. Hãy dùng đúng file mẫu`,
      'IMPORT_HEADERS_MISSING',
      { missing: missing.map(headerOf) },
    );
  }
  if (mode === 'update' && Object.keys(index).length < 2) {
    throw new AppError(
      400,
      'File cập nhật cần thêm ít nhất một cột cần sửa ngoài SKU',
      'IMPORT_HEADERS_MISSING',
    );
  }

  const dataRows = rows
    .map((cells, position) => ({ rowNumber: position + 1, cells }))
    .filter((row, position) => position > headerAt && !rowIsEmpty(row.cells));
  if (dataRows.length === 0) throw invalidFile('File chưa có dòng dữ liệu nào', 'IMPORT_EMPTY');
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new AppError(
      400,
      `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng (file có ${dataRows.length} dòng)`,
      'IMPORT_TOO_MANY_ROWS',
    );
  }
  return { headerCells: rows[headerAt], headerAt, index, unknown, dataRows };
};

// ---------------------------------------------------------------------------
// Kiểm tra từng dòng (không ghi CSDL)
// ---------------------------------------------------------------------------

const mapByName = (list) => new Map(list.map((item) => [normalizeName(item.name), item]));

/**
 * Lập kế hoạch nhập: kiểm tra từng dòng và quyết định dòng nào hợp lệ. Không ghi CSDL.
 * @param {Buffer} buffer nội dung file .xlsx
 * @param {'create'|'update'} mode
 */
export const buildPlan = async (buffer, mode) => {
  const sheet = await splitSheet(buffer, mode);
  const { index, dataRows } = sheet;

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
  ]);
  const categoryByName = mapByName(categories);
  const brandByName = mapByName(brands);

  // Một truy vấn lấy mọi sản phẩm có SKU trong file, thay vì mỗi dòng một truy vấn
  const skus = [
    ...new Set(
      dataRows
        .map((row) => skuSchema.safeParse(cellText(row.cells[index.sku])))
        .filter((parsed) => parsed.success)
        .map((parsed) => parsed.data),
    ),
  ];
  const existing = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true, price: true, salePrice: true },
  });
  const existingBySku = new Map(existing.map((product) => [product.sku, product]));

  const seen = new Map(); // SKU -> số dòng đầu tiên trong file
  const rows = dataRows.map(({ rowNumber, cells }) => {
    const errors = [];
    const addError = (key, message) => errors.push({ column: key ? headerOf(key) : null, message });
    const read = (key) => (index[key] === undefined ? undefined : cells[index[key]]);

    // --- SKU: định danh dòng, kiểm tra trước vì mọi thứ khác phụ thuộc vào nó ---
    const skuResult = skuSchema.safeParse(cellText(read('sku')));
    let sku = cellText(read('sku')).toUpperCase();
    let product = null;
    if (!skuResult.success) {
      addError('sku', skuResult.error.issues[0].message);
    } else {
      sku = skuResult.data;
      if (seen.has(sku)) addError('sku', `SKU trùng với dòng ${seen.get(sku)} trong file`);
      else seen.set(sku, rowNumber);
      product = existingBySku.get(sku) ?? null;
      if (mode === 'create' && product)
        addError('sku', 'SKU đã tồn tại trong hệ thống (dùng chế độ Cập nhật để sửa)');
      if (mode === 'update' && !product)
        addError('sku', 'SKU không tồn tại trong hệ thống (dùng chế độ Thêm mới để tạo)');
    }

    // --- Các cột còn lại: ô trống = không nhập; dùng chung một cách đọc cho cả hai chế độ ---
    const payload = {};
    const put = (key, field, parsed) => {
      if (parsed === undefined) return;
      if (!parsed.ok) addError(key, parsed.message);
      else payload[field] = parsed.value;
    };

    const name = cellText(read('name'));
    if (name) payload.name = name;
    const description = cellText(read('description'));
    if (description) payload.description = description;

    const lookup = (key, field, byName, label) => {
      const text = cellText(read(key));
      if (!text) return;
      const found = byName.get(normalizeName(text));
      if (found) payload[field] = found.id;
      else addError(key, `${label} "${text}" không tồn tại trong hệ thống`);
    };
    lookup('category', 'categoryId', categoryByName, 'Danh mục');
    lookup('brand', 'brandId', brandByName, 'Thương hiệu');

    const whole = (key, label) =>
      isBlank(read(key)) ? undefined : parseWholeNumber(read(key), label);
    put('price', 'price', whole('price', 'Giá gốc'));
    put('stock', 'stock', whole('stock', 'Tồn kho'));

    const salePriceCell = read('salePrice');
    if (isClearKeyword(salePriceCell))
      payload.salePrice = null; // "xóa" = bỏ giá khuyến mãi
    else put('salePrice', 'salePrice', whole('salePrice', 'Giá khuyến mãi'));

    const specsCell = read('specs');
    if (isClearKeyword(specsCell)) payload.specs = {};
    else if (!isBlank(specsCell)) put('specs', 'specs', parseSpecs(specsCell));

    if (!isBlank(read('isActive'))) put('isActive', 'isActive', parseVisibility(read('isActive')));

    // Thêm mới: các cột cốt lõi bắt buộc phải có giá trị (cột có mặt trong file nhưng ô để trống vẫn là thiếu)
    if (mode === 'create') {
      for (const key of REQUIRED_COLUMNS.create.filter((required) => required !== 'sku')) {
        if (isBlank(read(key))) addError(key, 'Bắt buộc phải nhập');
      }
    }

    // --- Quy tắc nghiệp vụ dùng chung với trang quản lý sản phẩm (cùng schema Zod) ---
    if (errors.length === 0) {
      const schema = mode === 'create' ? createProductSchema : updateProductSchema;
      const parsed = schema.safeParse(mode === 'create' ? { ...payload, sku } : payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          addError(FIELD_COLUMN[issue.path[0]], issue.message);
        }
      } else if (mode === 'update' && product) {
        // BR-02: Zod chỉ so sánh khi cả hai giá cùng có trong dòng; ở đây so với giá đang lưu của sản phẩm
        const nextPrice = parsed.data.price ?? product.price;
        const nextSale =
          parsed.data.salePrice === undefined ? product.salePrice : parsed.data.salePrice;
        if (nextSale != null && nextSale >= nextPrice) {
          addError('salePrice', 'Giá khuyến mãi phải thấp hơn giá gốc');
        }
      }
      if (errors.length === 0) {
        return {
          rowNumber,
          cells,
          sku,
          errors,
          payload: parsed.data,
          productId: product?.id ?? null,
        };
      }
    }
    return { rowNumber, cells, sku, errors, payload: null, productId: product?.id ?? null };
  });

  return { mode, sheet, rows };
};

const summarize = (rows) => ({
  total: rows.length,
  ok: rows.filter((row) => row.errors.length === 0).length,
  failed: rows.filter((row) => row.errors.length > 0).length,
});

const toRowDto = (row, status = row.errors.length > 0 ? 'ERROR' : 'OK') => ({
  row: row.rowNumber,
  sku: row.sku,
  status,
  errors: row.errors,
});

/** Bước 1: xem trước, không ghi gì. */
export const previewImport = async (buffer, mode) => {
  const plan = await buildPlan(buffer, mode);
  return {
    mode,
    summary: summarize(plan.rows),
    ignoredColumns: plan.sheet.unknown,
    rows: plan.rows.map((row) => toRowDto(row)),
  };
};

/** Bước 2: ghi các dòng hợp lệ, mỗi dòng là một thao tác độc lập; trả kết quả từng dòng. */
export const runImport = async (buffer, mode) => {
  const plan = await buildPlan(buffer, mode);
  const results = [];
  let created = 0;
  let updated = 0;

  for (const row of plan.rows) {
    if (row.errors.length > 0) {
      results.push(toRowDto(row));
      continue;
    }
    try {
      if (mode === 'create') {
        await createProduct(row.payload);
        created += 1;
        results.push(toRowDto(row, 'CREATED'));
      } else {
        await updateProduct(row.productId, row.payload);
        updated += 1;
        results.push(toRowDto(row, 'UPDATED'));
      }
    } catch (error) {
      // Lỗi nghiệp vụ (ví dụ vừa có người thêm cùng SKU) hay lỗi bất ngờ đều chỉ làm hỏng dòng này
      if (!(error instanceof AppError))
        logger.error(`Nhập sản phẩm lỗi ở dòng ${row.rowNumber}: ${error.stack}`);
      const message = error instanceof AppError ? error.message : 'Không lưu được dòng này';
      results.push({ ...toRowDto(row, 'ERROR'), errors: [{ column: null, message }] });
    }
  }

  const failed = results.filter((row) => row.status === 'ERROR').length;
  logger.info(`Nhập sản phẩm từ Excel (${mode}): ${created} thêm, ${updated} sửa, ${failed} lỗi`);
  return {
    mode,
    summary: { total: results.length, created, updated, failed },
    ignoredColumns: plan.sheet.unknown,
    rows: results,
  };
};

// ---------------------------------------------------------------------------
// Tạo file Excel: mẫu, và danh sách dòng lỗi để sửa
// ---------------------------------------------------------------------------

const header = (text) => ({ value: text, fontWeight: 'bold', backgroundColor: '#E0E7FF' });
const widths = COLUMNS.map((column) => ({ width: column.width }));
const toBuffer = (sheets) => writeExcelFile(sheets).toBuffer();

const GUIDE = {
  create: [
    'HƯỚNG DẪN NHẬP SẢN PHẨM MỚI',
    `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng, file .xlsx, dòng đầu là tiêu đề cột (đừng đổi tên cột).`,
    'Bắt buộc: SKU, Tên sản phẩm, Danh mục, Thương hiệu, Giá gốc. Các cột khác bỏ trống thì dùng mặc định (tồn kho 0, hiển thị Có).',
    'SKU gồm chữ, số và các ký tự . _ - (không phân biệt hoa thường). SKU đã có trong hệ thống thì dòng đó bị bỏ qua và báo lỗi.',
    'Danh mục và Thương hiệu ghi đúng tên đã có (xem trang "Danh mục và thương hiệu"), không phân biệt hoa thường. Tên chưa có thì dòng bị báo lỗi.',
    'Giá là số nguyên đồng, ví dụ 1500000 hoặc 1.500.000. Giá khuyến mãi phải thấp hơn giá gốc, bỏ trống nếu không khuyến mãi.',
    'Thông số: mỗi thông số một dòng (Alt+Enter) hoặc cách nhau dấu chấm phẩy, dạng "Tên: giá trị". Ví dụ: Màn hình: 6.1 inch; RAM: 8GB.',
    'Hiển thị: Có hoặc Không. Ảnh sản phẩm không nhập bằng Excel, hãy tải ở trang sửa sản phẩm.',
    'Sau khi tải file lên, bạn sẽ được xem trước: dòng đúng và dòng sai kèm lý do. Chỉ các dòng đúng được nhập.',
  ],
  update: [
    'HƯỚNG DẪN CẬP NHẬT SẢN PHẨM',
    `File này đã điền sẵn sản phẩm hiện có (tối đa ${MAX_IMPORT_ROWS} sản phẩm mới nhất). Sửa ô nào muốn đổi rồi tải lên lại; xóa bớt các dòng không cần sửa.`,
    'Chỉ SKU là bắt buộc (dùng để tìm sản phẩm, không đổi được SKU). SKU chưa có trong hệ thống thì dòng bị bỏ qua và báo lỗi.',
    'Ô để trống nghĩa là GIỮ NGUYÊN giá trị hiện có. Muốn bỏ giá khuyến mãi hoặc xóa hết thông số thì ghi chữ "xóa" vào ô đó.',
    'Quy tắc ô giống file thêm mới: giá là số nguyên đồng, giá khuyến mãi thấp hơn giá gốc, danh mục và thương hiệu ghi đúng tên đã có.',
    'Ảnh sản phẩm không đổi bằng Excel.',
  ],
};

/** File mẫu cho Admin tải về; chế độ cập nhật điền sẵn các sản phẩm hiện có để sửa. */
export const buildTemplate = async (mode) => {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { name: true, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.brand.findMany({ select: { name: true, isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  const products =
    mode === 'update'
      ? await prisma.product.findMany({
          orderBy: { id: 'desc' },
          take: MAX_IMPORT_ROWS,
          include: { category: { select: { name: true } }, brand: { select: { name: true } } },
        })
      : [];

  const cell = (value) => (value === null || value === undefined || value === '' ? null : value);
  const productRows = products.map((product) => [
    product.sku,
    product.name,
    product.category.name,
    product.brand.name,
    product.price,
    cell(product.salePrice),
    product.stock,
    cell(product.description),
    cell(formatSpecs(product.specs)),
    product.isActive ? 'Có' : 'Không',
  ]);

  const names = (list) => list.map((item) => item.name + (item.isActive ? '' : ' (đang ẩn)'));
  const count = Math.max(categories.length, brands.length);
  const lookupRows = Array.from({ length: count }, (_, i) => [
    names(categories)[i] ?? null,
    names(brands)[i] ?? null,
  ]);

  return toBuffer([
    {
      sheet: 'Sản phẩm',
      data: [COLUMNS.map((column) => header(column.header)), ...productRows],
      columns: widths,
      stickyRowsCount: 1,
    },
    {
      sheet: 'Danh mục và thương hiệu',
      data: [[header('Danh mục'), header('Thương hiệu')], ...lookupRows],
      columns: [{ width: 28 }, { width: 28 }],
    },
    {
      sheet: 'Hướng dẫn',
      data: GUIDE[mode].map((line, i) => [i === 0 ? { value: line, fontWeight: 'bold' } : line]),
      columns: [{ width: 120 }],
    },
  ]);
};

/**
 * File chứa CHỈ các dòng sai (giữ nguyên nội dung ô đã nhập) kèm cột "Lỗi", để Admin sửa rồi tải lên lại.
 * Dùng ở bước xem trước, trước khi nhập (sau khi nhập thì các dòng đúng đã vào hệ thống nên không còn là "sai" nữa).
 */
export const buildErrorFile = async (buffer, mode) => {
  const plan = await buildPlan(buffer, mode);
  const failed = plan.rows.filter((row) => row.errors.length > 0);
  if (failed.length === 0) {
    throw new AppError(400, 'File không có dòng nào bị lỗi', 'IMPORT_NO_ERRORS');
  }
  const width = Math.max(plan.sheet.headerCells.length, 1);
  const pad = (cells) =>
    Array.from({ length: width }, (_, i) => (isBlank(cells[i]) ? null : cells[i]));
  const describe = (row) =>
    row.errors
      .map((error) => (error.column ? `${error.column}: ${error.message}` : error.message))
      .join('; ');

  return toBuffer([
    {
      sheet: 'Dòng lỗi',
      data: [
        [...pad(plan.sheet.headerCells).map((text) => header(text ?? '')), header('Lỗi')],
        ...failed.map((row) => [...pad(row.cells), describe(row)]),
      ],
      columns: [...Array.from({ length: width }, () => ({ width: 20 })), { width: 70 }],
      stickyRowsCount: 1,
    },
  ]);
};
