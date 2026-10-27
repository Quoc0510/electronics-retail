/**
 * @feature [F04] Tiêu đề trang Admin dùng chung: tên trang, mô tả ngắn và vùng nút hành động bên phải.
 */
export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
