/**
 * @feature [F14] Nhập sản phẩm từ Excel - Controller (chỉ ADMIN, xem admin.routes.js): tải file mẫu, xem trước, nhập, tải các dòng lỗi.
 * File được đọc từ bộ nhớ (req.file.buffer, xem middlewares/upload.js), không ghi ra đĩa.
 */
import * as importService from '../services/productImport.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Tên file ASCII để mọi trình duyệt đều tải đúng (tên có dấu dễ bị lỗi mã hóa trong header)
const sendXlsx = (res, buffer, fileName) => {
  res.setHeader('Content-Type', importService.XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};

export const template = asyncHandler(async (req, res) => {
  const { mode } = req.validated.query;
  const fileName = mode === 'update' ? 'cap-nhat-san-pham.xlsx' : 'mau-nhap-san-pham.xlsx';
  sendXlsx(res, await importService.buildTemplate(mode), fileName);
});

export const preview = asyncHandler(async (req, res) => {
  res.json(await importService.previewImport(req.file.buffer, req.validated.query.mode));
});

export const run = asyncHandler(async (req, res) => {
  res.json(await importService.runImport(req.file.buffer, req.validated.query.mode));
});

export const errorFile = asyncHandler(async (req, res) => {
  sendXlsx(
    res,
    await importService.buildErrorFile(req.file.buffer, req.validated.query.mode),
    'dong-loi.xlsx',
  );
});
