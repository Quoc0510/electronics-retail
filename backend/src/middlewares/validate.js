/**
 * @feature [F00] Nền tảng - Middleware kiểm tra dữ liệu request bằng Zod schema.
 * Dùng: router.post('/', validate(registerSchema), controller)
 * Nếu sai, ZodError được chuyển cho errorHandler và trả về 400 kèm chi tiết từng trường.
 * Nếu đúng, dữ liệu đã được làm sạch (trim, đổi kiểu) gán lại vào req để controller dùng.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    // req.query trong Express 5 chỉ đọc, nên lưu kết quả vào req.validated
    req.validated = { ...req.validated, [source]: result.data };
    return next();
  };
