/**
 * @feature [F05] Giỏ hàng cho khách - Ghi chú sau khi gộp giỏ tạm vào giỏ tài khoản (ví dụ "chỉ thêm được 2 trên 4 sản phẩm").
 * Lưu ở sessionStorage để trang giỏ hàng hiện được dù người dùng mở nó muộn hơn lúc đăng nhập; mất khi đóng tab.
 * Là store nhỏ cho useSyncExternalStore: trang giỏ đang mở lúc gộp xong cũng thấy ghi chú ngay.
 */
export const CART_NOTICE_KEY = 'techstore.cartNotice';

const EMPTY = Object.freeze([]);
const listeners = new Set();
let cache = { raw: undefined, notes: EMPTY };
let memoryRaw = null;
let storageBroken = false;

const readRaw = () => {
  if (storageBroken) return memoryRaw;
  try {
    return sessionStorage.getItem(CART_NOTICE_KEY);
  } catch {
    storageBroken = true;
    return memoryRaw;
  }
};

/** Danh sách ghi chú; cùng một mảng chừng nào dữ liệu chưa đổi. */
export const getCartNotice = () => {
  const raw = readRaw();
  if (raw === cache.raw) return cache.notes;
  let notes = EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const texts = parsed.filter((note) => typeof note === 'string');
      if (texts.length > 0) notes = texts;
    }
  } catch {
    // Dữ liệu hỏng thì coi như không có ghi chú
  }
  cache = { raw, notes };
  return notes;
};

const write = (notes) => {
  const raw = notes.length === 0 ? null : JSON.stringify(notes);
  memoryRaw = raw;
  if (!storageBroken) {
    try {
      if (raw === null) sessionStorage.removeItem(CART_NOTICE_KEY);
      else sessionStorage.setItem(CART_NOTICE_KEY, raw);
    } catch {
      storageBroken = true;
    }
  }
  listeners.forEach((listener) => listener());
};

export const saveCartNotice = (notes) => write(notes);
export const clearCartNotice = () => write([]);

export const subscribeCartNotice = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Chỉ dùng trong test
export const resetCartNoticeForTests = () => {
  storageBroken = false;
  memoryRaw = null;
  cache = { raw: undefined, notes: EMPTY };
  listeners.clear();
};
