/**
 * @feature [F01] Xác thực (frontend) - Khung thông báo lỗi hoặc thành công.
 * role="alert" để trình đọc màn hình đọc ngay khi lỗi xuất hiện.
 */
const STYLES = {
  error: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-green-200 bg-green-50 text-green-700',
};

export default function Alert({ type = 'error', children }) {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-4 py-3 text-sm ${STYLES[type]}`}
    >
      {children}
    </div>
  );
}
