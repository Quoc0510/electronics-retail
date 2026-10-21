/**
 * @feature [F00] Nền tảng - Điểm khởi chạy Frontend Client.
 * Bọc ứng dụng bằng Router (điều hướng trang) và React Query (gọi API, cache dữ liệu).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  // Không tự gọi lại khi đổi tab trình duyệt, tránh request thừa
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
