/**
 * @feature [F14] Nhập sản phẩm từ Excel - Các hàm thuần để đọc từng ô của file Excel (US-35, US-36): tiêu đề cột, số tiền, số
 * lượng, thông số, hiển thị. Không đụng CSDL nên test được riêng. Mỗi hàm trả `{ ok: true, value }` hoặc
 * `{ ok: false, message }` để service gom lỗi theo từng ô và báo đúng cột, đúng dòng cho Admin.
 *
 * Quy ước của file: dòng đầu là tiêu đề cột; ô trống nghĩa là "không nhập" (khi thêm mới thì dùng mặc định, khi cập nhật thì
 * giữ nguyên giá trị hiện có); riêng giá khuyến mãi và thông số có từ khóa "xóa" để xóa giá trị đang có.
 */

/** Các cột của file, theo thứ tự trong file mẫu. `key` khớp với tên trường của API sản phẩm. */
export const COLUMNS = [
  { key: 'sku', header: 'SKU', width: 16 },
  { key: 'name', header: 'Tên sản phẩm', width: 38 },
  { key: 'category', header: 'Danh mục', width: 20 },
  { key: 'brand', header: 'Thương hiệu', width: 18 },
  { key: 'price', header: 'Giá gốc', width: 14 },
  { key: 'salePrice', header: 'Giá khuyến mãi', width: 16 },
  { key: 'stock', header: 'Tồn kho', width: 10 },
  { key: 'description', header: 'Mô tả', width: 40 },
  { key: 'specs', header: 'Thông số', width: 40 },
  { key: 'isActive', header: 'Hiển thị', width: 10 },
];

/** Cột bắt buộc phải CÓ trong file theo chế độ: thêm mới cần đủ thông tin cốt lõi, cập nhật chỉ cần SKU để nhận diện. */
export const REQUIRED_COLUMNS = {
  create: ['sku', 'name', 'category', 'brand', 'price'],
  update: ['sku'],
};

export const headerOf = (key) => COLUMNS.find((column) => column.key === key).header;

const stripMarks = (text) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/** Tên cột để so khớp: không phân biệt hoa thường, dấu tiếng Việt và khoảng trắng thừa ("Gia goc" vẫn nhận). */
export const normalizeHeader = (text) => collapse(stripMarks(String(text ?? ''))).toLowerCase();

/** Tên danh mục/thương hiệu để so khớp: không phân biệt hoa thường và khoảng trắng thừa, GIỮ dấu (tránh khớp nhầm tên khác). */
export const normalizeName = (text) => collapse(String(text ?? '').normalize('NFC')).toLowerCase();

const COLUMN_BY_HEADER = new Map(
  COLUMNS.map((column) => [normalizeHeader(column.header), column.key]),
);

/**
 * Tìm vị trí từng cột trong dòng tiêu đề.
 * @returns {{ index: Record<string, number>, unknown: string[] }} cột nào có mặt ở vị trí nào, và các tiêu đề lạ (bị bỏ qua)
 */
export const mapHeaders = (headerRow) => {
  const index = {};
  const unknown = [];
  headerRow.forEach((cell, position) => {
    const text = collapse(String(cell ?? ''));
    if (!text) return;
    const key = COLUMN_BY_HEADER.get(normalizeHeader(text));
    if (key && index[key] === undefined) index[key] = position;
    else unknown.push(text);
  });
  return { index, unknown };
};

/** Ô có nội dung không (null, chuỗi rỗng hay chỉ có khoảng trắng đều coi là trống). */
export const isBlank = (cell) => cell === null || cell === undefined || String(cell).trim() === '';

export const cellText = (cell) => (isBlank(cell) ? '' : String(cell).trim());

const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, message });

const CLEAR_KEYWORD = /^(xóa|xoá|xoa|clear)$/i;
export const isClearKeyword = (cell) => typeof cell === 'string' && CLEAR_KEYWORD.test(cell.trim());

// Dấu phân cách hàng nghìn đúng chuẩn: 1.500.000 hoặc 1,500,000 (nhóm ba chữ số). "1,5" hay "1.5" bị từ chối vì dễ hiểu sai
const GROUPED = /^\d{1,3}([.,]\d{3})+$/;

/**
 * Số nguyên không âm từ ô Excel: ô số (phải nguyên) hoặc chuỗi như "1500000", "1.500.000", "1,500,000", "1.500.000 đ".
 * Không nhận số thập phân vì mọi số tiền lưu bằng đồng nguyên (BR-01).
 */
export const parseWholeNumber = (cell, label) => {
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || !Number.isInteger(cell))
      return fail(`${label} phải là số nguyên`);
    if (cell < 0) return fail(`${label} không được âm`);
    return ok(cell);
  }
  const text = cellText(cell)
    .replace(/(₫|vnđ|vnd|đ)$/i, '')
    .replace(/\s+/g, '');
  if (/^\d+$/.test(text) || GROUPED.test(text)) return ok(Number(text.replace(/[.,]/g, '')));
  return fail(`${label} phải là số nguyên (ví dụ 1500000 hoặc 1.500.000)`);
};

const YES = new Set(['co', 'yes', 'y', 'true', '1', 'hien', 'x']);
const NO = new Set(['khong', 'no', 'n', 'false', '0', 'an']);

/** Cột "Hiển thị": Có/Không (cũng nhận Yes/No, 1/0, true/false, Hiện/Ẩn). */
export const parseVisibility = (cell) => {
  if (typeof cell === 'boolean') return ok(cell);
  const text = normalizeHeader(cell);
  if (YES.has(text)) return ok(true);
  if (NO.has(text)) return ok(false);
  return fail('Hiển thị phải là "Có" hoặc "Không"');
};

/**
 * Cột "Thông số": mỗi thông số là "Tên: giá trị", cách nhau bằng xuống dòng (Alt+Enter) hoặc dấu chấm phẩy.
 * Chỉ cần dấu hai chấm đầu tiên để tách tên và giá trị nên giá trị có thể chứa dấu hai chấm (ví dụ "Tỉ lệ: 16:9").
 */
export const parseSpecs = (cell) => {
  const specs = {};
  const parts = cellText(cell)
    .split(/[\n;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const colon = part.indexOf(':');
    const name = colon > 0 ? part.slice(0, colon).trim() : '';
    const value = colon > 0 ? part.slice(colon + 1).trim() : '';
    if (!name || !value) return fail(`Thông số "${part}" phải có dạng "Tên: giá trị"`);
    if (name in specs) return fail(`Thông số "${name}" bị lặp`);
    specs[name] = value;
  }
  return ok(specs);
};

/** Thông số dạng object -> chuỗi để ghi vào ô (mỗi thông số một dòng), ngược với parseSpecs. */
export const formatSpecs = (specs) =>
  Object.entries(specs ?? {})
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n');
