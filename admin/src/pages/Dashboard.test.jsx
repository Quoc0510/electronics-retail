/**
 * @feature [F00][F04][F10] Kiểm thử trang tổng quan và khung chung (thanh bên, ngăn kéo menu) của Admin.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const emptyStats = {
  days: 30,
  summary: { revenue: 0, completedOrders: 0, pendingOrders: 0, customers: 0 },
  revenueByDay: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    revenue: 0,
    orders: 0,
  })),
  ordersByStatus: { PENDING: 0, CONFIRMED: 0, SHIPPING: 0, COMPLETED: 0, CANCELLED: 0 },
  topProducts: [],
  lowStock: { threshold: 5, total: 0, items: [] },
};

const overview = {
  'GET /users/me': [200, admin],
  'GET /admin/stats': [200, emptyStats],
  'GET /health': [200, { status: 'ok' }],
  'GET /admin/products': [200, { items: [], page: 1, pageSize: 1, total: 42 }],
  'GET /admin/categories': [200, [{ id: 1 }, { id: 2 }, { id: 3 }]],
  'GET /admin/brands': [200, [{ id: 1 }, { id: 2 }]],
};

const open = (route = '/', handlers = overview) => {
  tokenStorage.setTokens(adminSession);
  const calls = mockServer(handlers);
  renderApp(route);
  return calls;
};

// Thẻ số liệu nằm trong vùng nội dung chính (menu thanh bên cũng có liên kết cùng tên)
const stat = (name) => within(screen.getByRole('main')).getByRole('link', { name });

describe('Trang tổng quan', () => {
  it('hiện số sản phẩm, danh mục, thương hiệu và lời chào', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getByText(/Xin chào Quản trị viên/)).toBeInTheDocument();

    await screen.findByRole('heading', { name: 'Tổng quan' });
    const products = stat(/^Sản phẩm/);
    expect(await within(products).findByText('42')).toBeInTheDocument();
    expect(products).toHaveAttribute('href', '/san-pham');
    expect(await within(stat(/^Danh mục/)).findByText('3')).toBeInTheDocument();
    expect(await within(stat(/^Thương hiệu/)).findByText('2')).toBeInTheDocument();
  });

  it('lấy tổng số sản phẩm bằng pageSize=1, không tải cả danh sách', async () => {
    const paramsLog = [];
    open('/', {
      ...overview,
      'GET /admin/products': (config) => {
        paramsLog.push(config.params);
        return [200, { items: [], page: 1, pageSize: 1, total: 42 }];
      },
    });
    await screen.findByText('42');

    expect(paramsLog).toEqual([{ pageSize: 1 }]);
  });

  it('có lối tắt thao tác nhanh tới các trang quản lý', async () => {
    open();
    await screen.findByRole('heading', { name: 'Tổng quan' });

    expect(screen.getByRole('link', { name: 'Thêm sản phẩm mới' })).toHaveAttribute(
      'href',
      '/san-pham/them',
    );
    expect(screen.getByRole('link', { name: 'Quản lý danh mục' })).toHaveAttribute(
      'href',
      '/danh-muc',
    );
    expect(screen.getByRole('link', { name: 'Quản lý thương hiệu' })).toHaveAttribute(
      'href',
      '/thuong-hieu',
    );
  });

  it('một số liệu lỗi không làm hỏng cả trang: các số khác vẫn hiện', async () => {
    open('/', {
      ...overview,
      'GET /admin/products': [500, apiError('INTERNAL_ERROR', 'Lỗi')],
    });

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(await within(stat(/^Danh mục/)).findByText('3')).toBeInTheDocument();
  });
});

describe('Khung quản trị', () => {
  it('thanh bên có đủ mục menu và tô sáng mục đang xem', async () => {
    open('/danh-muc', { ...overview, 'GET /admin/categories': [200, []] });

    const nav = await screen.findByRole('navigation', { name: 'Menu quản trị' });
    for (const label of ['Tổng quan', 'Danh mục', 'Thương hiệu', 'Sản phẩm', 'Người dùng']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'Danh mục' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Tổng quan' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('hiện tên và email người đăng nhập trong thanh bên', async () => {
    open();

    const aside = (await screen.findByRole('navigation', { name: 'Menu quản trị' })).closest(
      'aside',
    );
    expect(within(aside).getByText('Quản trị viên')).toBeInTheDocument();
    expect(within(aside).getByText('admin@example.com')).toBeInTheDocument();
  });

  it('nút Mở menu hiện ngăn kéo (nền mờ xuất hiện); chọn mục hoặc bấm nền thì đóng lại', async () => {
    open();
    await screen.findByRole('heading', { name: 'Tổng quan' });
    const aside = screen.getByRole('navigation', { name: 'Menu quản trị' }).closest('aside');
    expect(aside).toHaveClass('-translate-x-full');

    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(aside).toHaveClass('translate-x-0');
    expect(aside).not.toHaveClass('-translate-x-full');

    await userEvent.click(screen.getByRole('button', { name: 'Đóng menu' }));
    expect(aside).toHaveClass('-translate-x-full');

    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    await userEvent.click(within(aside).getByRole('link', { name: 'Thương hiệu' }));
    expect(aside).toHaveClass('-translate-x-full');
  });
});

describe('Chế độ sáng/tối ở Admin', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('thanh bên có nút đổi giao diện: bấm thì đổi data-theme, đổi nhãn và nhớ lựa chọn', async () => {
    document.documentElement.dataset.theme = 'light';
    open();
    await screen.findByRole('heading', { name: 'Tổng quan' });

    await userEvent.click(screen.getByRole('button', { name: 'Chuyển sang chế độ tối' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('techstore.theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Chuyển sang chế độ sáng' })).toBeInTheDocument();
  });

  it('thanh bên luôn là vùng tối (surface-dark) để không bị đảo màu theo chế độ', async () => {
    open();

    const aside = (await screen.findByRole('navigation', { name: 'Menu quản trị' })).closest(
      'aside',
    );
    expect(aside).toHaveClass('surface-dark');
  });
});
