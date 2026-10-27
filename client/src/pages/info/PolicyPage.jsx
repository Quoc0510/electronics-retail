/**
 * @feature [F12] Trang thông tin - Chính sách: /chinh-sach (danh sách) và /chinh-sach/:slug (nội dung từng chính sách).
 * Slug không tồn tại thì hiện thông báo thân thiện kèm đường về danh sách chính sách.
 */
import { Link, useParams } from 'react-router-dom';
import { IconArrowRight, IconCash, IconRefresh, IconShield, IconTruck } from '@techstore/shared';
import InfoLayout from '../../components/info/InfoLayout.jsx';
import { POLICIES, getPolicy } from '../../lib/policies.js';

const ICONS = { truck: IconTruck, shield: IconShield, refresh: IconRefresh, cash: IconCash };

function PolicyIndex() {
  return (
    <InfoLayout
      title="Chính sách"
      description="Mọi điều bạn cần biết về vận chuyển, bảo hành, đổi trả, thanh toán và bảo mật khi mua sắm tại TechStore."
      crumbs={[{ label: 'Chính sách' }]}
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {POLICIES.map((policy) => {
          const Icon = ICONS[policy.icon] ?? IconShield;
          return (
            <li key={policy.slug}>
              <Link
                to={`/chinh-sach/${policy.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-md">
                  <Icon size={24} />
                </span>
                <h2 className="text-lg font-bold text-slate-900">{policy.title}</h2>
                <p className="flex-1 text-sm text-slate-600">{policy.summary}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition group-hover:gap-2">
                  Xem chi tiết <IconArrowRight size={16} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </InfoLayout>
  );
}

function PolicyDetail({ policy }) {
  return (
    <InfoLayout
      title={policy.title}
      description={policy.summary}
      crumbs={[{ label: 'Chính sách', to: '/chinh-sach' }, { label: policy.title }]}
    >
      <div className="space-y-8">
        {policy.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">{section.heading}</h2>
            {section.paragraphs?.map((text) => (
              <p key={text} className="leading-relaxed text-slate-700">
                {text}
              </p>
            ))}
            {section.items && (
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3 leading-relaxed text-slate-700">
                    <span
                      aria-hidden="true"
                      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <nav aria-label="Chính sách khác" className="space-y-3 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Chính sách khác
        </h2>
        <ul className="flex flex-wrap gap-2">
          {POLICIES.filter((other) => other.slug !== policy.slug).map((other) => (
            <li key={other.slug}>
              <Link
                to={`/chinh-sach/${other.slug}`}
                className="inline-block rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {other.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </InfoLayout>
  );
}

export default function PolicyPage() {
  const { slug } = useParams();
  if (!slug) return <PolicyIndex />;

  const policy = getPolicy(slug);
  if (!policy) {
    return (
      <InfoLayout
        title="Không tìm thấy chính sách"
        crumbs={[{ label: 'Chính sách', to: '/chinh-sach' }]}
      >
        <p className="text-slate-600">
          Chính sách bạn tìm không tồn tại.{' '}
          <Link to="/chinh-sach" className="font-semibold text-brand-600 hover:underline">
            Xem tất cả chính sách
          </Link>
        </p>
      </InfoLayout>
    );
  }
  return <PolicyDetail policy={policy} />;
}
