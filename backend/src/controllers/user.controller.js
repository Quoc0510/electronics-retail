/**
 * @feature [F01] Xác thực - Controller hồ sơ cá nhân và sổ địa chỉ (US-04).
 * req.user do middleware authenticate gắn vào; mọi thao tác chỉ tác động lên chính người dùng đó.
 */
import * as userService from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMe = asyncHandler(async (req, res) => {
  res.json(await userService.getProfile(req.user.id));
});

export const updateMe = asyncHandler(async (req, res) => {
  res.json(await userService.updateProfile(req.user.id, req.validated.body));
});

export const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user.id, req.validated.body);
  res.status(204).end();
});

export const listAddresses = asyncHandler(async (req, res) => {
  res.json(await userService.listAddresses(req.user.id));
});

export const createAddress = asyncHandler(async (req, res) => {
  res.status(201).json(await userService.createAddress(req.user.id, req.validated.body));
});

export const updateAddress = asyncHandler(async (req, res) => {
  res.json(
    await userService.updateAddress(req.user.id, req.validated.params.id, req.validated.body),
  );
});

export const deleteAddress = asyncHandler(async (req, res) => {
  await userService.deleteAddress(req.user.id, req.validated.params.id);
  res.status(204).end();
});
