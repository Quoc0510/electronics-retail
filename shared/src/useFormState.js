/**
 * @feature [F01] Xác thực (frontend) - Hook quản lý trạng thái form dùng chung cho mọi form.
 * Lo giúp: giá trị các ô, lỗi từng ô, lỗi từ máy chủ, và khóa nút khi đang gửi (chống bấm đúp).
 */
import { useState } from 'react';
import { getErrorMessage, getFieldErrors } from './errors.js';

export function useFormState(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Trả về các prop (name, value, onChange, error) để gắn thẳng vào <FormField {...bind('email')} />
  const bind = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event) => {
      const { type, checked, value } = event.target;
      setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
      // Người dùng bắt đầu sửa ô nào thì xóa lỗi của ô đó
      setErrors((current) => ({ ...current, [name]: undefined }));
    },
  });

  // Đặt giá trị cho ô không phải <input> thông thường (ví dụ bảng thông số), đồng thời xóa lỗi của ô đó
  const setFieldValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  /**
   * Tạo hàm xử lý onSubmit.
   * @param {(values: object) => Record<string, string>} validate Trả về object lỗi theo ô (rỗng nếu hợp lệ)
   * @param {(values: object) => Promise<void>} action Gọi API; ném lỗi nếu thất bại
   */
  const handleSubmit = (validate, action) => async (event) => {
    event.preventDefault();
    if (submitting) return;

    const found = validate(values);
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await action(values);
    } catch (error) {
      // Lỗi theo từng ô (VALIDATION_ERROR) hiện dưới ô đó; lỗi khác hiện ở khung thông báo chung
      const fieldErrors = getFieldErrors(error);
      setErrors(fieldErrors);
      setServerError(Object.keys(fieldErrors).length > 0 ? '' : getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    values,
    setValues,
    setFieldValue,
    errors,
    serverError,
    setServerError,
    submitting,
    bind,
    handleSubmit,
  };
}
