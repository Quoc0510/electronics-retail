/**
 * @feature [F10] Dashboard - Hàm hỗ trợ vẽ biểu đồ doanh thu: rút gọn số tiền trên trục, chọn mốc trục đẹp, định dạng ngày.
 */

// 1,5 thay vì 1.5 (kiểu Việt Nam), bỏ phần thập phân khi tròn
const trim = (value) => String(Math.round(value * 10) / 10).replace('.', ',');

/** Rút gọn tiền cho nhãn trục: 1500000 -> "1,5 tr", 2000000000 -> "2 tỷ". */
export const compactVnd = (value) => {
  if (value >= 1e9) return `${trim(value / 1e9)} tỷ`;
  if (value >= 1e6) return `${trim(value / 1e6)} tr`;
  if (value >= 1e3) return `${trim(value / 1e3)}k`;
  return String(value);
};

const NICE_STEPS = [1, 2, 4, 6, 8, 10];

/** Mốc trên cùng của trục: số "tròn" nhỏ nhất không nhỏ hơn giá trị lớn nhất, để mốc giữa (một nửa) cũng tròn. */
export const niceMax = (value) => {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
};

/** "2026-10-28" -> "28/10" (nhãn trục) hoặc "28/10/2026" (đầy đủ). */
export const formatDay = (date, full = false) => {
  const [year, month, day] = date.split('-');
  return full ? `${day}/${month}/${year}` : `${day}/${month}`;
};
