/**
 * @feature [F04] Truy vấn danh mục và thương hiệu dùng chung cho thanh danh mục, trang chủ và trang danh sách.
 * Cùng một khóa truy vấn nên React Query chỉ gọi API một lần và chia sẻ kết quả cho mọi nơi dùng.
 * Danh sách được sắp xếp theo thứ tự chữ cái tiếng Việt ở trình duyệt (Điện thoại đứng trước Laptop),
 * vì thứ tự do cơ sở dữ liệu trả về phụ thuộc cấu hình ngôn ngữ của máy chủ.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const sortVietnamese = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((res) => res.data),
    select: sortVietnamese,
  });

export const useBrands = () =>
  useQuery({
    queryKey: ['brands'],
    queryFn: () => api.get('/brands').then((res) => res.data),
    select: sortVietnamese,
  });
