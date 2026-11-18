/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Máy khách gọi API của GHN (https://developer.ghn.vn).
 * Chỉ BACKEND gọi GHN (Token nằm trong backend/.env, không bao giờ xuống trình duyệt). Dùng mô hình địa chỉ MỚI 2 cấp
 * (tỉnh/thành + phường/xã, áp dụng từ 01/07/2025): danh mục lấy ở /v3/master-data, phí lấy bằng "xem trước đơn" (preview)
 * với is_new_to_address = true vì tài liệu GHN không có endpoint tính phí riêng cho địa chỉ mới. Preview không tạo đơn thật.
 *
 * Mọi lỗi được gom về GhnError với `kind` để nơi gọi quyết định xử lý:
 *   ROUTE       GHN không có tuyến/giá cho địa chỉ này (khách cần đổi địa chỉ);
 *   AUTH        Token, ShopId hoặc IP không được chấp nhận (lỗi cấu hình của cửa hàng, không phải lỗi của khách);
 *   INVALID     GHN từ chối dữ liệu gửi đi (4xx khác);
 *   UNAVAILABLE hết giờ, mất mạng hoặc GHN lỗi 5xx.
 */
import { env } from '../config/env.js';

export class GhnError extends Error {
  constructor(message, { kind, status, codeMessage } = {}) {
    super(message);
    this.name = 'GhnError';
    this.kind = kind;
    this.status = status;
    this.codeMessage = codeMessage;
  }
}

export const isGhnConfigured = () => Boolean(env.GHN_TOKEN && env.ghnShopId);

const PAGE_SIZE = 200; // GHN cho tối đa 200 dòng một lần
const MAX_PAGES = 10;
const ROUTE_CODES = new Set(['ROUTE_NOT_FOUND_SERVICE', 'SERVICE_NOT_FOUND_CONFIG_FEE']);
const AUTH_CODES = new Set(['CLIENT_NOT_OWNER_OF_SHOP']);

const classify = (status, payload) => {
  const codeMessage = payload?.code_message;
  const message = String(payload?.message ?? '');
  if (status === 401 || status === 403 || AUTH_CODES.has(codeMessage)) return 'AUTH';
  if (ROUTE_CODES.has(codeMessage) || /route not found/i.test(message)) return 'ROUTE';
  if (status >= 500) return 'UNAVAILABLE';
  return 'INVALID';
};

const request = async (method, path, { query, body } = {}) => {
  const url = new URL(path, env.GHN_API_URL);
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Token: env.GHN_TOKEN,
        ShopId: String(env.ghnShopId),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(env.GHN_TIMEOUT_MS),
    });
  } catch {
    throw new GhnError('Không kết nối được Giao Hàng Nhanh', { kind: 'UNAVAILABLE' });
  }

  // Lỗi xác thực của master-data có thể trả chữ thuần, không phải JSON
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== 200) {
    throw new GhnError(String(payload?.message ?? `GHN trả mã ${response.status}`), {
      kind: classify(response.status, payload),
      status: response.status,
      codeMessage: payload?.code_message,
    });
  }
  return payload.data;
};

const ACTIVE = 1; // trường status của danh mục: 1 hoạt động, 2 ngưng, 10 đã xóa

/** Danh sách tỉnh/thành đang hoạt động: [{ id, name }]. `name` là chuỗi GHN dùng để so khớp khi tính phí. */
export const fetchProvinces = async () => {
  const data = await request('GET', '/shiip/public-api/v3/master-data/province/all', {
    query: { offset: 0, limit: PAGE_SIZE },
  });
  return (data ?? [])
    .filter((row) => row.status === ACTIVE)
    .map((row) => ({ id: row._id, name: row.name }));
};

/** Phường/xã đang hoạt động của một tỉnh (lấy hết các trang): [{ id, name }]. */
export const fetchWards = async (provinceId) => {
  const wards = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await request('GET', '/shiip/public-api/v3/master-data/ward/all-by-province-id', {
      query: { province_id: provinceId, offset: page * PAGE_SIZE, limit: PAGE_SIZE },
    });
    // province_id sai: GHN vẫn trả 200 nhưng data = null
    if (!rows || rows.length === 0) break;
    wards.push(
      ...rows
        .filter((row) => row.status === ACTIVE)
        .map((row) => ({ id: row._id, name: row.name })),
    );
    if (rows.length < PAGE_SIZE) break;
  }
  return wards;
};

/**
 * Tính phí bằng "xem trước đơn". `order` đã ở dạng trường của GHN (xem shipping.service.js).
 * @returns {Promise<{ fee: number, expectedDeliveryTime: string|null }>} fee = data.total_fee (đồng)
 */
export const previewFee = async (order) => {
  const data = await request('POST', '/shiip/public-api/v2/shipping-order/preview', {
    body: order,
  });
  const fee = data?.total_fee;
  if (!Number.isInteger(fee) || fee < 0) {
    throw new GhnError('GHN trả phí không hợp lệ', { kind: 'INVALID' });
  }
  return { fee, expectedDeliveryTime: data.expected_delivery_time ?? null };
};
