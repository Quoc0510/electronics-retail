/**
 * @feature [F02] Thương hiệu - Trang quản lý thương hiệu (US-07).
 */
import TaxonomyPage from '../components/TaxonomyPage.jsx';

export default function BrandsPage() {
  return (
    <TaxonomyPage
      title="Thương hiệu"
      noun="thương hiệu"
      path="/admin/brands"
      imageField="logoUrl"
      imageLabel="Logo (đường dẫn)"
    />
  );
}
