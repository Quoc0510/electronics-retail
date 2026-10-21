/**
 * @feature [F02] Kiểm thử hàm tạo slug.
 */
import { describe, it, expect } from 'vitest';
import { slugify } from '../src/utils/slugify.js';

describe('slugify', () => {
  it('bỏ dấu tiếng Việt và đổi đ thành d', () => {
    expect(slugify('Điện thoại Samsung Galaxy S24')).toBe('dien-thoai-samsung-galaxy-s24');
  });

  it('gộp ký tự đặc biệt và khoảng trắng thừa thành một dấu gạch', () => {
    expect(slugify('  Laptop   ASUS / ROG!! ')).toBe('laptop-asus-rog');
  });

  it('trả chuỗi rỗng khi không có ký tự hợp lệ', () => {
    expect(slugify('***')).toBe('');
  });
});
