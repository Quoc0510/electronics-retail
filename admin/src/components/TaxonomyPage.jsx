/**
 * @feature [F02] Danh mục và thương hiệu - Trang quản lý dạng bảng: tìm, thêm, sửa, ẩn/hiện, xóa (US-06, US-07).
 * Danh mục và thương hiệu có cùng giao diện nên dùng chung một component, chỉ khác cấu hình truyền vào.
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, IconEdit, IconPlus, IconTrash, getErrorMessage } from '@techstore/shared';
import { api } from '../lib/api.js';
import PageHeader from './PageHeader.jsx';
import TaxonomyForm from './TaxonomyForm.jsx';

export default function TaxonomyPage({
  title,
  noun,
  path,
  imageField,
  imageLabel,
  withDescription = false,
}) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // null: không mở form; 'new': đang thêm; object: đang sửa mục đó
  const [editing, setEditing] = useState(null);

  // Chờ người dùng ngừng gõ 300ms mới tìm, để không gửi một request cho mỗi phím bấm
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: items,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: [path, search],
    queryFn: () => api.get(path, { params: search ? { search } : {} }).then((res) => res.data),
    // Giữ bảng cũ trên màn hình trong lúc tải kết quả tìm mới, tránh nhấp nháy chữ "Đang tải..." mỗi lần gõ
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: [path] });

  // US-06 AC2: ẩn thay vì xóa khi đã có sản phẩm
  const toggleActive = useMutation({
    mutationFn: (item) => api.patch(`${path}/${item.id}`, { isActive: !item.isActive }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (item) => api.delete(`${path}/${item.id}`),
    onSuccess: refresh,
  });

  const handleDelete = (item) => {
    if (window.confirm(`Xóa ${noun} "${item.name}"?`)) remove.mutate(item);
  };

  const actionError = toggleActive.error ?? remove.error;

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={`Quản lý ${noun} hiển thị trên website`}>
        <Button onClick={() => setEditing('new')}>
          <IconPlus size={16} />
          {`Thêm ${noun}`}
        </Button>
      </PageHeader>

      {editing && (
        <TaxonomyForm
          // key để form được khởi tạo lại khi chuyển từ sửa mục này sang mục khác
          key={editing === 'new' ? 'new' : editing.id}
          path={path}
          noun={noun}
          item={editing === 'new' ? null : editing}
          imageField={imageField}
          imageLabel={imageLabel}
          withDescription={withDescription}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}

      <input
        type="search"
        aria-label={`Tìm ${noun}`}
        placeholder={`Tìm ${noun} theo tên...`}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />

      {actionError && <Alert>{getErrorMessage(actionError)}</Alert>}

      {isPending && (
        <p role="status" className="text-slate-500">
          Đang tải...
        </p>
      )}
      {isError && <Alert>{getErrorMessage(error)}</Alert>}

      {items && items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {search
            ? `Không có ${noun} nào khớp "${search}".`
            : `Chưa có ${noun} nào. Bấm "Thêm ${noun}" để tạo mới.`}
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Tên</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Slug</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Số sản phẩm</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 [&>tr]:transition [&>tr:hover]:bg-brand-50/40">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{item.productCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.isActive ? 'Đang hiện' : 'Đang ẩn'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(item)}>
                        <IconEdit size={14} />
                        Sửa
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate(item)}>
                        {item.isActive ? 'Ẩn' : 'Hiện'}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(item)}>
                        <IconTrash size={14} />
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
