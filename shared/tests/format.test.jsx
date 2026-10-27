/**
 * @feature [F03] Kiểm thử hàm định dạng tiền, xử lý đường dẫn ảnh và ô chọn SelectField.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField, discountPercent, formatVnd, resolveAssetUrl } from '../src/index.js';

describe('formatVnd', () => {
  it.each([
    [19990000, '19.990.000 ₫'],
    [290000, '290.000 ₫'],
    [0, '0 ₫'],
  ])('formatVnd(%i) = %s', (amount, expected) => {
    expect(formatVnd(amount)).toBe(expected);
  });
});

describe('discountPercent', () => {
  it.each([
    [20000000, 18000000, 10],
    [1000000, 999000, 0], // giảm 0,1% làm tròn về 0
    [1000000, 500000, 50],
    [1000000, null, 0],
    [1000000, 1000000, 0], // không giảm
    [1000000, 1200000, 0], // dữ liệu sai (giá khuyến mãi cao hơn) không hiện số âm
  ])('discountPercent(%i, %s) = %i', (price, sale, expected) => {
    expect(discountPercent(price, sale)).toBe(expected);
  });
});

describe('resolveAssetUrl', () => {
  it('giữ nguyên ảnh ngoài http/https', () => {
    expect(resolveAssetUrl('https://placehold.co/a.png', 'http://api')).toBe(
      'https://placehold.co/a.png',
    );
  });

  it('thêm địa chỉ gốc vào ảnh do backend lưu', () => {
    expect(resolveAssetUrl('/uploads/products/a.png', 'http://api.example.com')).toBe(
      'http://api.example.com/uploads/products/a.png',
    );
  });

  it('khi dev (origin rỗng) giữ đường dẫn tương đối', () => {
    expect(resolveAssetUrl('/uploads/products/a.png')).toBe('/uploads/products/a.png');
  });

  it('trả null khi không có ảnh', () => {
    expect(resolveAssetUrl(null)).toBeNull();
    expect(resolveAssetUrl('')).toBeNull();
  });
});

describe('SelectField', () => {
  const options = [
    { value: 1, label: 'Điện thoại' },
    { value: 2, label: 'Laptop' },
  ];

  it('có nhãn, lựa chọn mặc định và các lựa chọn', () => {
    render(
      <SelectField
        label="Danh mục"
        options={options}
        placeholder="Chọn danh mục"
        defaultValue=""
      />,
    );

    const select = screen.getByLabelText('Danh mục');
    expect(select).toHaveValue('');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Chọn danh mục',
      'Điện thoại',
      'Laptop',
    ]);
  });

  it('chọn được một lựa chọn', async () => {
    render(<SelectField label="Danh mục" options={options} placeholder="Chọn" defaultValue="" />);

    await userEvent.selectOptions(screen.getByLabelText('Danh mục'), 'Laptop');

    expect(screen.getByLabelText('Danh mục')).toHaveValue('2');
  });

  it('hiện lỗi và đánh dấu không hợp lệ cho trình đọc màn hình', () => {
    render(<SelectField label="Danh mục" options={options} error="Vui lòng chọn danh mục" />);

    const select = screen.getByLabelText('Danh mục');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Vui lòng chọn danh mục');
  });
});
