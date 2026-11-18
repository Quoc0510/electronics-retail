/**
 * @feature [F06][F16] Đặt hàng, sổ địa chỉ - Các ô địa chỉ giao hàng dùng chung cho trang đặt hàng và sổ địa chỉ.
 * Khi cửa hàng bật Giao Hàng Nhanh: tỉnh/thành và phường/xã là ô CHỌN CÓ TÌM KIẾM theo danh mục của GHN (địa chỉ mới 2 cấp, không
 * có quận/huyện; một tỉnh có thể hàng trăm phường/xã nên gõ để lọc, không phải cuộn) để tên khớp chính xác khi tính phí. Chưa bật GHN, hoặc không tải được danh mục: quay về ô nhập tay như cũ,
 * nên khách luôn đặt được hàng.
 */
import { ComboboxField, FormField } from '@techstore/shared';
import { useProvinces, useWards } from '../../hooks/useShipping.js';

// Giá trị đang có (địa chỉ cũ nhập tay) không nằm trong danh mục vẫn hiện ra để khách thấy, rồi tự chọn lại nếu muốn đổi
const toOptions = (items, current) => {
  const options = items.map((item) => ({ value: item.name, label: item.name }));
  if (current && !items.some((item) => item.name === current)) {
    options.unshift({ value: current, label: current });
  }
  return options;
};

export default function AddressFields({ form, provider }) {
  const ghn = provider === 'GHN';
  const provinces = useProvinces(ghn);
  const useSelects = ghn && provinces.items.length > 0;
  const province = provinces.items.find((item) => item.name === form.values.province);
  const wards = useWards(useSelects ? province?.id : null);

  if (!useSelects) {
    return (
      <>
        <FormField label="Tỉnh/Thành phố" {...form.bind('province')} />
        <FormField label="Quận/Huyện (nếu có)" {...form.bind('district')} />
        <FormField label="Phường/Xã" {...form.bind('ward')} />
        <FormField label="Số nhà, tên đường" {...form.bind('street')} />
      </>
    );
  }

  const wardsReady = wards.items.length > 0;

  return (
    <>
      <ComboboxField
        label="Tỉnh/Thành phố"
        name="province"
        placeholder="Chọn hoặc gõ để tìm tỉnh/thành phố"
        options={toOptions(provinces.items, form.values.province)}
        value={form.values.province}
        error={form.errors.province}
        onChange={(name) => {
          form.setFieldValue('province', name);
          form.setFieldValue('ward', ''); // phường/xã thuộc tỉnh cũ không còn đúng
          form.setFieldValue('district', ''); // địa chỉ 2 cấp: không có quận/huyện
        }}
      />
      {province && !wardsReady && !wards.loading ? (
        // Không tải được danh sách phường/xã của tỉnh này: cho nhập tay
        <FormField label="Phường/Xã" {...form.bind('ward')} />
      ) : (
        <ComboboxField
          label="Phường/Xã"
          name="ward"
          placeholder={
            !province
              ? 'Chọn tỉnh/thành phố trước'
              : wards.loading
                ? 'Đang tải phường/xã...'
                : 'Chọn hoặc gõ để tìm phường/xã'
          }
          disabled={!province || wards.loading}
          options={toOptions(wards.items, form.values.ward)}
          value={form.values.ward}
          error={form.errors.ward}
          onChange={(name) => form.setFieldValue('ward', name)}
        />
      )}
      <div className="sm:col-span-2">
        <FormField label="Số nhà, tên đường" {...form.bind('street')} />
      </div>
    </>
  );
}
