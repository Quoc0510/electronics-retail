/**
 * @feature [F08] Đánh giá sản phẩm - Kiểm thử giao diện Client (US-21): điểm sao trên thẻ và trang chi tiết, danh sách đánh giá,
 * form viết/sửa đánh giá theo từng kiểu người xem (khách, chưa mua, đã mua), lỗi và phân trang.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import StarRating from '../components/reviews/StarRating.jsx';
import { render } from '@testing-library/react';
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

const summary = (average, count, breakdown = {}) => ({
  average,
  count,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...breakdown },
});

const review = (id, overrides = {}) => ({
  id,
  rating: 5,
  comment: `Nhận xét số ${id}`,
  authorName: `Người ${id} N.`,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
  ...overrides,
});

const reviewList = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 5,
  total: items.length,
  summary: summary(5, items.length, { 5: items.length }),
  ...extra,
});

const detail = (overrides = {}) => ({
  id: 7,
  name: 'iPhone 15',
  slug: 'iphone-15',
  sku: 'IP15',
  description: null,
  specs: {},
  images: [],
  price: 20000000,
  salePrice: null,
  inStock: true,
  category: { name: 'Điện thoại', slug: 'dien-thoai' },
  brand: { name: 'Apple', slug: 'apple' },
  rating: { average: null, count: 0, breakdown: {} },
  ...overrides,
});

const mine = (canReview, mineReview = null) => ({ canReview, review: mineReview });

// Máy chủ giả cho trang chi tiết; extra ghi đè từng đường dẫn
const serve = (extra = {}) =>
  mockServer({
    ...storefrontApi,
    'GET /users/me': [200, customer],
    'GET /products/iphone-15': [200, detail()],
    'GET /products/iphone-15/reviews': [200, emptyReviews],
    ...extra,
  });

const openDetail = async () => {
  renderApp('/san-pham/iphone-15');
  await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });
  return await screen.findByRole('region', { name: 'Đánh giá sản phẩm' });
};

describe('StarRating', () => {
  it('có nhãn đọc được theo kiểu số Việt Nam và cắt lớp sao vàng theo điểm', () => {
    render(<StarRating value={4.3} />);

    const stars = screen.getByRole('img', { name: '4,3 trên 5 sao' });
    expect(stars.children[1].style.width).toBe('86%');
  });

  it('điểm ngoài khoảng được kẹp trong 0-100%', () => {
    render(<StarRating value={9} />);

    expect(screen.getByRole('img').children[1].style.width).toBe('100%');
  });
});

describe('Khối đánh giá ở trang chi tiết', () => {
  it('chưa có đánh giá: báo rõ và mời viết, điểm hiện dấu gạch', async () => {
    serve();
    const section = await openDetail();

    expect(await within(section).findByText(/Chưa có đánh giá nào/)).toBeInTheDocument();
    expect(screen.getByText('Chưa có đánh giá', { selector: 'span' })).toBeInTheDocument();
    expect(within(section).getByText('0 đánh giá')).toBeInTheDocument();
  });

  it('có đánh giá: điểm dưới tên sản phẩm, phân bố theo sao, danh sách kèm tên rút gọn', async () => {
    serve({
      'GET /products/iphone-15': [
        200,
        detail({ rating: { average: 4.3, count: 3, breakdown: { 4: 2, 5: 1 } } }),
      ],
      'GET /products/iphone-15/reviews': [
        200,
        reviewList([review(1, { rating: 5, authorName: 'Quốc P.' }), review(2, { rating: 4 })], {
          total: 3,
          summary: summary(4.3, 3, { 4: 2, 5: 1 }),
        }),
      ],
    });
    const section = await openDetail();

    // Dưới tên sản phẩm có liên kết cuộn xuống khối đánh giá
    const link = screen.getByRole('link', { name: /4,3.*3 đánh giá/ });
    expect(link).toHaveAttribute('href', '#danh-gia');

    expect(await within(section).findByText('Quốc P.')).toBeInTheDocument();
    expect(within(section).getByText('Nhận xét số 1')).toBeInTheDocument();
    expect(within(section).getAllByText('Đã mua hàng')).toHaveLength(2);

    const breakdown = within(section).getByRole('list', { name: 'Số đánh giá theo từng mức sao' });
    expect(within(breakdown).getByText('5 sao').closest('li')).toHaveTextContent('1');
    expect(within(breakdown).getByText('4 sao').closest('li')).toHaveTextContent('2');
    expect(within(breakdown).getByText('1 sao').closest('li')).toHaveTextContent('0');
  });

  it('phân trang: "Trang sau" tải trang 2', async () => {
    const calls = serve({
      'GET /products/iphone-15/reviews': (config) =>
        config.params.page === 2
          ? [
              200,
              reviewList([review(6, { comment: 'Ở trang hai' })], {
                page: 2,
                total: 6,
                summary: summary(5, 6, { 5: 6 }),
              }),
            ]
          : [
              200,
              reviewList([review(1), review(2), review(3), review(4), review(5)], {
                total: 6,
                summary: summary(5, 6, { 5: 6 }),
              }),
            ],
    });
    const section = await openDetail();
    await within(section).findByText('Nhận xét số 1');
    expect(within(section).getByText('Trang 1/2')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Trang trước' })).toBeDisabled();

    await userEvent.click(within(section).getByRole('button', { name: 'Trang sau' }));

    expect(await within(section).findByText('Ở trang hai')).toBeInTheDocument();
    expect(calls.filter((call) => call.key === 'GET /products/iphone-15/reviews')).toHaveLength(2);
    expect(within(section).getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });

  it('không tải được đánh giá: báo lỗi và Thử lại tải được', async () => {
    let fail = true;
    serve({
      'GET /products/iphone-15/reviews': () =>
        fail ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] : [200, reviewList([review(1)])],
    });
    const section = await openDetail();

    expect(await within(section).findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    fail = false;
    await userEvent.click(within(section).getByRole('button', { name: 'Thử lại' }));

    expect(await within(section).findByText('Nhận xét số 1')).toBeInTheDocument();
  });
});

describe('Khu vực viết đánh giá', () => {
  it('khách chưa đăng nhập: mời đăng nhập, không có form', async () => {
    serve();
    const section = await openDetail();

    const login = await within(section).findByRole('link', { name: 'Đăng nhập' });
    expect(login).toHaveAttribute('href', '/dang-nhap');
    expect(within(section).queryByRole('form')).not.toBeInTheDocument();
  });

  it('đã đăng nhập nhưng chưa nhận hàng: nói rõ điều kiện (BR-13), không có form', async () => {
    signIn();
    serve({ 'GET /products/iphone-15/reviews/mine': [200, mine(false)] });
    const section = await openDetail();

    expect(await within(section).findByText(/Chỉ khách đã nhận hàng/)).toBeInTheDocument();
    expect(within(section).queryByRole('form')).not.toBeInTheDocument();
  });

  it('đã nhận hàng: gửi đánh giá, thiếu số sao thì báo và không gọi máy chủ', async () => {
    signIn();
    let saved = null;
    const calls = serve({
      'GET /products/iphone-15/reviews/mine': () => [200, mine(true, saved)],
      'POST /products/iphone-15/reviews': (_config, body) => {
        saved = {
          id: 1,
          ...body,
          isHidden: false,
          createdAt: '2026-10-29T00:00:00.000Z',
          updatedAt: '2026-10-29T00:00:00.000Z',
        };
        return [201, saved];
      },
    });
    const section = await openDetail();
    const form = await within(section).findByRole('form', { name: 'Viết đánh giá' });

    await userEvent.click(within(form).getByRole('button', { name: 'Gửi đánh giá' }));
    expect(await within(form).findByText('Vui lòng chọn số sao')).toBeInTheDocument();
    expect(calls.some((call) => call.key === 'POST /products/iphone-15/reviews')).toBe(false);

    await userEvent.click(within(form).getByLabelText('4 sao'));
    expect(within(form).queryByText('Vui lòng chọn số sao')).not.toBeInTheDocument();
    await userEvent.type(within(form).getByLabelText(/Bình luận/), '  Dùng rất ổn  ');
    await userEvent.click(within(form).getByRole('button', { name: 'Gửi đánh giá' }));

    // Gửi đúng dữ liệu (bình luận đã cắt khoảng trắng) rồi chuyển sang khung "Đánh giá của bạn"
    expect(
      await within(section).findByRole('heading', { name: 'Đánh giá của bạn' }),
    ).toBeInTheDocument();
    const post = calls.find((call) => call.key === 'POST /products/iphone-15/reviews');
    expect(post.body).toEqual({ rating: 4, comment: 'Dùng rất ổn' });
    expect(within(section).getByText('Dùng rất ổn')).toBeInTheDocument();
    expect(within(section).queryByRole('form')).not.toBeInTheDocument();
  });

  it('đếm ký tự còn lại và giới hạn 500 ký tự trên ô nhập', async () => {
    signIn();
    serve({ 'GET /products/iphone-15/reviews/mine': [200, mine(true)] });
    const section = await openDetail();
    const form = await within(section).findByRole('form', { name: 'Viết đánh giá' });
    const box = within(form).getByLabelText(/Bình luận/);

    expect(box).toHaveAttribute('maxlength', '500');
    expect(within(form).getByText('Còn 500 ký tự')).toBeInTheDocument();
    await userEvent.type(box, 'abcde');
    expect(within(form).getByText('Còn 495 ký tự')).toBeInTheDocument();
  });

  it('bình luận không bắt buộc: chỉ chọn sao vẫn gửi được', async () => {
    signIn();
    const calls = serve({
      'GET /products/iphone-15/reviews/mine': [200, mine(true)],
      'POST /products/iphone-15/reviews': [201, { id: 1, rating: 5, comment: '', isHidden: false }],
    });
    const section = await openDetail();
    const form = await within(section).findByRole('form', { name: 'Viết đánh giá' });

    await userEvent.click(within(form).getByLabelText('5 sao'));
    await userEvent.click(within(form).getByRole('button', { name: 'Gửi đánh giá' }));

    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /products/iphone-15/reviews').body).toEqual({
        rating: 5,
        comment: '',
      }),
    );
  });

  it('máy chủ từ chối (đã đánh giá rồi) thì hiện đúng thông báo trong form', async () => {
    signIn();
    serve({
      'GET /products/iphone-15/reviews/mine': [200, mine(true)],
      'POST /products/iphone-15/reviews': [
        409,
        apiError('REVIEW_EXISTS', 'Bạn đã đánh giá sản phẩm này rồi, hãy sửa đánh giá hiện có'),
      ],
    });
    const section = await openDetail();
    const form = await within(section).findByRole('form', { name: 'Viết đánh giá' });

    await userEvent.click(within(form).getByLabelText('3 sao'));
    await userEvent.click(within(form).getByRole('button', { name: 'Gửi đánh giá' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Bạn đã đánh giá sản phẩm này rồi',
    );
    // Form còn nguyên để người dùng không mất nội dung
    expect(within(form).getByLabelText('3 sao')).toBeChecked();
  });

  it('đã có đánh giá: xem, sửa (điền sẵn), lưu bằng PATCH, hủy thì quay lại xem', async () => {
    signIn();
    let current = {
      id: 1,
      rating: 2,
      comment: 'Hơi nóng máy',
      isHidden: false,
      createdAt: '2026-10-20T03:00:00.000Z',
      updatedAt: '2026-10-20T03:00:00.000Z',
    };
    const calls = serve({
      'GET /products/iphone-15/reviews/mine': () => [200, mine(true, current)],
      'PATCH /products/iphone-15/reviews/mine': (_config, body) => {
        current = { ...current, ...body };
        return [200, current];
      },
    });
    const section = await openDetail();
    expect(await within(section).findByText('Hơi nóng máy')).toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Sửa đánh giá' }));
    const form = await within(section).findByRole('form', { name: 'Sửa đánh giá' });
    expect(within(form).getByLabelText('2 sao')).toBeChecked();
    expect(within(form).getByLabelText(/Bình luận/)).toHaveValue('Hơi nóng máy');

    // Hủy: quay lại xem, không gọi máy chủ
    await userEvent.click(within(form).getByRole('button', { name: 'Hủy' }));
    expect(
      await within(section).findByRole('heading', { name: 'Đánh giá của bạn' }),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.key.startsWith('PATCH'))).toBe(false);

    await userEvent.click(within(section).getByRole('button', { name: 'Sửa đánh giá' }));
    const again = await within(section).findByRole('form', { name: 'Sửa đánh giá' });
    await userEvent.click(within(again).getByLabelText('4 sao'));
    await userEvent.click(within(again).getByRole('button', { name: 'Lưu thay đổi' }));

    expect(
      await within(section).findByRole('heading', { name: 'Đánh giá của bạn' }),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.key.startsWith('PATCH')).body).toEqual({
      rating: 4,
      comment: 'Hơi nóng máy',
    });
  });

  it('đánh giá của mình đang bị ẩn: có ghi chú cho chính mình', async () => {
    signIn();
    serve({
      'GET /products/iphone-15/reviews/mine': [
        200,
        mine(true, { id: 1, rating: 1, comment: 'Vi phạm', isHidden: true }),
      ],
    });
    const section = await openDetail();

    expect(await within(section).findByText(/đang bị quản trị viên ẩn/)).toBeInTheDocument();
  });

  it('không tải được trạng thái đánh giá của mình thì báo lỗi, phần danh sách vẫn dùng được', async () => {
    signIn();
    serve({
      'GET /products/iphone-15/reviews': [200, reviewList([review(1)])],
      'GET /products/iphone-15/reviews/mine': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')],
    });
    const section = await openDetail();

    expect(await within(section).findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    expect(within(section).getByText('Nhận xét số 1')).toBeInTheDocument();
  });
});

describe('Điểm sao trên thẻ sản phẩm', () => {
  const card = (id, name, rating) => ({
    id,
    name,
    slug: `sp-${id}`,
    price: 1000000,
    salePrice: null,
    inStock: true,
    thumbnail: null,
    category: { name: 'Điện thoại', slug: 'dien-thoai' },
    brand: { name: 'Apple', slug: 'apple' },
    rating,
  });

  it('chỉ sản phẩm đã có đánh giá mới hiện điểm và số đánh giá', async () => {
    mockServer({
      ...storefrontApi,
      'GET /brands': [200, []],
      'GET /products': [
        200,
        {
          items: [
            card(1, 'Có đánh giá', { average: 4.5, count: 12 }),
            card(2, 'Chưa đánh giá', { average: null, count: 0 }),
          ],
          page: 1,
          pageSize: 12,
          total: 2,
        },
      ],
    });
    renderApp('/san-pham');

    const rated = (await screen.findByRole('heading', { name: 'Có đánh giá' })).closest('a');
    expect(within(rated).getByRole('img', { name: '4,5 trên 5 sao' })).toBeInTheDocument();
    expect(rated).toHaveTextContent('4,5 (12)');
    const plain = screen.getByRole('heading', { name: 'Chưa đánh giá' }).closest('a');
    expect(within(plain).queryByRole('img')).not.toBeInTheDocument();
  });
});
