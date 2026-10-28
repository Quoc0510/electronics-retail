/**
 * @feature [F10] Dashboard - Kiểm thử các khối thống kê của trang tổng quan (US-26): thẻ số liệu, biểu đồ doanh thu 30 ngày,
 * đơn theo trạng thái, sản phẩm bán chạy, tồn kho thấp, và các hàm hỗ trợ vẽ biểu đồ.
 */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { compactVnd, formatDay, niceMax } from '../lib/chart.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

// ---------------------------------------------------------------------------
// Dữ liệu giả
// ---------------------------------------------------------------------------
const days = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10), // 29/09 đến 28/10
  revenue: 0,
  orders: 0,
}));
const withSales = (sales) =>
  days.map((day) => (sales[day.date] ? { ...day, ...sales[day.date] } : day));

const stats = (overrides = {}) => ({
  days: 30,
  summary: { revenue: 5560000, completedOrders: 3, pendingOrders: 4, customers: 12 },
  revenueByDay: withSales({
    '2026-10-20': { revenue: 3030000, orders: 2 },
    '2026-10-25': { revenue: 2530000, orders: 1 },
  }),
  ordersByStatus: { PENDING: 4, CONFIRMED: 2, SHIPPING: 1, COMPLETED: 3, CANCELLED: 5 },
  topProducts: [
    { id: 11, sku: 'IP15', name: 'iPhone 15 128GB', sold: 9, revenue: 180000000 },
    { id: 12, sku: 'SS24', name: 'Samsung S24', sold: 4, revenue: 80000000 },
  ],
  lowStock: {
    threshold: 5,
    total: 2,
    items: [
      { id: 21, sku: 'TAI-1', name: 'Tai nghe Bluetooth', stock: 0 },
      { id: 22, sku: 'SAC-1', name: 'Sạc nhanh 65W', stock: 3 },
    ],
  },
  ...overrides,
});

const open = (statsHandler = [200, stats()], extra = {}) => {
  tokenStorage.setTokens(adminSession);
  const calls = mockServer({
    'GET /users/me': [200, admin],
    'GET /health': [200, { status: 'ok' }],
    'GET /admin/products': [200, { items: [], page: 1, pageSize: 1, total: 42 }],
    'GET /admin/categories': [200, [{ id: 1 }]],
    'GET /admin/brands': [200, [{ id: 1 }]],
    'GET /admin/stats': statsHandler,
    ...extra,
  });
  renderApp('/');
  return calls;
};

const panel = (name) => within(screen.getByRole('region', { name }));

// ---------------------------------------------------------------------------
// Thẻ số liệu
// ---------------------------------------------------------------------------
describe('Thẻ số liệu kinh doanh', () => {
  it('hiện doanh thu, đơn hoàn thành, đơn chờ xác nhận và số khách hàng', async () => {
    open();

    const main = within(await screen.findByRole('main'));
    expect(await main.findByText(/5\.560\.000/)).toBeInTheDocument();
    expect(main.getByText('30 ngày gần nhất, đơn hoàn thành')).toBeInTheDocument();
    expect(within(main.getByRole('link', { name: /Đơn hoàn thành/ })).getByText('3')).toBeVisible();
    expect(
      within(main.getByRole('link', { name: /Đơn chờ xác nhận/ })).getByText('4'),
    ).toBeVisible();
    const customers = main.getByRole('link', { name: /Khách hàng/ });
    expect(within(customers).getByText('12')).toBeVisible();
    expect(customers).toHaveAttribute('href', '/nguoi-dung');
  });

  it('gọi API thống kê đúng một lần', async () => {
    const calls = open();
    await screen.findByText(/5\.560\.000/);

    expect(calls.filter((call) => call.key === 'GET /admin/stats')).toHaveLength(1);
  });

  it('thống kê lỗi: báo lỗi, thẻ hiện dấu gạch, các số liệu danh mục vẫn hiện; bấm Thử lại thì tải lại', async () => {
    let attempts = 0;
    open(() => {
      attempts += 1;
      return attempts === 1
        ? [500, apiError('INTERNAL_ERROR', 'Máy chủ đang bận')]
        : [200, stats()];
    });

    expect(await screen.findByText('Máy chủ đang bận')).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(within(main.getByRole('link', { name: /Khách hàng/ })).getByText('–')).toBeVisible();
    expect(
      await within(main.getByRole('link', { name: /^Sản phẩm/ })).findByText('42'),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await main.findByText(/5\.560\.000/)).toBeInTheDocument();
    expect(screen.queryByText('Máy chủ đang bận')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// US-26 AC1: biểu đồ doanh thu
// ---------------------------------------------------------------------------
describe('Biểu đồ doanh thu theo ngày (US-26 AC1)', () => {
  it('vẽ đủ 30 cột, có mô tả tổng doanh thu cho trình đọc màn hình', async () => {
    open();

    const chart = await screen.findByRole('img', { name: /Biểu đồ doanh thu 30 ngày gần nhất/ });
    expect(chart).toHaveAccessibleName(/5\.560\.000/);
    expect(within(chart).getAllByTestId('revenue-bar')).toHaveLength(30);
  });

  it('mỗi cột có chú thích ngày, doanh thu và số đơn', async () => {
    open();

    const chart = await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });
    const titles = [...chart.querySelectorAll('title')].map((node) => node.textContent);
    expect(titles).toHaveLength(30);
    expect(titles.find((text) => text.startsWith('20/10/2026'))).toMatch(/3\.030\.000.*2 đơn/);
    expect(titles.find((text) => text.startsWith('21/10/2026'))).toMatch(
      /^21\/10\/2026: 0 ₫ · 0 đơn/,
    );
  });

  it('chỉ ngày có doanh thu mới có cột; chiều cao tỉ lệ với doanh thu', async () => {
    open();

    const chart = await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });
    const barHeights = within(chart)
      .getAllByTestId('revenue-bar')
      .map((group) => group.querySelector('rect.fill-brand-500'))
      .filter(Boolean)
      .map((rect) => Number(rect.getAttribute('height')));
    expect(barHeights).toHaveLength(2);
    const [bigger, smaller] = barHeights;
    expect(bigger / smaller).toBeCloseTo(3030000 / 2530000, 1);
  });

  it('có bảng số liệu dạng văn bản, ngày mới nhất trước, chỉ gồm ngày có đơn', async () => {
    open();
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    await userEvent.click(screen.getByText('Xem bảng số liệu'));

    const details = screen.getByText('Xem bảng số liệu').closest('details');
    const rows = within(details).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('25/10/2026');
    expect(rows[0]).toHaveTextContent('2.530.000');
    expect(rows[1]).toHaveTextContent('20/10/2026');
    expect(within(rows[1]).getAllByRole('cell')[1].textContent).toBe('2');
  });

  it('chưa có đơn hoàn thành thì báo rõ và không có bảng số liệu', async () => {
    open([
      200,
      stats({
        summary: { revenue: 0, completedOrders: 0, pendingOrders: 0, customers: 0 },
        revenueByDay: days,
      }),
    ]);

    expect(
      await screen.findByText('Chưa có đơn hoàn thành trong 30 ngày qua.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Xem bảng số liệu')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /tổng 0 ₫/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// US-26 AC2 đến AC4
// ---------------------------------------------------------------------------
describe('Đơn theo trạng thái (US-26 AC2)', () => {
  it('liệt kê đủ năm trạng thái kèm số đơn', async () => {
    open();
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    const list = panel('Đơn hàng theo trạng thái');
    const counts = Object.fromEntries(
      list.getAllByRole('listitem').map((item) => {
        const [label, count] = [item.firstChild.textContent, item.lastChild.textContent];
        return [label, count];
      }),
    );
    expect(counts).toEqual({
      'Chờ xác nhận': '4',
      'Đã xác nhận': '2',
      'Đang giao hàng': '1',
      'Hoàn thành': '3',
      'Đã hủy': '5',
    });
  });

  it('trạng thái không có đơn hiện số 0', async () => {
    open([
      200,
      stats({
        ordersByStatus: { PENDING: 0, CONFIRMED: 0, SHIPPING: 0, COMPLETED: 0, CANCELLED: 0 },
      }),
    ]);
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    const items = panel('Đơn hàng theo trạng thái').getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.every((item) => item.lastChild.textContent === '0')).toBe(true);
  });
});

describe('Sản phẩm bán chạy (US-26 AC3)', () => {
  it('xếp theo thứ tự API trả về, kèm SKU, số lượng, doanh thu và liên kết sửa sản phẩm', async () => {
    open();
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    const items = panel('Sản phẩm bán chạy').getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('1');
    expect(items[0]).toHaveTextContent('iPhone 15 128GB');
    expect(items[0]).toHaveTextContent('IP15');
    expect(items[0]).toHaveTextContent('9 cái');
    expect(items[0]).toHaveTextContent('180.000.000');
    expect(within(items[0]).getByRole('link', { name: 'iPhone 15 128GB' })).toHaveAttribute(
      'href',
      '/san-pham/11',
    );
    expect(items[1]).toHaveTextContent('Samsung S24');
  });

  it('chưa có đơn nào thì báo trống', async () => {
    open([200, stats({ topProducts: [] })]);
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    expect(panel('Sản phẩm bán chạy').getByText('Chưa có đơn hàng nào.')).toBeInTheDocument();
  });
});

describe('Sản phẩm sắp hết hàng (US-26 AC4)', () => {
  it('hiện sản phẩm tồn kho thấp: hết hàng và còn ít, kèm ngưỡng', async () => {
    open();
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    const stock = panel('Sản phẩm sắp hết hàng');
    expect(stock.getByText('Đang bán và tồn kho từ 5 trở xuống')).toBeInTheDocument();
    const rows = stock.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Tai nghe Bluetooth');
    expect(rows[0]).toHaveTextContent('Hết hàng');
    expect(rows[1]).toHaveTextContent('Sạc nhanh 65W');
    expect(rows[1]).toHaveTextContent('Còn 3');
    expect(stock.getByRole('link', { name: 'Sạc nhanh 65W' })).toHaveAttribute(
      'href',
      '/san-pham/22',
    );
    expect(stock.queryByText(/Hiển thị/)).not.toBeInTheDocument();
  });

  it('có nhiều hơn danh sách thì báo "Hiển thị x trong y"', async () => {
    open([
      200,
      stats({
        lowStock: {
          threshold: 5,
          total: 13,
          items: [{ id: 1, sku: 'A', name: 'Hàng A', stock: 1 }],
        },
      }),
    ]);
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    expect(panel('Sản phẩm sắp hết hàng').getByText(/Hiển thị 1 trong 13 sản phẩm/)).toBeVisible();
  });

  it('không có sản phẩm nào sắp hết thì báo trống', async () => {
    open([200, stats({ lowStock: { threshold: 5, total: 0, items: [] } })]);
    await screen.findByRole('img', { name: /Biểu đồ doanh thu/ });

    expect(
      panel('Sản phẩm sắp hết hàng').getByText('Không có sản phẩm nào sắp hết hàng.'),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Hàm hỗ trợ vẽ biểu đồ
// ---------------------------------------------------------------------------
describe('compactVnd', () => {
  it.each([
    [0, '0'],
    [500, '500'],
    [1000, '1k'],
    [12500, '12,5k'],
    [1000000, '1 tr'],
    [1500000, '1,5 tr'],
    [250000000, '250 tr'],
    [2000000000, '2 tỷ'],
    [4000060000, '4 tỷ'],
  ])('%i -> %s', (value, expected) => {
    expect(compactVnd(value)).toBe(expected);
  });
});

describe('niceMax', () => {
  it.each([
    [0, 0],
    [-5, 0],
    [1, 1],
    [3, 4],
    [5, 6],
    [7, 8],
    [9, 10],
    [3030000, 4000000],
    [4000000, 4000000],
    [4000001, 6000000],
    [10000000, 10000000],
  ])('%i -> %i', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });

  it('luôn không nhỏ hơn giá trị đầu vào và mốc giữa là số nguyên', () => {
    for (const value of [99, 1234, 56789, 3030000, 98765432]) {
      const top = niceMax(value);
      expect(top).toBeGreaterThanOrEqual(value);
      expect(Number.isInteger(top / 2)).toBe(true);
    }
  });
});

describe('formatDay', () => {
  it('đổi YYYY-MM-DD sang DD/MM hoặc DD/MM/YYYY', () => {
    expect(formatDay('2026-10-28')).toBe('28/10');
    expect(formatDay('2026-10-28', true)).toBe('28/10/2026');
    expect(formatDay('2027-01-05', true)).toBe('05/01/2027');
  });
});
