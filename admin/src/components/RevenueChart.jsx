/**
 * @feature [F10] Dashboard - Biểu đồ cột doanh thu theo ngày (US-26 AC1), vẽ bằng SVG, không cần thư viện biểu đồ.
 * Mỗi cột có chú thích khi rê chuột (<title>), và có bảng số liệu dạng văn bản đi kèm cho người dùng trình đọc màn hình.
 */
import { formatVnd } from '@techstore/shared';
import { compactVnd, formatDay, niceMax } from '../lib/chart.js';

const WIDTH = 720;
const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 56 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const LABEL_EVERY = 5;

export default function RevenueChart({ days }) {
  const top = niceMax(Math.max(0, ...days.map((day) => day.revenue)));
  const slot = PLOT_W / days.length;
  const barWidth = Math.max(2, slot - 6);
  const total = days.reduce((sum, day) => sum + day.revenue, 0);
  const ticks = top > 0 ? [0, top / 2, top] : [0];
  const yOf = (value) => MARGIN.top + PLOT_H - (top > 0 ? (value / top) * PLOT_H : 0);
  const withSales = days.filter((day) => day.orders > 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Biểu đồ doanh thu ${days.length} ngày gần nhất, tổng ${formatVnd(total)}`}
          className="h-auto min-w-[560px] w-full"
        >
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yOf(value)}
                y2={yOf(value)}
                className="stroke-slate-200"
                strokeDasharray={value === 0 ? undefined : '3 4'}
              />
              <text
                x={MARGIN.left - 8}
                y={yOf(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-500 text-[11px]"
              >
                {compactVnd(value)}
              </text>
            </g>
          ))}

          {days.map((day, index) => {
            const x = MARGIN.left + index * slot + (slot - barWidth) / 2;
            const height =
              day.revenue > 0 ? Math.max(2, MARGIN.top + PLOT_H - yOf(day.revenue)) : 0;
            const showLabel = index % LABEL_EVERY === 0 || index === days.length - 1;
            return (
              <g key={day.date} data-testid="revenue-bar">
                <title>{`${formatDay(day.date, true)}: ${formatVnd(day.revenue)} · ${day.orders} đơn`}</title>
                {/* Vùng bắt chuột rộng cả ngày để cột thấp cũng dễ rê tới */}
                <rect
                  x={MARGIN.left + index * slot}
                  y={MARGIN.top}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                />
                {height > 0 && (
                  <rect
                    x={x}
                    y={MARGIN.top + PLOT_H - height}
                    width={barWidth}
                    height={height}
                    rx={3}
                    className="fill-brand-500"
                  />
                )}
                {showLabel && (
                  <text
                    x={x + barWidth / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px]"
                  >
                    {formatDay(day.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {total === 0 && (
        <p className="mt-2 text-center text-sm text-slate-500">
          Chưa có đơn hoàn thành trong {days.length} ngày qua.
        </p>
      )}

      {withSales.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-brand-600">Xem bảng số liệu</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Ngày</th>
                  <th className="px-3 py-2 font-medium">Số đơn</th>
                  <th className="px-3 py-2 text-right font-medium">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...withSales].reverse().map((day) => (
                  <tr key={day.date}>
                    <td className="px-3 py-2">{formatDay(day.date, true)}</td>
                    <td className="px-3 py-2">{day.orders}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {formatVnd(day.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
