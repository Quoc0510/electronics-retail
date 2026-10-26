/**
 * @feature [F03] Kiểm thử setFieldValue của useFormState: đặt giá trị cho ô tùy biến và xóa lỗi của ô đó.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormState } from '../src/index.js';

function TagsForm() {
  const form = useFormState({ tags: [] });
  const validate = (values) => (values.tags.length === 0 ? { tags: 'Cần ít nhất một nhãn' } : {});

  return (
    <form onSubmit={form.handleSubmit(validate, async () => {})} noValidate>
      <p data-testid="tags">{form.values.tags.join(',')}</p>
      {form.errors.tags && <p role="alert">{form.errors.tags}</p>}
      <button type="button" onClick={() => form.setFieldValue('tags', ['a', 'b'])}>
        Thêm nhãn
      </button>
      <button type="submit">Gửi</button>
    </form>
  );
}

describe('useFormState.setFieldValue', () => {
  it('đặt giá trị mới cho ô', async () => {
    render(<TagsForm />);

    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhãn' }));

    expect(screen.getByTestId('tags')).toHaveTextContent('a,b');
  });

  it('xóa lỗi của ô khi giá trị được đặt lại', async () => {
    render(<TagsForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Cần ít nhất một nhãn');

    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhãn' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
