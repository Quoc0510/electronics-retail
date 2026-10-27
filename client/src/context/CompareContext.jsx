/**
 * @feature [F12] So sánh sản phẩm - Danh sách sản phẩm đang chọn để so sánh.
 * Quy tắc: tối đa 4 sản phẩm và phải cùng một danh mục (so điện thoại với cáp sạc không có ý nghĩa).
 * Danh sách lưu ở localStorage nên giữ nguyên khi tải lại trang; chỉ lưu thông tin tối thiểu (slug, tên, ảnh, danh mục),
 * dữ liệu đầy đủ (giá, thông số) được trang so sánh tải mới từ API để không bao giờ cũ.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const COMPARE_MAX = 4;
export const COMPARE_STORAGE_KEY = 'techstore.compare';

// Chỉ nhận đúng dạng dữ liệu mong đợi (người dùng hoặc phiên bản cũ có thể để lại giá trị lạ trong localStorage)
const isValidItem = (item) =>
  item &&
  typeof item.slug === 'string' &&
  typeof item.name === 'string' &&
  typeof item.category?.slug === 'string';

const load = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter(isValidItem).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
};

const save = (items) => {
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Không lưu được thì danh sách chỉ tồn tại trong lần mở trang này
  }
};

// Rút gọn sản phẩm (từ danh sách hoặc chi tiết) về đúng phần cần lưu
const toItem = (product) => ({
  slug: product.slug,
  name: product.name,
  thumbnail: product.thumbnail ?? product.images?.[0]?.url ?? null,
  category: { name: product.category.name, slug: product.category.slug },
});

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [items, setItems] = useState(load);
  // Thông báo khi không thêm được (đầy hoặc khác danh mục); hiện ở thanh so sánh
  const [notice, setNotice] = useState('');

  const update = useCallback((next) => {
    setItems(next);
    save(next);
  }, []);

  const has = useCallback((slug) => items.some((item) => item.slug === slug), [items]);

  const toggle = useCallback(
    (product) => {
      if (items.some((item) => item.slug === product.slug)) {
        setNotice('');
        update(items.filter((item) => item.slug !== product.slug));
        return;
      }
      if (items.length >= COMPARE_MAX) {
        setNotice(`Chỉ so sánh được tối đa ${COMPARE_MAX} sản phẩm. Hãy bỏ bớt một sản phẩm.`);
        return;
      }
      if (items.length > 0 && items[0].category.slug !== product.category.slug) {
        setNotice(`Chỉ so sánh các sản phẩm cùng danh mục "${items[0].category.name}".`);
        return;
      }
      setNotice('');
      update([...items, toItem(product)]);
    },
    [items, update],
  );

  const remove = useCallback(
    (slug) => {
      setNotice('');
      update(items.filter((item) => item.slug !== slug));
    },
    [items, update],
  );

  const clear = useCallback(() => {
    setNotice('');
    update([]);
  }, [update]);

  const dismissNotice = useCallback(() => setNotice(''), []);

  const value = useMemo(
    () => ({ items, has, toggle, remove, clear, notice, dismissNotice }),
    [items, has, toggle, remove, clear, notice, dismissNotice],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) throw new Error('useCompare phải được dùng bên trong CompareProvider');
  return context;
}
