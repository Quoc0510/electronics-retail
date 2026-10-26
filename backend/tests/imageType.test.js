/**
 * @feature [F03] Kiểm thử nhận diện loại ảnh bằng chữ ký đầu file (US-08 AC6).
 */
import { describe, expect, it } from 'vitest';
import { detectImageType } from '../src/utils/imageType.js';

const padded = (bytes, total = 32) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(total)]);

describe('detectImageType', () => {
  it('nhận ra JPEG', () => {
    expect(detectImageType(padded([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      ext: 'jpg',
      mime: 'image/jpeg',
    });
  });

  it('nhận ra PNG', () => {
    const png = padded([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(detectImageType(png)).toEqual({ ext: 'png', mime: 'image/png' });
  });

  it('nhận ra WebP', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.alloc(8),
    ]);

    expect(detectImageType(webp)).toEqual({ ext: 'webp', mime: 'image/webp' });
  });

  it.each([
    ['văn bản thường', Buffer.from('hello world, đây không phải ảnh')],
    ['file HTML', Buffer.from('<html><script>alert(1)</script></html>')],
    ['GIF (không nằm trong danh sách cho phép)', Buffer.from('GIF89a......')],
    ['file rỗng', Buffer.alloc(0)],
    [
      'RIFF nhưng không phải WebP (ví dụ WAV)',
      Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)]),
    ],
    ['PNG bị cắt ngắn', Buffer.from([0x89, 0x50, 0x4e])],
  ])('từ chối %s', (_name, buffer) => {
    expect(detectImageType(buffer)).toBeNull();
  });
});
