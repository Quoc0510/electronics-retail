/**
 * @feature [F04] Biểu tượng cho từng danh mục theo slug (danh mục mới thêm sau dùng biểu tượng hộp mặc định).
 */
import {
  IconBox,
  IconHeadphones,
  IconLaptop,
  IconPhone,
  IconTablet,
  IconWatch,
} from '@techstore/shared';

const ICONS = {
  'dien-thoai': IconPhone,
  laptop: IconLaptop,
  'may-tinh-bang': IconTablet,
  'phu-kien': IconHeadphones,
  'dong-ho-thong-minh': IconWatch,
};

export const categoryIcon = (slug) => ICONS[slug] ?? IconBox;
