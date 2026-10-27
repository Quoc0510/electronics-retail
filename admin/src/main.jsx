/**
 * @feature [F00][F01] Nền tảng, Phân quyền - Điểm khởi chạy Frontend Admin.
 * Bọc ứng dụng bằng Router (điều hướng trang) và React Query (gọi API, cache dữ liệu), AuthProvider (trạng thái đăng nhập).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initTheme } from '@techstore/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// [F12] Phòng khi script trong index.html không chạy: vẫn có data-theme cho CSS chế độ tối
initTheme();

const queryClient = new QueryClient({
  // Không tự gọi lại khi đổi tab trình duyệt, tránh request thừa
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
