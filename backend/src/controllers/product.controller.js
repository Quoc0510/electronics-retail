/**
 * @feature [F03] Sản phẩm - Controller nhận request, gọi service, trả response (không chứa nghiệp vụ).
 */
import * as imageService from '../services/productImage.service.js';
import * as productService from '../services/product.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await productService.listProducts(req.validated.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await productService.getProduct(req.validated.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await productService.createProduct(req.validated.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await productService.updateProduct(req.validated.params.id, req.validated.body));
});

export const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.validated.params.id);
  res.status(204).end();
});

// Ảnh: req.files do middleware uploadImages (multer) điền vào
export const addImages = asyncHandler(async (req, res) => {
  res.status(201).json(await imageService.addImages(req.validated.params.id, req.files));
});

export const reorderImages = asyncHandler(async (req, res) => {
  res.json(await imageService.reorderImages(req.validated.params.id, req.validated.body.imageIds));
});

export const deleteImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.validated.params;
  await imageService.deleteImage(id, imageId);
  res.status(204).end();
});
