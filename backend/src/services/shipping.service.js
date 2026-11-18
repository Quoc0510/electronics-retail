/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Danh mục địa chỉ và ước tính phí cho trang đặt hàng (US-37, US-38).
 *
 * Cách làm: Client gửi địa chỉ (tên tỉnh, tên phường/xã lấy từ danh mục GHN) cùng giỏ hàng; máy chủ tự lấy cân nặng từ CSDL
 * (không tin số Client gửi), gọi GHN "xem trước đơn" để lấy phí. Chưa cấu hình GHN, hoặc GHN lỗi tạm thời (hết giờ, 5xx, từ
 * chối dữ liệu, lỗi Token) thì dùng phí cố định để khách vẫn đặt được (source = FIXED hoặc FALLBACK); chỉ khi GHN nói rõ
 * KHÔNG có tuyến giao thì mới chặn (422 SHIPPING_UNAVAILABLE), để không nhận đơn mà cửa hàng không giao được.
 * Lỗi cấu hình (Token sai...) được ghi log mức error để cửa hàng biết sửa, khách không bị ảnh hưởng.
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../lib/prisma.js';
import { GhnError, fetchProvinces, fetchWards, isGhnConfigured, previewFee } from '../lib/ghn.js';
import { AppError } from '../utils/AppError.js';

export const MAX_WEIGHT_GRAMS = 50_000; // GHN: tối đa 50 kg một đơn
const HEAVY_WEIGHT_GRAMS = 20_000; // từ 20 kg GHN dùng dịch vụ "hàng nặng" (service_type_id 5)
// Kích thước ước lượng (cm) của một kiện: GHN yêu cầu với hàng nặng, ảnh hưởng nhẹ tới phí hàng nhẹ
const PARCEL = { length: 30, width: 20, height: 10 };
const MASTER_TTL_MS = 24 * 60 * 60 * 1000; // danh mục địa chỉ ít đổi: giữ trong bộ nhớ 24 giờ
const PLACEHOLDER = { name: 'Khách hàng TechStore', phone: '0900000000' };

export const SOURCES = { GHN: 'GHN', FIXED: 'FIXED', FALLBACK: 'FALLBACK' };

/** Thông tin cho Client biết đang tính phí kiểu nào và ngưỡng miễn phí (để khỏi cứng số ở trình duyệt). */
export const getShippingConfig = () => ({
  provider: isGhnConfigured() ? 'GHN' : 'FIXED',
  fallbackFee: env.SHIPPING_FALLBACK_FEE,
  freeThreshold: env.SHIPPING_FREE_THRESHOLD,
});

// --- Danh mục địa chỉ (có nhớ tạm) ---------------------------------------------------------------------------------

const cache = new Map(); // key -> { at, value }

const remember = async (key, load) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < MASTER_TTL_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
};

/** Chỉ dùng trong test. */
export const clearShippingCache = () => cache.clear();

const requireGhn = () => {
  if (!isGhnConfigured()) {
    throw new AppError(404, 'Cửa hàng chưa bật tính phí theo địa chỉ', 'SHIPPING_NOT_CONFIGURED');
  }
};

const asServiceError = (error) => {
  if (error instanceof GhnError) {
    logger.error(`[GHN] ${error.kind} ${error.status ?? ''} ${error.message}`);
    return new AppError(
      502,
      'Chưa tải được danh mục địa chỉ, hãy nhập tay hoặc thử lại sau',
      'SHIPPING_UNAVAILABLE',
    );
  }
  return error;
};

export const listProvinces = async () => {
  requireGhn();
  try {
    return await remember('provinces', fetchProvinces);
  } catch (error) {
    throw asServiceError(error);
  }
};

export const listWards = async (provinceId) => {
  requireGhn();
  try {
    return await remember(`wards:${provinceId}`, () => fetchWards(provinceId));
  } catch (error) {
    throw asServiceError(error);
  }
};

// --- Ước tính phí ------------------------------------------------------------------------------------------------------

/** Tổng cân nặng (gram) của các dòng { quantity, weightGrams }. */
export const totalWeight = (lines) =>
  lines.reduce((sum, line) => sum + line.quantity * line.weightGrams, 0);

const toGhnOrder = (address, lines, weight) => ({
  payment_type_id: 1, // cửa hàng trả GHN; khách trả cửa hàng qua tổng tiền đơn COD
  required_note: 'CHOXEMHANGKHONGTHU', // hàng điện tử: cho xem hàng, không cho thử
  to_name: address.recipientName || PLACEHOLDER.name,
  to_phone: address.phone || PLACEHOLDER.phone,
  to_address: [address.street, address.ward, address.province].filter(Boolean).join(', '),
  to_ward_name: address.ward,
  to_province_name: address.province,
  is_new_to_address: true,
  content: 'Thiết bị điện tử TechStore',
  weight,
  ...PARCEL,
  service_type_id: weight >= HEAVY_WEIGHT_GRAMS ? 5 : 2,
  items: lines.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    price: line.price,
    weight: line.weightGrams,
    ...PARCEL,
  })),
});

/**
 * Phí vận chuyển GỐC (trước khi xét miễn phí) cho giỏ hàng gửi tới một địa chỉ.
 * @param {{ recipientName?: string, phone?: string, province: string, ward: string, street?: string }} address
 * @param {Array<{ name: string, quantity: number, weightGrams: number, price: number }>} lines
 * @returns {Promise<{ fee: number, source: 'GHN'|'FIXED'|'FALLBACK', weight: number, expectedDeliveryTime: string|null }>}
 */
export const quoteShipping = async (address, lines) => {
  const weight = totalWeight(lines);
  if (!isGhnConfigured()) {
    return {
      fee: env.SHIPPING_FALLBACK_FEE,
      source: SOURCES.FIXED,
      weight,
      expectedDeliveryTime: null,
    };
  }
  if (weight > MAX_WEIGHT_GRAMS) {
    throw new AppError(
      422,
      `Đơn hàng nặng ${(weight / 1000).toFixed(1)} kg, vượt giới hạn ${MAX_WEIGHT_GRAMS / 1000} kg của đơn vị vận chuyển. Hãy chia thành nhiều đơn`,
      'SHIPPING_TOO_HEAVY',
    );
  }

  try {
    const { fee, expectedDeliveryTime } = await previewFee(toGhnOrder(address, lines, weight));
    return { fee, source: SOURCES.GHN, weight, expectedDeliveryTime };
  } catch (error) {
    if (!(error instanceof GhnError)) throw error;
    if (error.kind === 'ROUTE') {
      throw new AppError(
        422,
        'Giao Hàng Nhanh chưa hỗ trợ giao tới địa chỉ này, hãy kiểm tra lại tỉnh và phường/xã',
        'SHIPPING_UNAVAILABLE',
      );
    }
    // Phần còn lại là sự cố của bên vận chuyển hoặc cấu hình: không chặn khách, dùng phí cố định và báo log để sửa
    logger.error(
      `[GHN] ${error.kind} ${error.status ?? ''} ${error.codeMessage ?? ''} ${error.message}`,
    );
    return {
      fee: env.SHIPPING_FALLBACK_FEE,
      source: SOURCES.FALLBACK,
      weight,
      expectedDeliveryTime: null,
    };
  }
};

/** Giỏ gửi lên (productId, quantity) -> các dòng có cân nặng và giá lấy từ CSDL; sản phẩm không có thì bỏ qua. */
export const linesFromItems = async (items) => {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
    select: { id: true, name: true, price: true, salePrice: true, weightGrams: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return items
    .filter((item) => byId.has(item.productId))
    .map((item) => {
      const product = byId.get(item.productId);
      return {
        name: product.name,
        quantity: item.quantity,
        weightGrams: product.weightGrams,
        price: product.salePrice ?? product.price,
      };
    });
};

/** API /shipping/quote: ước tính phí cho trang đặt hàng. */
export const quoteForItems = async (address, items) => {
  const lines = await linesFromItems(items);
  if (lines.length === 0) throw new AppError(400, 'Giỏ hàng đang trống', 'EMPTY_CART');
  const { fee, source, expectedDeliveryTime } = await quoteShipping(address, lines);
  return { fee, source, expectedDeliveryTime, ...getShippingConfig() };
};
