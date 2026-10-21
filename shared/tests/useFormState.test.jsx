/**
 * @feature [F01] Kiểm thử hook useFormState: kiểm tra dữ liệu, lỗi từ máy chủ, chống gửi hai lần.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert, FormField, useFormState } from '../src/index.js';

// Form mẫu dùng hook, để kiểm thử qua thao tác người dùng thật
function TestForm({ action, validate }) {
  const form = useFormState({ name: '', agree: false });
  return (
    <form onSubmit={form.handleSubmit(validate, action)} noValidate>
      {form.serverError && <Alert>{form.serverError}</Alert>}
      <FormField label="Tên" {...form.bind('name')} />
      <label>
        Đồng ý
        <input type="checkbox" checked={form.values.agree} onChange={form.bind('agree').onChange} />
      </label>
      <button type="submit">Gửi</button>
    </form>
  );
}

const requireName = ({ name }) => (name.trim() ? {} : { name: 'Vui lòng nhập tên' });

describe('useFormState', () => {
  it('không gọi action khi dữ liệu không hợp lệ và hiện lỗi dưới ô', async () => {
    const action = vi.fn();
    render(<TestForm action={action} validate={requireName} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng nhập tên')).toBeInTheDocument();
  });

  it('xóa lỗi của ô khi người dùng bắt đầu sửa', async () => {
    render(<TestForm action={vi.fn()} validate={requireName} />);
    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    await userEvent.type(screen.getByLabelText('Tên'), 'A');

    expect(screen.queryByText('Vui lòng nhập tên')).not.toBeInTheDocument();
  });

  it('gọi action với giá trị đã nhập, kể cả ô checkbox', async () => {
    const action = vi.fn().mockResolvedValue();
    render(<TestForm action={action} validate={requireName} />);

    await userEvent.type(screen.getByLabelText('Tên'), 'Lan');
    await userEvent.click(screen.getByLabelText('Đồng ý'));
    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(action).toHaveBeenCalledWith({ name: 'Lan', agree: true });
  });

  it('hiện lỗi theo ô khi máy chủ trả VALIDATION_ERROR', async () => {
    const error = { response: { data: { error: { details: { name: ['Tên đã tồn tại'] } } } } };
    render(<TestForm action={vi.fn().mockRejectedValue(error)} validate={() => ({})} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByText('Tên đã tồn tại')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hiện khung lỗi chung khi lỗi không thuộc ô nào', async () => {
    const error = { response: { data: { error: { message: 'Email này đã được đăng ký' } } } };
    render(<TestForm action={vi.fn().mockRejectedValue(error)} validate={() => ({})} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được đăng ký');
  });

  it('hiện thông báo mất kết nối khi không có phản hồi từ máy chủ', async () => {
    render(
      <TestForm
        action={vi.fn().mockRejectedValue(new Error('Network Error'))}
        validate={() => ({})}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Không kết nối được máy chủ/);
  });

  it('bấm đúp chỉ gửi một lần khi lần đầu chưa xong', async () => {
    let finish;
    const action = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    render(<TestForm action={action} validate={() => ({})} />);
    const button = screen.getByRole('button', { name: 'Gửi' });

    await userEvent.click(button);
    await userEvent.click(button);
    finish();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
