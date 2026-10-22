/**
 * @feature [F01] Kiểm thử các hàm tiện ích dùng chung: lưu token, thông báo lỗi, quy tắc kiểm tra form.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenStorage,
  getErrorMessage,
  getFieldErrors,
  isValidEmail,
  isValidPhone,
  validatePassword,
} from '../src/index.js';

describe('createTokenStorage', () => {
  beforeEach(() => localStorage.clear());

  it('lưu, đọc và xóa token', () => {
    const storage = createTokenStorage('k');
    expect(storage.getAccessToken()).toBeNull();

    storage.setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(storage.getAccessToken()).toBe('a');
    expect(storage.getRefreshToken()).toBe('r');

    storage.clear();
    expect(storage.getAccessToken()).toBeNull();
  });

  it('hai ứng dụng dùng key khác nhau không đè phiên của nhau', () => {
    const client = createTokenStorage('client');
    const admin = createTokenStorage('admin');
    client.setTokens({ accessToken: 'c', refreshToken: 'c' });

    expect(admin.getAccessToken()).toBeNull();
  });

  it('không lỗi khi dữ liệu trong localStorage bị hỏng', () => {
    localStorage.setItem('k', '{khong-phai-json');

    expect(createTokenStorage('k').getAccessToken()).toBeNull();
  });

  it('không lỗi khi localStorage bị chặn', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bị chặn');
    });

    expect(() =>
      createTokenStorage('k').setTokens({ accessToken: 'a', refreshToken: 'r' }),
    ).not.toThrow();
    spy.mockRestore();
  });
});

describe('getErrorMessage', () => {
  it('ưu tiên thông báo do máy chủ trả về', () => {
    const error = { response: { data: { error: { message: 'Email này đã được đăng ký' } } } };

    expect(getErrorMessage(error)).toBe('Email này đã được đăng ký');
  });

  it('báo chậm khi hết thời gian chờ', () => {
    expect(getErrorMessage({ code: 'ECONNABORTED' })).toMatch(/quá chậm/);
  });

  it('báo mất kết nối khi không có phản hồi', () => {
    expect(getErrorMessage({ message: 'Network Error' })).toMatch(/Không kết nối/);
  });

  it('dùng thông báo mặc định khi có phản hồi nhưng không có message', () => {
    expect(getErrorMessage({ response: { status: 500, data: {} } })).toMatch(/Đã có lỗi/);
  });
});

describe('getFieldErrors', () => {
  it('lấy thông báo đầu tiên của từng trường', () => {
    const error = {
      response: {
        data: {
          error: { details: { password: ['Quá ngắn', 'Thiếu số'], email: ['Sai định dạng'] } },
        },
      },
    };

    expect(getFieldErrors(error)).toEqual({ password: 'Quá ngắn', email: 'Sai định dạng' });
  });

  it('trả đối tượng rỗng khi không có chi tiết', () => {
    expect(getFieldErrors({})).toEqual({});
  });
});

describe('quy tắc kiểm tra form', () => {
  it.each([
    ['a@b.com', true],
    ['  a@b.com ', true],
    ['khong-phai-email', false],
    ['a@b', false],
  ])('isValidEmail(%j) = %s', (value, expected) => {
    expect(isValidEmail(value)).toBe(expected);
  });

  it.each([
    ['0912345678', true],
    ['912345678', false],
    ['09123456789', false],
    ['abc', false],
  ])('isValidPhone(%j) = %s', (value, expected) => {
    expect(isValidPhone(value)).toBe(expected);
  });

  it.each([
    ['Ab1', /ít nhất 8/],
    ['12345678', /chữ cái/],
    ['Matkhaucuatoi', /chữ số/],
    ['a1'.repeat(40), /tối đa 72/],
    ['Matkhau123', ''],
  ])('validatePassword(%j)', (value, expected) => {
    const result = validatePassword(value);
    if (expected === '') expect(result).toBe('');
    else expect(result).toMatch(expected);
  });
});
