/**
 * @feature [F16] Ô chọn có tìm kiếm - Kiểm thử ComboboxField: lọc khi gõ (không phân biệt hoa thường và dấu), chọn bằng chuột và
 * bàn phím, đóng bằng Esc hoặc khi rời ô, hiển thị mục đã chọn, khóa và lỗi.
 */
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboboxField } from '../src/index.js';

const OPTIONS = [
  { value: 'Phường Sài Gòn', label: 'Phường Sài Gòn' },
  { value: 'Phường Bến Thành', label: 'Phường Bến Thành' },
  { value: 'Xã Long Sơn', label: 'Xã Long Sơn' },
  { value: 'Đặc khu Côn Đảo', label: 'Đặc khu Côn Đảo' },
];

// Bọc state để thử đúng như một form thật: chọn xong thì giá trị hiện lại trong ô
function Harness({ initial = '', onPick, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <ComboboxField
      label="Phường/Xã"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onPick?.(next);
      }}
      {...props}
    />
  );
}

const box = () => screen.getByLabelText('Phường/Xã');
const names = () => screen.queryAllByRole('option').map((option) => option.textContent);

describe('ComboboxField', () => {
  it('gắn nhãn với ô nhập và đóng sẵn danh sách', () => {
    render(<Harness />);

    expect(box()).toHaveAttribute('role', 'combobox');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('bấm vào ô thì mở danh sách đủ các mục', async () => {
    render(<Harness />);

    await userEvent.click(box());

    expect(screen.getByRole('listbox', { name: 'Danh sách Phường/Xã' })).toBeInTheDocument();
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    expect(names()).toHaveLength(4);
  });

  it('gõ để lọc, không phân biệt hoa thường và dấu tiếng Việt', async () => {
    render(<Harness />);
    await userEvent.click(box());

    await userEvent.type(box(), 'SAI gon');
    expect(names()).toEqual(['Phường Sài Gòn']);

    await userEvent.clear(box());
    await userEvent.type(box(), 'con dao'); // "Đặc khu Côn Đảo": đ -> d
    expect(names()).toEqual(['Đặc khu Côn Đảo']);

    await userEvent.clear(box());
    await userEvent.type(box(), 'phuong'); // khớp ở giữa/đầu chuỗi, ra hai phường
    expect(names()).toEqual(['Phường Sài Gòn', 'Phường Bến Thành']);
  });

  it('không có mục nào khớp thì báo rõ', async () => {
    render(<Harness />);
    await userEvent.click(box());

    await userEvent.type(box(), 'zzz');

    expect(names()).toEqual([]);
    expect(screen.getByText('Không có kết quả phù hợp')).toBeInTheDocument();
  });

  it('bấm một mục thì chọn, đóng danh sách và hiện mục đã chọn trong ô', async () => {
    const picked = [];
    render(<Harness onPick={(value) => picked.push(value)} />);
    await userEvent.click(box());

    await userEvent.click(screen.getByRole('option', { name: 'Xã Long Sơn' }));

    expect(picked).toEqual(['Xã Long Sơn']);
    expect(box()).toHaveValue('Xã Long Sơn');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('mở lại thì mục đang chọn được đánh dấu', async () => {
    render(<Harness initial="Phường Bến Thành" />);

    await userEvent.click(box());

    expect(screen.getByRole('option', { name: 'Phường Bến Thành' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'Xã Long Sơn' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('bàn phím: mũi tên di chuyển, Enter chọn và không gửi form chứa nó', async () => {
    let submitted = false;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <Harness />
        <button type="submit">Gửi</button>
      </form>,
    );
    await userEvent.click(box());

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');

    expect(box()).toHaveValue('Phường Bến Thành'); // xuống 2 lần rồi lên 1 lần: mục thứ hai
    expect(submitted).toBe(false);
  });

  it('Esc đóng danh sách mà không đổi lựa chọn; gõ dở rồi rời ô cũng không đổi', async () => {
    render(<Harness initial="Xã Long Sơn" />);

    await userEvent.click(box());
    await userEvent.type(box(), 'sai');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box()).toHaveValue('Xã Long Sơn');

    await userEvent.click(box());
    await userEvent.type(box(), 'bến');
    await userEvent.tab(); // rời ô
    expect(box()).toHaveValue('Xã Long Sơn');
  });

  it('bị khóa thì không mở được', async () => {
    render(<Harness disabled />);

    await userEvent.click(box());

    expect(box()).toBeDisabled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('hiện lỗi và đánh dấu ô không hợp lệ', () => {
    render(<Harness error="Vui lòng chọn phường/xã" />);

    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Vui lòng chọn phường/xã')).toBeInTheDocument();
  });
});
