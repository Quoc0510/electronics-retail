/**
 * @feature [F12] Trang thông tin - Câu hỏi thường gặp: nhóm theo chủ đề, bấm câu hỏi để mở/đóng câu trả lời,
 * có ô tìm nhanh. Chuẩn truy cập: mỗi câu hỏi là một nút có aria-expanded/aria-controls, câu trả lời là vùng (region)
 * được ẩn bằng thuộc tính hidden khi đóng (nên không bị Tab vào và trình đọc màn hình bỏ qua).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronDown, IconSearch } from '@techstore/shared';
import InfoLayout from '../../components/info/InfoLayout.jsx';
import { FAQ_GROUPS } from '../../lib/policies.js';

// Bỏ dấu tiếng Việt và chữ hoa để tìm "bao hanh" ra "Bảo hành"
const normalize = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function FaqItem({ id, question, answer, open, onToggle }) {
  return (
    <div className="border-b border-slate-200 last:border-0">
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          {question}
          <IconChevronDown
            size={20}
            className={`shrink-0 text-brand-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        hidden={!open}
        className="px-5 pb-5 leading-relaxed text-slate-700"
      >
        {answer}
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const needle = normalize(query.trim());
  const groups = FAQ_GROUPS.map((group, groupIndex) => ({
    ...group,
    groupIndex,
    items: group.items
      .map((item, itemIndex) => ({ ...item, id: `faq-${groupIndex}-${itemIndex}` }))
      .filter((item) => !needle || normalize(`${item.q} ${item.a}`).includes(needle)),
  })).filter((group) => group.items.length > 0);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <InfoLayout
      title="Câu hỏi thường gặp"
      description="Giải đáp nhanh các thắc mắc về đặt hàng, thanh toán, giao hàng, bảo hành và tài khoản."
      crumbs={[{ label: 'Câu hỏi thường gặp' }]}
    >
      <div className="relative">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          aria-label="Tìm câu hỏi"
          placeholder="Tìm câu hỏi, ví dụ: bảo hành, giao hàng..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-full border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          <p className="font-semibold text-slate-900">Không tìm thấy câu hỏi phù hợp.</p>
          <p className="mt-1 text-sm">
            Hãy thử từ khóa khác hoặc{' '}
            <Link to="/lien-he" className="font-semibold text-brand-600 hover:underline">
              liên hệ với chúng tôi
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p role="status" className="text-sm text-slate-500">
            {needle ? `Tìm thấy ${total} câu hỏi` : `${total} câu hỏi`}
          </p>
          {groups.map((group) => (
            <section key={group.title} aria-labelledby={`faq-group-${group.groupIndex}`}>
              <h2
                id={`faq-group-${group.groupIndex}`}
                className="mb-3 text-lg font-bold text-slate-900"
              >
                {group.title}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                {group.items.map((item) => (
                  <FaqItem
                    key={item.id}
                    id={item.id}
                    question={item.q}
                    answer={item.a}
                    open={openId === item.id}
                    onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </InfoLayout>
  );
}
