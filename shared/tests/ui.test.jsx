/**
 * @feature [F01] Kiểm thử các thành phần giao diện dùng chung: FormField, Button, Alert.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert, Button, FormField } from '../src/index.js';

describe('FormField', () => {
  it('gắn nhãn với ô nhập để bấm vào nhãn hoặc trình đọc màn hình đều tìm được ô', () => {
    render(<FormField label="Email" name="email" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('hiện lỗi và đánh dấu ô không hợp lệ cho trình đọc màn hình', () => {
    render(<FormField label="Email" error="Email không đúng định dạng" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Email không đúng định dạng');
  });

  it('multiline hiển thị ô nhập nhiều dòng', () => {
    render(<FormField label="Mô tả" multiline />);

    expect(screen.getByLabelText('Mô tả').tagName).toBe('TEXTAREA');
  });

  it('không hiện lỗi khi hợp lệ', () => {
    render(<FormField label="Email" />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('Button', () => {
  it('gọi onClick khi bấm', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Lưu</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('khóa nút khi đang tải để không bấm đúp', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Lưu
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Lưu' });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('mặc định là type=button để không vô tình gửi form', () => {
    render(<Button>Hủy</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Alert', () => {
  it('lỗi dùng role=alert để được đọc ngay', () => {
    render(<Alert>Có lỗi</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent('Có lỗi');
  });

  it('thông báo thành công dùng role=status', () => {
    render(<Alert type="success">Đã lưu</Alert>);

    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu');
  });
});
