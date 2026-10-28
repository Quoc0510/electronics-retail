/**
 * @feature [F06] Đặt hàng - Sinh mã đơn hàng (BR-12): dạng TSyymmdd-xxxx, trong đó yymmdd là ngày tạo (theo giờ Việt Nam)
 * và xxxx là 4 ký tự ngẫu nhiên. Bỏ các ký tự dễ nhầm (0/O, 1/I) để khách đọc mã qua điện thoại không bị nhầm.
 * Tính duy nhất do ràng buộc UNIQUE của CSDL bảo đảm; khi trùng (hiếm) service tạo mã khác và thử lại.
 */
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Ngày theo múi giờ Việt Nam để mã đơn khớp với ngày khách thấy, không lệch khi máy chủ chạy giờ UTC
const vietnamDateParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}${pick('month')}${pick('day')}`;
};

export const generateOrderCode = (now = new Date(), random = randomInt) => {
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += ALPHABET[random(ALPHABET.length)];
  return `TS${vietnamDateParts(now)}-${suffix}`;
};

// Dùng để kiểm tra tham số trên đường dẫn: chỉ nhận đúng định dạng mã đơn
export const ORDER_CODE_PATTERN = /^TS\d{6}-[A-HJ-NP-Z2-9]{4}$/;
