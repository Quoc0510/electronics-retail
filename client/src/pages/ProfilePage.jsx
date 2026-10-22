/**
 * @feature [F01] Xác thực (frontend) - Trang tài khoản gồm 3 mục: thông tin cá nhân, đổi mật khẩu, sổ địa chỉ (US-04).
 * Trang này nằm trong ProtectedRoute nên chắc chắn đã đăng nhập.
 */
import { useState } from 'react';
import AddressBook from '../components/profile/AddressBook.jsx';
import PasswordForm from '../components/profile/PasswordForm.jsx';
import ProfileForm from '../components/profile/ProfileForm.jsx';

const TABS = [
  { id: 'info', label: 'Thông tin cá nhân', Panel: ProfileForm },
  { id: 'password', label: 'Đổi mật khẩu', Panel: PasswordForm },
  { id: 'addresses', label: 'Sổ địa chỉ', Panel: AddressBook },
];

export default function ProfilePage() {
  const [activeId, setActiveId] = useState('info');
  const { Panel } = TABS.find((tab) => tab.id === activeId);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Tài khoản của tôi</h1>

      <div
        role="tablist"
        aria-label="Mục tài khoản"
        className="mb-6 flex flex-wrap gap-2 border-b border-slate-200"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={tab.id === activeId}
            onClick={() => setActiveId(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab.id === activeId
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        <Panel />
      </div>
    </div>
  );
}
