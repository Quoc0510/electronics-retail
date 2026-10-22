/**
 * @feature [F02] Danh mục và thương hiệu - Hai service cụ thể, tạo từ cùng một "nhà máy" (taxonomy.service.js).
 */
import { createTaxonomyService } from './taxonomy.service.js';

export const categoryService = createTaxonomyService({ model: 'category', label: 'danh mục' });
export const brandService = createTaxonomyService({ model: 'brand', label: 'thương hiệu' });
