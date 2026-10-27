/**
 * @feature [F04] Kiểm thử bộ sinh ảnh minh họa SVG cho dữ liệu mẫu.
 */
import { describe, expect, it } from 'vitest';
import { ART_KINDS, renderProductArt } from '../prisma/productArt.js';

describe('renderProductArt', () => {
  it.each(ART_KINDS)('sinh SVG hợp lệ cho loại "%s"', (kind) => {
    const svg = renderProductArt({ kind, brand: 'Apple' });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('APPLE');
  });

  it('đổi tông màu thì nền khác nhau', () => {
    const a = renderProductArt({ kind: 'phone', tone: 0, brand: 'X' });
    const b = renderProductArt({ kind: 'phone', tone: 1, brand: 'X' });

    expect(a).not.toBe(b);
  });

  it('tông màu vượt số lượng thì quay vòng, không lỗi', () => {
    expect(() => renderProductArt({ kind: 'laptop', tone: 99, brand: 'X' })).not.toThrow();
  });

  it('thoát ký tự đặc biệt của XML trong tên hãng (không chèn được thẻ script)', () => {
    const svg = renderProductArt({ kind: 'phone', brand: '<script>alert(1)</script> & "x"' });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;SCRIPT&gt;');
    expect(svg).toContain('&amp;');
  });

  it('từ chối loại thiết bị không hỗ trợ', () => {
    expect(() => renderProductArt({ kind: 'may-bay', brand: 'X' })).toThrow(/không hỗ trợ/);
  });
});
