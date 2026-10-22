/**
 * @feature [F02] Danh mục - Trang quản lý danh mục sản phẩm (US-06).
 */
import TaxonomyPage from '../components/TaxonomyPage.jsx';

export default function CategoriesPage() {
  return (
    <TaxonomyPage
      title="Danh mục sản phẩm"
      noun="danh mục"
      path="/admin/categories"
      imageField="imageUrl"
      imageLabel="Ảnh đại diện (đường dẫn)"
      withDescription
    />
  );
}
