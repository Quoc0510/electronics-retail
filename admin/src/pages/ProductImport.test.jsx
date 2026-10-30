/**
 * @feature [F14] Nhập sản phẩm từ Excel - Kiểm thử giao diện Admin: chọn kiểu nhập, tải file mẫu, chọn file, xem trước dòng đúng/sai,
 * nhập các dòng đúng, tải dòng lỗi (US-35, US-36).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// jsdom không có tải file bằng Blob: giả lập để kiểm tra Admin thật sự được tải về file
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:file');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const previewResult = (overrides = {}) => ({
  mode: 'create',
  summary: { total: 3, ok: 2, failed: 1 },
  ignoredColumns: [],
  rows: [
    { row: 2, sku: 'OK-1', status: 'OK', errors: [] },
    { row: 3, sku: 'OK-2', status: 'OK', errors: [] },
    {
      row: 4,
      sku: 'LOI-1',
      status: 'ERROR',
      errors: [
        { column: 'Danh mục', message: 'Danh mục "Máy bay" không tồn tại trong hệ thống' },
        { column: 'Giá gốc', message: 'Giá gốc phải là số nguyên' },
      ],
    },
  ],
  ...overrides,
});

const importResult = (overrides = {}) => ({
  mode: 'create',
  summary: { total: 3, created: 2, updated: 0, failed: 1 },
  ignoredColumns: [],
  rows: [
    { row: 2, sku: 'OK-1', status: 'CREATED', errors: [] },
    { row: 3, sku: 'OK-2', status: 'CREATED', errors: [] },
    {
      row: 4,
      sku: 'LOI-1',
      status: 'ERROR',
      errors: [{ column: null, message: 'SKU này đã được dùng cho sản phẩm khác' }],
    },
  ],
  ...overrides,
});

// Ghi đè từng API vẫn được ghi nhận dưới cùng tên ngắn để test kiểm tra tham số đã gửi
const NAMES = {
  'GET /admin/products/import/template': 'template',
  'POST /admin/products/import/preview': 'preview',
  'POST /admin/products/import': 'import',
  'POST /admin/products/import/errors': 'errors',
};

const open = (handlers = {}, route = '/san-pham/nhap-excel') => {
  tokenStorage.setTokens(adminSession);
  const requests = [];
  const record = (name, response) => (config, body) => {
    requests.push({ name, params: config.params, body });
    return typeof response === 'function' ? response(config, body) : response;
  };
  const calls = mockServer({
    'GET /users/me': [200, admin],
    'GET /admin/products': [200, { items: [], page: 1, pageSize: 10, total: 0 }],
    'GET /admin/categories': [200, []],
    'GET /admin/products/import/template': record('template', [200, new Blob(['xlsx'])]),
    'POST /admin/products/import/preview': record('preview', [200, previewResult()]),
    'POST /admin/products/import': record('import', [200, importResult()]),
    'POST /admin/products/import/errors': record('errors', [200, new Blob(['err'])]),
    ...Object.fromEntries(
      Object.entries(handlers).map(([key, value]) => [key, record(NAMES[key] ?? key, value)]),
    ),
  });
  renderApp(route);
  return { calls, requests };
};

const file = (name = 'san-pham.xlsx', type = XLSX, size) => {
  const created = new File(['noi dung'], name, { type });
  if (size) Object.defineProperty(created, 'size', { value: size });
  return created;
};

const choose = async (picked = file()) => {
  const input = await screen.findByLabelText('File Excel (.xlsx)');
  await userEvent.upload(input, picked);
  return input;
};
const previewButton = () => screen.getByRole('button', { name: 'Xem trước' });
const heading = () => screen.findByRole('heading', { name: 'Nhập sản phẩm từ Excel', level: 1 });

describe('Trang nhập sản phẩm từ Excel', () => {
  it('trang danh sách sản phẩm có nút "Nhập từ Excel" dẫn tới trang này', async () => {
    open({}, '/san-pham');
    await userEvent.click(await screen.findByRole('link', { name: 'Nhập từ Excel' }));
    expect(await heading()).toBeInTheDocument();
  });

  it('mặc định là thêm mới; chuyển sang cập nhật đổi lời giải thích và mô tả file mẫu', async () => {
    open();
    await heading();
    expect(screen.getByRole('radio', { name: /Thêm sản phẩm mới/ })).toBeChecked();
    expect(screen.getByText(/Tối đa 500 dòng mỗi lần/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Cập nhật sản phẩm đã có/ }));
    expect(screen.getByRole('radio', { name: /Cập nhật sản phẩm đã có/ })).toBeChecked();
    expect(screen.getByText(/điền sẵn các sản phẩm hiện có/)).toBeInTheDocument();
  });

  it('tải file mẫu gửi đúng chế độ và tải về file', async () => {
    const { requests } = open();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Tải file mẫu' }));
    await waitFor(() => expect(requests.some((r) => r.name === 'template')).toBe(true));
    expect(requests.find((r) => r.name === 'template').params).toEqual({ mode: 'create' });
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('radio', { name: /Cập nhật sản phẩm đã có/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Tải file mẫu' }));
    await waitFor(() => expect(requests.filter((r) => r.name === 'template')).toHaveLength(2));
    expect(requests.filter((r) => r.name === 'template')[1].params).toEqual({ mode: 'update' });
  });

  it('lỗi khi tải file mẫu thì báo cho Admin', async () => {
    open({
      'GET /admin/products/import/template': [500, apiError('INTERNAL_ERROR', 'Máy chủ gặp sự cố')],
    });
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Tải file mẫu' }));
    expect(await screen.findByText('Máy chủ gặp sự cố')).toBeInTheDocument();
  });

  it('chưa chọn file thì không bấm được Xem trước', async () => {
    open();
    await heading();
    expect(previewButton()).toBeDisabled();
  });

  it('file không phải .xlsx hoặc quá 2MB bị chặn ngay ở trình duyệt', async () => {
    const { requests } = open();
    await heading();
    const input = await screen.findByLabelText('File Excel (.xlsx)');

    // Bỏ lọc "accept" của ô chọn file để mô phỏng người dùng cố chọn file khác loại
    await userEvent.upload(input, file('san-pham.csv', 'text/csv'), { applyAccept: false });
    expect(await screen.findByText('Chỉ nhận file Excel định dạng .xlsx')).toBeInTheDocument();
    expect(previewButton()).toBeDisabled();

    await userEvent.upload(input, file('lon.xlsx', XLSX, 3 * 1024 * 1024));
    expect(await screen.findByText('File tối đa 2MB')).toBeInTheDocument();
    expect(previewButton()).toBeDisabled();
    expect(requests).toHaveLength(0);
  });

  it('xem trước: tổng số, dòng đúng/sai kèm cột và lý do, gửi file và chế độ lên máy chủ', async () => {
    const { requests } = open();
    await heading();
    await choose(file('hang-moi.xlsx'));
    await userEvent.click(previewButton());

    const section = await screen.findByRole('region', { name: 'Kết quả xem trước' });
    const summary = within(section);
    expect(summary.getByText('Tổng số dòng').nextSibling).toHaveTextContent('3');
    expect(summary.getByText('Hợp lệ', { selector: 'dt' }).nextSibling).toHaveTextContent('2');
    expect(summary.getByText('Lỗi', { selector: 'dt' }).nextSibling).toHaveTextContent('1');

    const row = (await summary.findByText('LOI-1')).closest('tr');
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(
      within(row).getByText('Danh mục: Danh mục "Máy bay" không tồn tại trong hệ thống'),
    ).toBeInTheDocument();
    expect(within(row).getByText('Giá gốc: Giá gốc phải là số nguyên')).toBeInTheDocument();
    expect(
      within((await summary.findByText('OK-1')).closest('tr')).getByText('Hợp lệ'),
    ).toBeInTheDocument();

    const sent = requests.find((r) => r.name === 'preview');
    expect(sent.params).toEqual({ mode: 'create' });
    expect(sent.body).toEqual({ file: ['hang-moi.xlsx'] });
    expect(screen.getByText(/Chỉ các dòng hợp lệ được nhập/)).toBeInTheDocument();
  });

  it('cột lạ bị bỏ qua được báo cho Admin', async () => {
    open({
      'POST /admin/products/import/preview': [
        200,
        previewResult({ ignoredColumns: ['Ghi chú nội bộ'] }),
      ],
    });
    await heading();
    await choose();
    await userEvent.click(previewButton());
    expect(
      await screen.findByText(/Các cột không nhận ra nên bị bỏ qua: Ghi chú nội bộ/),
    ).toBeInTheDocument();
  });

  it('lỗi cả file (thiếu cột bắt buộc) hiện thông báo của máy chủ, không có bảng xem trước', async () => {
    open({
      'POST /admin/products/import/preview': [
        400,
        apiError('IMPORT_HEADERS_MISSING', 'Thiếu cột bắt buộc: Giá gốc. Hãy dùng đúng file mẫu'),
      ],
    });
    await heading();
    await choose();
    await userEvent.click(previewButton());
    expect(await screen.findByText(/Thiếu cột bắt buộc: Giá gốc/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kết quả xem trước' })).not.toBeInTheDocument();
  });

  it('nhập các dòng hợp lệ: nút ghi rõ số dòng, gửi lại file, hiện kết quả và lối về danh sách', async () => {
    const { requests } = open();
    await heading();
    await choose(file('hang-moi.xlsx'));
    await userEvent.click(previewButton());
    await userEvent.click(await screen.findByRole('button', { name: /Thêm 2 dòng hợp lệ/ }));

    const done = await screen.findByRole('region', { name: 'Kết quả nhập' });
    expect(within(done).getByText('Đã thêm').nextSibling).toHaveTextContent('2');
    expect(within(done).getByText('Bị bỏ qua (lỗi)').nextSibling).toHaveTextContent('1');
    // Chỉ liệt kê dòng lỗi (dòng đã thêm thành công không cần nhắc lại)
    expect(within(done).getByText('SKU này đã được dùng cho sản phẩm khác')).toBeInTheDocument();
    expect(within(done).queryByText('OK-1')).not.toBeInTheDocument();
    expect(within(done).getByRole('link', { name: 'Xem danh sách sản phẩm' })).toHaveAttribute(
      'href',
      '/san-pham',
    );

    const sent = requests.find((r) => r.name === 'import');
    expect(sent.params).toEqual({ mode: 'create' });
    expect(sent.body).toEqual({ file: ['hang-moi.xlsx'] });
    // Đã nhập xong thì không cho nhập lại cùng lúc (tránh bấm đúp)
    expect(screen.queryByRole('button', { name: /dòng hợp lệ/ })).not.toBeInTheDocument();
    expect(previewButton()).toBeDisabled();
  });

  it('chế độ cập nhật: gửi mode=update và hiện số sản phẩm đã cập nhật', async () => {
    const { requests } = open({
      'POST /admin/products/import/preview': [
        200,
        previewResult({
          mode: 'update',
          summary: { total: 1, ok: 1, failed: 0 },
          rows: [{ row: 2, sku: 'CU-1', status: 'OK', errors: [] }],
        }),
      ],
      'POST /admin/products/import': [
        200,
        importResult({
          mode: 'update',
          summary: { total: 1, created: 0, updated: 1, failed: 0 },
          rows: [{ row: 2, sku: 'CU-1', status: 'UPDATED', errors: [] }],
        }),
      ],
    });
    await heading();
    await userEvent.click(screen.getByRole('radio', { name: /Cập nhật sản phẩm đã có/ }));
    await choose();
    await userEvent.click(previewButton());
    await userEvent.click(await screen.findByRole('button', { name: /Cập nhật 1 dòng hợp lệ/ }));

    const done = await screen.findByRole('region', { name: 'Kết quả nhập' });
    expect(within(done).getByText('Đã cập nhật').nextSibling).toHaveTextContent('1');
    expect(requests.find((r) => r.name === 'preview').params).toEqual({ mode: 'update' });
    expect(requests.find((r) => r.name === 'import').params).toEqual({ mode: 'update' });
  });

  it('không có dòng hợp lệ thì không bấm được nút nhập; không có dòng lỗi thì không có nút tải dòng lỗi', async () => {
    open({
      'POST /admin/products/import/preview': [
        200,
        previewResult({ summary: { total: 1, ok: 0, failed: 1 }, rows: [previewResult().rows[2]] }),
      ],
    });
    await heading();
    await choose();
    await userEvent.click(previewButton());
    expect(await screen.findByRole('button', { name: /Thêm 0 dòng hợp lệ/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tải các dòng lỗi để sửa' })).toBeEnabled();
  });

  it('toàn bộ dòng đều đúng: không có nút tải dòng lỗi', async () => {
    open({
      'POST /admin/products/import/preview': [
        200,
        previewResult({
          summary: { total: 2, ok: 2, failed: 0 },
          rows: previewResult().rows.slice(0, 2),
        }),
      ],
    });
    await heading();
    await choose();
    await userEvent.click(previewButton());
    expect(await screen.findByRole('button', { name: /Thêm 2 dòng hợp lệ/ })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Tải các dòng lỗi để sửa' }),
    ).not.toBeInTheDocument();
  });

  it('tải các dòng lỗi: gửi file và chế độ rồi tải về file', async () => {
    const { requests } = open();
    await heading();
    await choose(file('hang-moi.xlsx'));
    await userEvent.click(previewButton());
    await userEvent.click(await screen.findByRole('button', { name: 'Tải các dòng lỗi để sửa' }));

    await waitFor(() => expect(requests.some((r) => r.name === 'errors')).toBe(true));
    expect(requests.find((r) => r.name === 'errors').params).toEqual({ mode: 'create' });
    expect(requests.find((r) => r.name === 'errors').body).toEqual({ file: ['hang-moi.xlsx'] });
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('lỗi khi nhập (ví dụ máy chủ từ chối) hiện thông báo và vẫn giữ kết quả xem trước', async () => {
    open({
      'POST /admin/products/import': [
        500,
        apiError('INTERNAL_ERROR', 'Không nhập được, thử lại sau'),
      ],
    });
    await heading();
    await choose();
    await userEvent.click(previewButton());
    await userEvent.click(await screen.findByRole('button', { name: /Thêm 2 dòng hợp lệ/ }));

    expect(await screen.findByText('Không nhập được, thử lại sau')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kết quả xem trước' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm 2 dòng hợp lệ/ })).toBeEnabled(); // thử lại được
  });

  it('đổi kiểu nhập hoặc chọn file khác thì xóa kết quả xem trước cũ', async () => {
    open();
    await heading();
    await choose();
    await userEvent.click(previewButton());
    await screen.findByRole('region', { name: 'Kết quả xem trước' });

    await userEvent.click(screen.getByRole('radio', { name: /Cập nhật sản phẩm đã có/ }));
    expect(screen.queryByRole('region', { name: 'Kết quả xem trước' })).not.toBeInTheDocument();

    await userEvent.click(previewButton());
    await screen.findByRole('region', { name: 'Kết quả xem trước' });
    await userEvent.click(screen.getByRole('button', { name: 'Chọn file khác' }));
    expect(screen.queryByRole('region', { name: 'Kết quả xem trước' })).not.toBeInTheDocument();
    expect(previewButton()).toBeDisabled();
  });
});
