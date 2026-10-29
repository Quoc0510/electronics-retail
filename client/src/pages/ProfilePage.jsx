/**
 * @feature [F01][F04][F13] Trang tài khoản gồm 3 mục: thông tin cá nhân, đổi mật khẩu, sổ địa chỉ (US-04).
 * Đầu trang có thẻ chào với ảnh đại diện chữ cái đầu; các mục chuyển bằng dải nút dạng viên thuốc.
 * Trang này nằm trong ProtectedRoute nên chắc chắn đã đăng nhập.
 * [F13] Thẻ chào hiện điểm thành viên và tổng đã mua (BR-15: 1.000.000 ₫ tiền hàng được 1 điểm); các số này đổi khi Admin
 * hoàn thành đơn nên luôn tải lại từ máy chủ.
 */
import { useState } from 'react';
import {
  IconLayers,
  IconShield,
  IconStar,
  IconUser,
  POINT_UNIT_VND,
  amountToNextPoint,
  formatVnd,
} from '@techstore/shared';
import { useMe } from '../hooks/useMe.js';
import AddressBook from '../components/profile/AddressBook.jsx';
import PasswordForm from '../components/profile/PasswordForm.jsx';
import ProfileForm from '../components/profile/ProfileForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { id: 'info', label: 'Thông tin cá nhân', Icon: IconUser, Panel: ProfileForm },
  { id: 'password', label: 'Đổi mật khẩu', Icon: IconShield, Panel: PasswordForm },
  { id: 'addresses', label: 'Sổ địa chỉ', Icon: IconLayers, Panel: AddressBook },
];

export default function ProfilePage() {
  const { user } = useAuth();
  // Điểm có thể đã đổi sau khi đăng nhập (đơn được hoàn thành) nên không dùng bản user lưu lúc đăng nhập
  const { points, totalSpent } = useMe();
  const [activeId, setActiveId] = useState('info');
  const { Panel } = TABS.find((tab) => tab.id === activeId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="surface-dark relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-brand-800 to-brand-600 p-6 text-white shadow-glow sm:p-8">
        <div className="bg-tech-grid absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-3xl font-bold backdrop-blur">
            {user.fullName.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">Tài khoản của tôi</h1>
            <p className="truncate text-sm text-white/80">
              {user.fullName} · {user.email}
            </p>
            <p className="text-xs text-white/80">
              Đã mua {formatVnd(totalSpent)} · mua thêm {formatVnd(amountToNextPoint(totalSpent))}{' '}
              để được thêm 1 điểm (mỗi {formatVnd(POINT_UNIT_VND)} tiền hàng được 1 điểm)
            </p>
          </div>
          <p
            aria-label="Điểm thành viên"
            className="flex shrink-0 flex-col items-center rounded-2xl bg-white/15 px-4 py-2 backdrop-blur"
          >
            <span className="flex items-center gap-1.5 font-display text-2xl font-bold">
              <IconStar size={18} aria-hidden="true" />
              {points.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs text-white/80">điểm thành viên</span>
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Mục tài khoản"
        className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={id === activeId}
            onClick={() => setActiveId(id)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              id === activeId
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"
      >
        <Panel />
      </div>
    </div>
  );
}
