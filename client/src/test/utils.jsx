/**
 * @feature [F01] Hàm dùng chung cho test giao diện Client.
 * Máy chủ giả nằm ở @techstore/shared/testing; ở đây gắn nó với axios của Client và dựng ứng dụng đầy đủ.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiError, mockServer as mockServerFor } from '@techstore/shared/testing';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export { apiError };

export const customer = {
  id: 1,
  email: 'khach@example.com',
  fullName: 'Khách A',
  phone: null,
  role: 'CUSTOMER',
};

export const session = { user: customer, accessToken: 'access-1', refreshToken: 'refresh-1' };

export const mockServer = (handlers) => mockServerFor(api, handlers);

// [F04] Trang chủ gọi danh mục và danh sách sản phẩm; các test không quan tâm tới trang chủ dùng bộ trả lời rỗng này
export const emptyCart = { items: [], totalQuantity: 0, subtotal: 0, canCheckout: false };

// [F08] Trang chi tiết sản phẩm luôn tải khối đánh giá; test không quan tâm tới đánh giá dùng câu trả lời "chưa có đánh giá"
export const emptyReviews = {
  items: [],
  page: 1,
  pageSize: 5,
  total: 0,
  summary: { average: null, count: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
};

export const storefrontApi = {
  'GET /cart': [200, emptyCart], // [F05] đầu trang tải giỏ khi đã đăng nhập
  'GET /wishlist': [200, { items: [], total: 0 }], // [F08] thẻ sản phẩm tải danh sách yêu thích khi đã đăng nhập
  'GET /categories': [200, []],
  'GET /products': [200, { items: [], page: 1, pageSize: 12, total: 0 }],
};

export const renderApp = (route = '/') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
