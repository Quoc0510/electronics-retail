/**
 * @feature [F01] Xác thực - Controller nhận request, gọi service, trả response (không chứa nghiệp vụ).
 */
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated.body);
  res.json(result);
});

export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.validated.body.refreshToken);
  res.json(tokens);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.validated.body.refreshToken);
  res.status(204).end();
});
