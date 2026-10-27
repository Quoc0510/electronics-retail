/**
 * @feature [F12] Sản phẩm đã xem gần đây - Lưu tối đa 8 sản phẩm khách vừa mở trang chi tiết, mới nhất đứng đầu.
 * Chỉ lưu thông tin để nhận diện (slug, tên, ảnh, thương hiệu) và KHÔNG lưu giá: giá đổi theo thời gian nên
 * người dùng xem giá thật khi mở lại trang chi tiết, tránh hiển thị giá cũ.
 */
export const RECENT_STORAGE_KEY = 'techstore.recent';
export const RECENT_MAX = 8;

const isValid = (item) => item && typeof item.slug === 'string' && typeof item.name === 'string';

export const getRecent = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter(isValid).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
};

/** Ghi nhận một sản phẩm vừa xem: đưa lên đầu, bỏ bản trùng, cắt còn RECENT_MAX. */
export const pushRecent = (product) => {
  const item = {
    slug: product.slug,
    name: product.name,
    thumbnail: product.images?.[0]?.url ?? product.thumbnail ?? null,
    brand: product.brand?.name ?? '',
  };
  const next = [item, ...getRecent().filter((existing) => existing.slug !== item.slug)].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Không lưu được thì bỏ qua, đây chỉ là tiện ích phụ
  }
};

export const clearRecent = () => {
  try {
    localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // Bỏ qua
  }
};
