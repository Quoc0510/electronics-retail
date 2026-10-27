/**
 * @feature [F12] Trang thông tin - Thông tin cửa hàng dùng chung cho thanh tiện ích, chân trang và trang Liên hệ.
 * LƯU Ý: đây là dữ liệu MẪU cho đồ án (địa chỉ, hotline, email không có thật). Khi triển khai thật chỉ cần sửa ở đây.
 */
export const STORE = {
  name: 'TechStore',
  hotline: '1900 0000',
  hotlineHref: 'tel:19000000',
  email: 'hotro@techstore.local',
  address: '123 Đường Công Nghệ, Quận 1, TP. Hồ Chí Minh',
  hours: '8:00 - 21:00 mỗi ngày, kể cả lễ',
};

// Các trang thông tin hiển thị ở thanh tiện ích, chân trang và thanh điều hướng của trang thông tin
export const INFO_LINKS = [
  { to: '/gioi-thieu', label: 'Giới thiệu' },
  { to: '/lien-he', label: 'Liên hệ' },
  { to: '/cau-hoi-thuong-gap', label: 'Câu hỏi thường gặp' },
  { to: '/chinh-sach', label: 'Chính sách' },
];

// Sinh viên thực hiện đồ án, hiển thị ở chân trang để ghi nhận tác giả
export const TEAM = [
  { name: 'Phạm Anh Quốc', studentId: '20116325' },
  { name: 'Đinh Hữu Tài', studentId: '20110562' },
];
