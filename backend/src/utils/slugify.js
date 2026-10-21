/**
 * @feature [F02] Danh mục/thương hiệu/sản phẩm - Tạo slug thân thiện URL từ tên tiếng Việt.
 * Ví dụ: "Điện thoại Samsung Galaxy S24" -> "dien-thoai-samsung-galaxy-s24".
 */
export const slugify = (text) =>
  text
    .normalize('NFD') // tách dấu khỏi chữ cái
    .replace(/[̀-ͯ]/g, '') // bỏ các dấu
    .replace(/đ/g, 'd') // "đ" không phải ký tự có dấu rời nên phải thay riêng
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // ký tự lạ và khoảng trắng thành dấu gạch
    .replace(/^-+|-+$/g, ''); // bỏ gạch ở đầu và cuối
