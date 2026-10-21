/**
 * @feature [F00] Nền tảng - Một PrismaClient dùng chung cho toàn ứng dụng.
 * Tạo nhiều instance sẽ làm cạn kết nối tới PostgreSQL, vì vậy chỉ xuất ra một đối tượng duy nhất.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
