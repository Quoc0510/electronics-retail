/**
 * @feature [F03] Sản phẩm - Quản lý ảnh của một sản phẩm: tải lên, đổi thứ tự, xóa (US-08 AC6).
 * Ảnh đầu tiên là ảnh đại diện. Chỉ dùng được khi sản phẩm đã được tạo (cần có id).
 */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, getErrorMessage } from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';

// Giống giới hạn của backend (backend/src/middlewares/upload.js); backend vẫn kiểm tra lại
const MAX_IMAGES = 6;
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Tải ảnh có thể lâu hơn các request thường (tối đa 6 x 2MB) nên cho thời gian chờ dài hơn
const UPLOAD_TIMEOUT_MS = 60000;

// Trả về danh sách lỗi (rỗng nếu hợp lệ) trước khi gửi lên máy chủ
export const validateFiles = (files, existingCount) => {
  const errors = [];
  if (existingCount + files.length > MAX_IMAGES) {
    errors.push(`Mỗi sản phẩm tối đa ${MAX_IMAGES} ảnh (hiện có ${existingCount}).`);
  }
  files.forEach((file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`"${file.name}" không phải ảnh jpg, png hoặc webp.`);
    } else if (file.size > MAX_SIZE) {
      errors.push(`"${file.name}" lớn hơn 2MB.`);
    }
  });
  return errors;
};

export default function ProductImages({ productId, images }) {
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [fileErrors, setFileErrors] = useState([]);

  // Sau mỗi thay đổi ảnh, tải lại chi tiết sản phẩm và danh sách (để ảnh đại diện ở bảng cũng cập nhật)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['/admin/products'] });

  const base = `/admin/products/${productId}/images`;

  const upload = useMutation({
    mutationFn: (files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      return api.post(base, formData, { timeout: UPLOAD_TIMEOUT_MS });
    },
    onSuccess: async () => {
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
    },
  });

  const reorder = useMutation({
    mutationFn: (imageIds) => api.put(`${base}/order`, { imageIds }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (imageId) => api.delete(`${base}/${imageId}`),
    onSuccess: refresh,
  });

  const handleUpload = () => {
    const files = Array.from(fileInput.current?.files ?? []);
    if (files.length === 0) {
      setFileErrors(['Vui lòng chọn ít nhất một ảnh.']);
      return;
    }
    const errors = validateFiles(files, images.length);
    setFileErrors(errors);
    if (errors.length === 0) upload.mutate(files);
  };

  // Đổi chỗ ảnh ở vị trí index với ảnh bên cạnh (offset -1: sang trái, +1: sang phải)
  const move = (index, offset) => {
    const ids = images.map((image) => image.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorder.mutate(ids);
  };

  const handleDelete = (image) => {
    if (window.confirm('Xóa ảnh này?')) remove.mutate(image.id);
  };

  const actionError = upload.error ?? reorder.error ?? remove.error;

  return (
    <section aria-labelledby="images-heading" className="space-y-4 rounded-lg bg-white p-4 shadow">
      <div>
        <h2 id="images-heading" className="text-lg font-semibold text-slate-900">
          Ảnh sản phẩm ({images.length}/{MAX_IMAGES})
        </h2>
        <p className="text-sm text-slate-500">
          Định dạng jpg, png hoặc webp, tối đa 2MB mỗi ảnh. Ảnh đầu tiên là ảnh đại diện.
        </p>
      </div>

      {actionError && <Alert>{getErrorMessage(actionError)}</Alert>}

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Chưa có ảnh nào.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-2 rounded-md border border-slate-200 p-2">
              <img
                src={assetUrl(image.url)}
                alt={`Ảnh sản phẩm ${index + 1}`}
                className="aspect-square w-full rounded object-cover"
              />
              {index === 0 && (
                <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Ảnh đại diện
                </span>
              )}
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="secondary"
                  aria-label={`Chuyển ảnh ${index + 1} sang trái`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                >
                  ←
                </Button>
                <Button
                  variant="secondary"
                  aria-label={`Chuyển ảnh ${index + 1} sang phải`}
                  disabled={index === images.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                >
                  →
                </Button>
                <Button
                  variant="danger"
                  aria-label={`Xóa ảnh ${index + 1}`}
                  onClick={() => handleDelete(image)}
                >
                  Xóa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Chọn ảnh"
          className="block text-sm"
        />
        {fileErrors.length > 0 && (
          <ul role="alert" className="list-inside list-disc text-sm text-red-600">
            {fileErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <Button loading={upload.isPending} onClick={handleUpload}>
          Tải ảnh lên
        </Button>
      </div>
    </section>
  );
}
