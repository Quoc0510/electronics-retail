/**
 * @feature [F06][F07] Kiểm thử nhãn và luồng trạng thái đơn hàng dùng chung cho Client và Admin.
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  ORDER_TRANSITIONS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
} from '../src/index.js';

describe('Trạng thái đơn hàng', () => {
  it('mỗi trạng thái đều có nhãn tiếng Việt, màu và luồng', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
      expect(ORDER_STATUS_STYLES[status]).toBeTruthy();
      expect(Array.isArray(ORDER_TRANSITIONS[status])).toBe(true);
    }
    expect(Object.keys(ORDER_STATUS_LABELS)).toEqual(ORDER_STATUSES);
  });

  it('luồng theo BR-06: đi tiến từng bước, hủy được khi chờ xác nhận hoặc đã xác nhận, đơn kết thúc thì đứng yên', () => {
    expect(ORDER_TRANSITIONS.PENDING).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(ORDER_TRANSITIONS.CONFIRMED).toEqual(['SHIPPING', 'CANCELLED']);
    expect(ORDER_TRANSITIONS.SHIPPING).toEqual(['COMPLETED']);
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('không có bước nào dẫn tới trạng thái không tồn tại', () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });

  it('nhãn trạng thái thanh toán COD (BR-08)', () => {
    expect(PAYMENT_STATUS_LABELS).toEqual({ UNPAID: 'Chưa thanh toán', PAID: 'Đã thanh toán' });
  });

  it('formatDateTime định dạng ngày giờ kiểu Việt Nam', () => {
    // Giữa ngày theo UTC để đúng ngày ở mọi múi giờ gần Việt Nam
    expect(formatDateTime('2026-10-28T06:00:00.000Z')).toMatch(/28\/10\/2026/);
    expect(formatDateTime('2026-10-28T06:00:00.000Z')).toMatch(/\d{2}:\d{2}/);
  });
});
