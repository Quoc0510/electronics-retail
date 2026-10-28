/**
 * @feature [F01][F06] Kiểm tra địa chỉ giao hàng ở Client, dùng chung cho sổ địa chỉ (F01) và trang đặt hàng (F06).
 * Quy tắc giống backend (backend/src/validators/auth.validator.js addressSchema); backend vẫn kiểm tra lại.
 */
import { isValidPhone } from '@techstore/shared';

export const EMPTY_ADDRESS = {
  recipientName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  street: '',
  isDefault: false,
};

const REQUIRED_FIELDS = {
  recipientName: 'Vui lòng nhập tên người nhận',
  province: 'Vui lòng nhập tỉnh/thành phố',
  district: 'Vui lòng nhập quận/huyện',
  ward: 'Vui lòng nhập phường/xã',
  street: 'Vui lòng nhập số nhà, tên đường',
};

/** Trả về object lỗi theo từng ô (rỗng nếu hợp lệ). */
export const validateAddress = (values) => {
  const errors = {};
  Object.entries(REQUIRED_FIELDS).forEach(([field, message]) => {
    if (!values[field].trim()) errors[field] = message;
  });
  if (!isValidPhone(values.phone)) errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0';
  return errors;
};

/** Chỉ các trường địa chỉ, đã cắt khoảng trắng, đúng dạng backend nhận. */
export const toShippingPayload = (values) => ({
  recipientName: values.recipientName.trim(),
  phone: values.phone.trim(),
  province: values.province.trim(),
  district: values.district.trim(),
  ward: values.ward.trim(),
  street: values.street.trim(),
});
