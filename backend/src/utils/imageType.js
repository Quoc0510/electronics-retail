/**
 * @feature [F03] Sản phẩm - Nhận diện loại ảnh bằng "chữ ký" ở đầu file (magic bytes), US-08 AC6.
 * Không tin tên file hay Content-Type do trình duyệt gửi vì người dùng có thể đổi tên một file bất kỳ
 * thành .jpg; chỉ nội dung thật của file mới cho biết nó có phải ảnh hay không.
 */

/** @returns {{ ext: 'jpg'|'png'|'webp', mime: string } | null} null nếu không phải jpg/png/webp */
export const detectImageType = (buffer) => {
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && pngSignature.every((byte, index) => buffer[index] === byte)) {
    return { ext: 'png', mime: 'image/png' };
  }

  // WebP: "RIFF" + 4 byte kích thước + "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
};
