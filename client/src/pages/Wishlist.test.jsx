/**
 * @feature [F08] Yêu thích - Kiểm thử giao diện Client (US-22): nút trái tim trên thẻ và trang chi tiết, khách chưa đăng nhập
 * được đưa tới trang đăng nhập, trang /yeu-thich (danh sách, trống, lỗi), lỗi từ máy chủ hiện cạnh nút.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import {
  apiError,
  customer,
  emptyReviews,
  mockServer,
  renderApp,
  session,
  storefrontApi,
} from '../test/utils.jsx';

const signIn = () => tokenStorage.setTokens(session);

const card = (id, name = `Sản phẩm ${id}`) => ({
  id,
  name,
  slug: `san-pham-${id}`,
  price: 1000000,
  salePrice: null,
  inStock: true,
  thumbnail: null,
  category: { name: 'Điện thoại', slug: 'dien-thoai' },
  brand: { name: 'Apple', slug: 'apple' },
  rating: { average: null, count: 0 },
});

// Máy chủ giả có trạng thái danh sách yêu thích: PUT thêm, DELETE bỏ, GET trả danh sách hiện tại
const wishlistServer = (initial, catalog, extra = {}) => {
  let items = initial;
  const handlers = {
    ...storefrontApi,
    'GET /brands': [200, []],
    'GET /users/me': [200, customer],
    'GET /products': [200, { items: catalog, page: 1, pageSize: 12, total: catalog.length }],
    'GET /wishlist': () => [200, { items, total: items.length }],
    ...extra,
  };
  for (const product of catalog) {
    handlers[`PUT /wishlist/${product.id}`] =
      extra[`PUT /wishlist/${product.id}`] ??
      (() => {
        if (!items.some((item) => item.id === product.id)) items = [product, ...items];
        return [200, { productId: product.id, inWishlist: true }];
      });
    handlers[`DELETE /wishlist/${product.id}`] =
      extra[`DELETE /wishlist/${product.id}`] ??
      (() => {
        items = items.filter((item) => item.id !== product.id);
        return [204, undefined];
      });
  }
  return mockServer(handlers);
};

describe('Nút yêu thích trên thẻ sản phẩm', () => {
  it('bấm để thêm rồi bấm lại để bỏ (US-22 AC1)', async () => {
    signIn();
    const calls = wishlistServer([], [card(1), card(2)]);
    renderApp('/san-pham');

    const heart = await screen.findByRole('button', { name: 'Yêu thích Sản phẩm 1' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(heart);
    const added = await screen.findByRole('button', { name: 'Bỏ Sản phẩm 1 khỏi yêu thích' });
    expect(added).toHaveAttribute('aria-pressed', 'true');
    expect(calls.some((call) => call.key === 'PUT /wishlist/1')).toBe(true);
    // Sản phẩm khác không bị ảnh hưởng
    expect(screen.getByRole('button', { name: 'Yêu thích Sản phẩm 2' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await userEvent.click(added);
    expect(await screen.findByRole('button', { name: 'Yêu thích Sản phẩm 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(calls.some((call) => call.key === 'DELETE /wishlist/1')).toBe(true);
  });

  it('các nút tròn trên thẻ chỉ mang lớp vị trí absolute, không kèm relative (nếu không nút bị đẩy lệch khỏi góc thẻ)', async () => {
    wishlistServer([], [card(1)]);
    renderApp('/san-pham');

    const heart = await screen.findByRole('button', { name: 'Yêu thích Sản phẩm 1' });
    const cart = screen.getByRole('button', { name: 'Thêm Sản phẩm 1 vào giỏ' });

    for (const button of [heart, cart]) {
      expect(button.parentElement).toHaveClass('absolute');
      expect(button.parentElement).not.toHaveClass('relative');
    }
  });

  it('sản phẩm đã có trong danh sách hiện sẵn trạng thái đã yêu thích', async () => {
    signIn();
    wishlistServer([card(2)], [card(1), card(2)]);
    renderApp('/san-pham');

    expect(
      await screen.findByRole('button', { name: 'Bỏ Sản phẩm 2 khỏi yêu thích' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Yêu thích Sản phẩm 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('khách chưa đăng nhập bấm thì được chuyển tới trang đăng nhập, không gọi máy chủ', async () => {
    const calls = wishlistServer([], [card(1)]);
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Yêu thích Sản phẩm 1' }));

    expect(await screen.findByRole('heading', { name: /Đăng nhập/ })).toBeInTheDocument();
    expect(calls.some((call) => call.key.includes('/wishlist'))).toBe(false);
  });

  it('máy chủ từ chối (đủ 100 sản phẩm) thì hiện thông báo cạnh nút và nút vẫn là chưa yêu thích', async () => {
    signIn();
    wishlistServer([], [card(1)], {
      'PUT /wishlist/1': [
        400,
        apiError(
          'WISHLIST_FULL',
          'Danh sách yêu thích đã đủ 100 sản phẩm, hãy bỏ bớt trước khi thêm',
        ),
      ],
    });
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Yêu thích Sản phẩm 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('đã đủ 100 sản phẩm');
    expect(screen.getByRole('button', { name: 'Yêu thích Sản phẩm 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('Nút yêu thích ở trang chi tiết', () => {
  it('nút có chữ, đổi sang "Đã yêu thích" sau khi thêm', async () => {
    signIn();
    const product = {
      ...card(7, 'iPhone 15'),
      slug: 'iphone-15',
      sku: 'IP15',
      description: null,
      specs: {},
      images: [],
      rating: { average: null, count: 0, breakdown: {} },
    };
    wishlistServer([], [product], {
      'GET /products/iphone-15': [200, product],
      'GET /products/iphone-15/reviews': [200, emptyReviews],
      'GET /products/iphone-15/reviews/mine': [200, { canReview: false, review: null }],
    });
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(await screen.findByRole('button', { name: 'Yêu thích' }));

    expect(await screen.findByRole('button', { name: 'Đã yêu thích' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('Trang /yeu-thich', () => {
  it('khách chưa đăng nhập bị chuyển tới trang đăng nhập', async () => {
    wishlistServer([], []);
    renderApp('/yeu-thich');

    expect(await screen.findByRole('heading', { name: /Đăng nhập/ })).toBeInTheDocument();
  });

  it('liệt kê sản phẩm đã lưu kèm số lượng (US-22 AC2)', async () => {
    signIn();
    wishlistServer([card(2), card(1)], [card(1), card(2)]);
    renderApp('/yeu-thich');

    expect(
      await screen.findByRole('heading', { name: 'Sản phẩm yêu thích', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('2 sản phẩm đã lưu')).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Sản phẩm 2', 'Sản phẩm 1']);
  });

  it('bỏ yêu thích ngay trên trang thì thẻ biến mất, hết thì hiện trạng thái trống', async () => {
    signIn();
    wishlistServer([card(1)], [card(1)]);
    renderApp('/yeu-thich');
    await screen.findByRole('heading', { name: 'Sản phẩm 1', level: 3 });

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ Sản phẩm 1 khỏi yêu thích' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Sản phẩm 1', level: 3 }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Bạn chưa lưu sản phẩm nào/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem sản phẩm' })).toHaveAttribute('href', '/san-pham');
  });

  it('chưa lưu gì: hiện trạng thái trống thân thiện', async () => {
    signIn();
    wishlistServer([], []);
    renderApp('/yeu-thich');

    expect(await screen.findByText(/Bạn chưa lưu sản phẩm nào/)).toBeInTheDocument();
    expect(screen.queryByText(/sản phẩm đã lưu/)).toBeInTheDocument();
  });

  it('lỗi tải: báo lỗi và Thử lại tải được', async () => {
    signIn();
    let fail = true;
    wishlistServer([card(1)], [card(1)], {
      'GET /wishlist': () =>
        fail
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
          : [200, { items: [card(1)], total: 1 }],
    });
    renderApp('/yeu-thich');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Lỗi máy chủ');
    fail = false;
    await userEvent.click(within(alert.parentElement).getByRole('button', { name: 'Thử lại' }));

    expect(
      await screen.findByRole('heading', { name: 'Sản phẩm 1', level: 3 }),
    ).toBeInTheDocument();
  });

  it('menu tài khoản có liên kết tới trang yêu thích', async () => {
    signIn();
    wishlistServer([], []);
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: /Xin chào, Khách A/ }));

    expect(screen.getByRole('menuitem', { name: 'Sản phẩm yêu thích' })).toHaveAttribute(
      'href',
      '/yeu-thich',
    );
  });
});
