/**
 * @feature [F03] Sản phẩm - Trang thêm mới và sửa sản phẩm (US-08).
 *  - /san-pham/them : thêm mới. Tạo xong chuyển sang trang sửa để thêm ảnh (ảnh cần có id sản phẩm).
 *  - /san-pham/:id  : sửa thông tin và quản lý ảnh.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormField,
  SelectField,
  getErrorMessage,
  useFormState,
} from '@techstore/shared';
import ProductImages from '../components/ProductImages.jsx';
import SpecsEditor from '../components/SpecsEditor.jsx';
import { api } from '../lib/api.js';

const isPositiveInteger = (text) => /^\d+$/.test(text) && Number(text) > 0;

// Object { "RAM": "8GB" } <-> mảng [{ name: "RAM", value: "8GB" }] để nhập từng dòng
const specsToRows = (specs) =>
  Object.entries(specs ?? {}).map(([name, value]) => ({ name, value }));

// Trả về lỗi theo ô, rỗng nếu hợp lệ. Giống quy tắc ở backend (backend/src/validators/product.validator.js)
const validate = (values) => {
  const errors = {};
  if (!values.sku.trim()) errors.sku = 'Vui lòng nhập SKU';
  else if (!/^[A-Za-z0-9._-]+$/.test(values.sku.trim())) {
    errors.sku = 'SKU chỉ gồm chữ, số và các ký tự . _ -';
  }
  if (!values.name.trim()) errors.name = 'Vui lòng nhập tên sản phẩm';
  if (!values.categoryId) errors.categoryId = 'Vui lòng chọn danh mục';
  if (!values.brandId) errors.brandId = 'Vui lòng chọn thương hiệu';

  if (!isPositiveInteger(values.price)) errors.price = 'Giá gốc phải là số nguyên lớn hơn 0';
  const sale = values.salePrice.trim();
  if (sale) {
    if (!isPositiveInteger(sale)) errors.salePrice = 'Giá khuyến mãi phải là số nguyên lớn hơn 0';
    else if (!errors.price && Number(sale) >= Number(values.price)) {
      errors.salePrice = 'Giá khuyến mãi phải thấp hơn giá gốc';
    }
  }
  if (!/^\d+$/.test(values.stock.trim())) errors.stock = 'Tồn kho phải là số nguyên không âm';

  // Dòng trống hoàn toàn thì bỏ qua; dòng có giá trị mà thiếu tên, hoặc tên trùng nhau là lỗi
  const filled = values.specs.filter((row) => row.name.trim() || row.value.trim());
  const names = filled.map((row) => row.name.trim());
  if (names.some((name) => !name)) errors.specs = 'Mỗi thông số phải có tên';
  else if (new Set(names).size !== names.length) errors.specs = 'Tên thông số bị trùng nhau';

  return errors;
};

const toPayload = (values) => ({
  sku: values.sku.trim(),
  name: values.name.trim(),
  categoryId: Number(values.categoryId),
  brandId: Number(values.brandId),
  price: Number(values.price),
  salePrice: values.salePrice.trim() ? Number(values.salePrice) : null,
  stock: Number(values.stock),
  description: values.description.trim(),
  specs: Object.fromEntries(
    values.specs.filter((row) => row.name.trim()).map((row) => [row.name.trim(), row.value.trim()]),
  ),
  isActive: values.isActive,
});

const toOptions = (items) => (items ?? []).map((item) => ({ value: item.id, label: item.name }));

function ProductForm({ product, categories, brands }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const form = useFormState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    categoryId: product ? String(product.categoryId) : '',
    brandId: product ? String(product.brandId) : '',
    price: product ? String(product.price) : '',
    salePrice: product?.salePrice ? String(product.salePrice) : '',
    stock: product ? String(product.stock) : '0',
    description: product?.description ?? '',
    specs: specsToRows(product?.specs),
    isActive: product?.isActive ?? true,
  });

  const submit = async (values) => {
    setSaved(false);
    const payload = toPayload(values);
    if (product) {
      await api.patch(`/admin/products/${product.id}`, payload);
      await queryClient.invalidateQueries({ queryKey: ['/admin/products'] });
      setSaved(true);
    } else {
      const { data } = await api.post('/admin/products', payload);
      await queryClient.invalidateQueries({ queryKey: ['/admin/products'] });
      // Chuyển sang trang sửa để thêm ảnh; state.created để trang đó báo "đã tạo"
      navigate(`/san-pham/${data.id}`, { replace: true, state: { created: true } });
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(validate, submit)}
      aria-label={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      className="space-y-4 rounded-lg bg-white p-4 shadow"
      noValidate
    >
      {form.serverError && <Alert>{form.serverError}</Alert>}
      {saved && <Alert type="success">Đã lưu thay đổi</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Tên sản phẩm" {...form.bind('name')} />
        <FormField label="SKU (mã sản phẩm)" {...form.bind('sku')} />
        <SelectField
          label="Danh mục"
          placeholder="Chọn danh mục"
          options={toOptions(categories)}
          {...form.bind('categoryId')}
        />
        <SelectField
          label="Thương hiệu"
          placeholder="Chọn thương hiệu"
          options={toOptions(brands)}
          {...form.bind('brandId')}
        />
        <FormField label="Giá gốc (đồng)" type="number" min="1" step="1" {...form.bind('price')} />
        <FormField
          label="Giá khuyến mãi (đồng, để trống nếu không giảm)"
          type="number"
          min="1"
          step="1"
          {...form.bind('salePrice')}
        />
        <FormField label="Tồn kho" type="number" min="0" step="1" {...form.bind('stock')} />
      </div>

      <FormField label="Mô tả" multiline rows={5} {...form.bind('description')} />

      <SpecsEditor
        rows={form.values.specs}
        error={form.errors.specs}
        onChange={(rows) => form.setFieldValue('specs', rows)}
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.values.isActive}
          onChange={form.bind('isActive').onChange}
        />
        Đang bán (hiển thị trên website)
      </label>

      <div className="flex gap-2">
        <Button type="submit" loading={form.submitting}>
          {product ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
        </Button>
        <Link
          to="/san-pham"
          className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Quay lại danh sách
        </Link>
      </div>
    </form>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);

  const categories = useQuery({
    queryKey: ['/admin/categories', 'all'],
    queryFn: () => api.get('/admin/categories').then((res) => res.data),
  });
  const brands = useQuery({
    queryKey: ['/admin/brands', 'all'],
    queryFn: () => api.get('/admin/brands').then((res) => res.data),
  });
  const product = useQuery({
    queryKey: ['/admin/products', id],
    queryFn: () => api.get(`/admin/products/${id}`).then((res) => res.data),
    enabled: isEdit,
  });

  const loading = categories.isPending || brands.isPending || (isEdit && product.isPending);
  const loadError = categories.error ?? brands.error ?? product.error;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">
        {isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      </h1>

      {location.state?.created && (
        <Alert type="success">Đã tạo sản phẩm. Hãy thêm ảnh ở phần bên dưới.</Alert>
      )}

      {loading && !loadError && <p className="text-slate-500">Đang tải...</p>}
      {loadError && <Alert>{getErrorMessage(loadError)}</Alert>}

      {!loading && !loadError && (
        <>
          {/* key để form được khởi tạo lại khi dữ liệu sản phẩm đổi (ví dụ chuyển sang sản phẩm khác) */}
          <ProductForm
            key={product.data?.id ?? 'new'}
            product={product.data}
            categories={categories.data}
            brands={brands.data}
          />
          {isEdit && <ProductImages productId={product.data.id} images={product.data.images} />}
        </>
      )}
    </div>
  );
}
