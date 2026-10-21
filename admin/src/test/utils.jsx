/**
 * @feature [F01] Hàm dùng chung cho test giao diện Admin.
 * Máy chủ giả nằm ở @techstore/shared/testing; ở đây gắn nó với axios của Admin và dựng ứng dụng đầy đủ.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiError, mockServer as mockServerFor } from '@techstore/shared/testing';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export { apiError };

export const admin = {
  id: 2,
  email: 'admin@example.com',
  fullName: 'Quản trị viên',
  role: 'ADMIN',
};
export const customer = {
  id: 1,
  email: 'khach@example.com',
  fullName: 'Khách A',
  role: 'CUSTOMER',
};

export const adminSession = { user: admin, accessToken: 'access-1', refreshToken: 'refresh-1' };
export const customerSession = {
  user: customer,
  accessToken: 'access-2',
  refreshToken: 'refresh-2',
};

export const mockServer = (handlers) => mockServerFor(api, handlers);

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
