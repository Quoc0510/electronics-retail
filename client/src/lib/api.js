/**
 * @feature [F00] Nền tảng - Axios dùng chung để gọi Backend API.
 * Khi dev, '/api' được Vite proxy sang backend; khi deploy, đặt VITE_API_URL trỏ tới server thật.
 */
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10000, // quá 10 giây coi như lỗi mạng (xử lý trạng thái timeout theo rubric TC2.2)
});
