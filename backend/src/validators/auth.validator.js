/**
 * @feature [F01] Xác thực - Quy tắc kiểm tra dữ liệu gửi lên (Zod).
 * Các quy tắc bám theo acceptance criteria của US-01 → US-04 trong docs/SRS.md.
 */
import { z } from 'zod';

// Email: bỏ khoảng trắng, đổi về chữ thường để "A@x.com" và "a@x.com" là cùng một tài khoản
const email = z.string().trim().toLowerCase().pipe(z.email('Email không đúng định dạng'));

// US-01 AC2: >= 8 ký tự, có cả chữ và số. Tối đa 72 vì bcrypt chỉ đọc 72 byte đầu
const password = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu phải có ít nhất một chữ cái')
  .regex(/\d/, 'Mật khẩu phải có ít nhất một chữ số');

// US-04 AC4: số điện thoại Việt Nam, 10 số và bắt đầu bằng 0
const phone = z
  .string()
  .trim()
  .regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0');

const fullName = z.string().trim().min(1, 'Họ tên không được để trống').max(100);

export const registerSchema = z.object({
  email,
  password,
  fullName,
  phone: phone.optional(),
});

export const loginSchema = z.object({
  email,
  // Khi đăng nhập không áp quy tắc độ mạnh, chỉ cần có giá trị
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Thiếu refresh token'),
});

export const updateProfileSchema = z
  .object({
    fullName: fullName.optional(),
    // null cho phép xóa số điện thoại
    phone: phone.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Không có dữ liệu để cập nhật' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(72),
  newPassword: password,
});

// US-04 AC3: sổ địa chỉ
export const addressSchema = z.object({
  recipientName: fullName,
  phone,
  province: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố').max(100),
  district: z.string().trim().min(1, 'Vui lòng nhập quận/huyện').max(100),
  ward: z.string().trim().min(1, 'Vui lòng nhập phường/xã').max(100),
  street: z.string().trim().min(1, 'Vui lòng nhập số nhà, tên đường').max(200),
  isDefault: z.boolean().optional(),
});

// Cập nhật từng phần: mọi trường đều tùy chọn nhưng phải có ít nhất một trường
export const updateAddressSchema = addressSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Không có dữ liệu để cập nhật' });
