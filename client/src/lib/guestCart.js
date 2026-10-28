/**
 * @feature [F05] Giỏ hàng cho khách - Giỏ của khách CHƯA đăng nhập, lưu trên trình duyệt (localStorage).
 * Chỉ lưu { productId, quantity }: giá, tồn kho, trạng thái luôn do máy chủ tính lại (POST /cart/preview) nên không bao giờ cũ.
 * Khi khách đăng nhập, giỏ này được gộp vào giỏ tài khoản (xem CartSync).
 * Là một "store" nhỏ để React theo dõi bằng useSyncExternalStore: ảnh chụp (snapshot) được giữ ổn định cho tới khi
 * dữ liệu thật sự đổi, và các tab khác cùng thấy thay đổi qua sự kiện "storage".
 */
import { MAX_LINE_QUANTITY } from './cartLimits.js';

export const GUEST_CART_KEY = 'techstore.guestCart';
export const MAX_GUEST_ITEMS = 50;

export const EMPTY_GUEST_ITEMS = Object.freeze([]);

const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

// Khi localStorage không dùng được (chế độ riêng tư, bị chặn), giữ giỏ trong bộ nhớ của lần mở trang này
let storageBroken = false;
let memoryRaw = null;
let cache = { raw: undefined, items: EMPTY_GUEST_ITEMS };

const isValidEntry = (entry) =>
  entry &&
  Number.isInteger(entry.productId) &&
  entry.productId > 0 &&
  Number.isInteger(entry.quantity) &&
  entry.quantity >= 1 &&
  entry.quantity <= MAX_LINE_QUANTITY;

const readRaw = () => {
  if (storageBroken) return memoryRaw;
  try {
    return localStorage.getItem(GUEST_CART_KEY);
  } catch {
    storageBroken = true;
    return memoryRaw;
  }
};

/** Danh sách { productId, quantity } hiện có; cùng một mảng (cùng tham chiếu) chừng nào dữ liệu chưa đổi. */
export const getGuestItems = () => {
  const raw = readRaw();
  if (raw === cache.raw) return cache.items;

  let items = EMPTY_GUEST_ITEMS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isValidEntry);
      // Bỏ mục trùng sản phẩm và giới hạn số mục, phòng dữ liệu bị sửa tay
      const seen = new Set();
      const unique = valid.filter(
        (entry) => !seen.has(entry.productId) && seen.add(entry.productId),
      );
      if (unique.length > 0) items = unique.slice(0, MAX_GUEST_ITEMS);
    }
  } catch {
    // Dữ liệu hỏng thì coi như giỏ trống
  }
  cache = { raw, items };
  return items;
};

export const saveGuestItems = (items) => {
  const raw = items.length === 0 ? null : JSON.stringify(items);
  memoryRaw = raw;
  if (!storageBroken) {
    try {
      if (raw === null) localStorage.removeItem(GUEST_CART_KEY);
      else localStorage.setItem(GUEST_CART_KEY, raw);
    } catch {
      storageBroken = true;
    }
  }
  notify();
};

export const clearGuestItems = () => saveGuestItems([]);

export const subscribeGuestCart = (listener) => {
  listeners.add(listener);
  // Tab khác đổi giỏ thì tab này cập nhật theo
  const onStorage = (event) => {
    if (event.key === GUEST_CART_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

// ----- Hàm thuần dựng danh sách mới (không đụng tới bộ nhớ), dễ kiểm thử -----

/** Đặt số lượng một sản phẩm (thêm mục mới ở cuối nếu chưa có), tối đa MAX_LINE_QUANTITY. */
export const withQuantity = (items, productId, quantity) => {
  const next = Math.min(quantity, MAX_LINE_QUANTITY);
  return items.some((entry) => entry.productId === productId)
    ? items.map((entry) => (entry.productId === productId ? { ...entry, quantity: next } : entry))
    : [...items, { productId, quantity: next }];
};

export const withoutProduct = (items, productId) =>
  items.filter((entry) => entry.productId !== productId);

export const guestQuantity = (items, productId) =>
  items.find((entry) => entry.productId === productId)?.quantity ?? 0;

export const guestTotalQuantity = (items) => items.reduce((sum, entry) => sum + entry.quantity, 0);

// Chỉ dùng trong test: đưa store về trạng thái ban đầu
export const resetGuestCartForTests = () => {
  storageBroken = false;
  memoryRaw = null;
  cache = { raw: undefined, items: EMPTY_GUEST_ITEMS };
  listeners.clear();
};
