/**
 * @feature [F04][F07][F10] Tìm kiếm - Thoát ký tự đặc biệt của LIKE/ILIKE (\, % và _) trong từ khóa của người dùng.
 * Không thoát thì tìm "%" hay "_" sẽ khớp mọi bản ghi. Prisma `contains` cũng không tự thoát nên phải gọi hàm này trước.
 */
export const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');
