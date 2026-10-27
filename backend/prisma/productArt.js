/**
 * @feature [F04] Dữ liệu mẫu - Sinh ảnh minh họa sản phẩm dạng SVG (không cần mạng, không cần file ảnh có bản quyền).
 * Mỗi sản phẩm là một thiết bị vẽ bằng hình khối đơn giản trên nền chuyển màu theo loại.
 * Chỉ dùng để làm dữ liệu mẫu cho đẹp khi demo; sản phẩm thật dùng ảnh tải lên ở F03.
 */

// [màu đầu, màu cuối] của nền chuyển màu; mỗi loại có vài tông để các sản phẩm không giống hệt nhau
const PALETTES = {
  phone: [
    ['#4f46e5', '#7c3aed'],
    ['#0ea5e9', '#6366f1'],
    ['#ec4899', '#8b5cf6'],
  ],
  laptop: [
    ['#0891b2', '#2563eb'],
    ['#0f172a', '#4338ca'],
  ],
  tablet: [
    ['#059669', '#0891b2'],
    ['#7c3aed', '#db2777'],
  ],
  watch: [
    ['#f59e0b', '#ec4899'],
    ['#14b8a6', '#6366f1'],
  ],
  headphones: [['#e11d48', '#f97316']],
  powerbank: [['#2563eb', '#06b6d4']],
  cable: [['#475569', '#6366f1']],
};

export const ART_KINDS = Object.keys(PALETTES);

// Thân thiết bị màu trắng ngà, màn hình tối chuyển màu nhẹ
const BODY = '#f8fafc';
const SCREEN = 'url(#screen)';

// Mỗi hàm trả về các phần tử SVG vẽ thiết bị ở giữa khung 600x600
const SHAPES = {
  phone: `
    <rect x="215" y="105" width="170" height="370" rx="36" fill="${BODY}"/>
    <rect x="227" y="119" width="146" height="342" rx="26" fill="${SCREEN}"/>
    <circle cx="300" cy="300" r="52" fill="url(#glow)" opacity="0.9"/>
    <rect x="272" y="132" width="56" height="14" rx="7" fill="#020617" opacity="0.85"/>
    <rect x="276" y="436" width="48" height="5" rx="2.5" fill="#fff" opacity="0.5"/>`,
  laptop: `
    <rect x="130" y="150" width="340" height="215" rx="16" fill="${BODY}"/>
    <rect x="142" y="162" width="316" height="191" rx="8" fill="${SCREEN}"/>
    <circle cx="300" cy="258" r="56" fill="url(#glow)" opacity="0.9"/>
    <path d="M86 372h428l-18 26a14 14 0 0 1-11 6H115a14 14 0 0 1-11-6z" fill="${BODY}"/>
    <rect x="262" y="372" width="76" height="9" rx="4.5" fill="#cbd5e1"/>`,
  tablet: `
    <rect x="150" y="125" width="300" height="350" rx="30" fill="${BODY}"/>
    <rect x="164" y="139" width="272" height="322" rx="20" fill="${SCREEN}"/>
    <circle cx="300" cy="300" r="62" fill="url(#glow)" opacity="0.9"/>
    <circle cx="300" cy="150" r="4" fill="#020617" opacity="0.8"/>`,
  watch: `
    <rect x="258" y="62" width="84" height="130" rx="18" fill="${BODY}" opacity="0.85"/>
    <rect x="258" y="408" width="84" height="130" rx="18" fill="${BODY}" opacity="0.85"/>
    <rect x="212" y="170" width="176" height="260" rx="56" fill="${BODY}"/>
    <rect x="226" y="184" width="148" height="232" rx="44" fill="${SCREEN}"/>
    <circle cx="300" cy="300" r="48" fill="none" stroke="#fff" stroke-width="5" opacity="0.8"/>
    <line x1="300" y1="300" x2="300" y2="268" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <line x1="300" y1="300" x2="322" y2="312" stroke="#22d3ee" stroke-width="5" stroke-linecap="round"/>
    <rect x="388" y="260" width="12" height="44" rx="6" fill="#cbd5e1"/>`,
  headphones: `
    <path d="M168 335C168 150 432 150 432 335" fill="none" stroke="${BODY}" stroke-width="30" stroke-linecap="round"/>
    <rect x="132" y="300" width="74" height="150" rx="34" fill="${BODY}"/>
    <rect x="394" y="300" width="74" height="150" rx="34" fill="${BODY}"/>
    <rect x="146" y="318" width="46" height="114" rx="22" fill="${SCREEN}"/>
    <rect x="408" y="318" width="46" height="114" rx="22" fill="${SCREEN}"/>`,
  powerbank: `
    <rect x="190" y="115" width="220" height="370" rx="38" fill="${BODY}"/>
    <rect x="212" y="150" width="176" height="110" rx="18" fill="${SCREEN}"/>
    <rect x="232" y="176" width="136" height="12" rx="6" fill="#22d3ee"/>
    <rect x="232" y="204" width="96" height="12" rx="6" fill="#fff" opacity="0.6"/>
    <rect x="232" y="232" width="116" height="12" rx="6" fill="#fff" opacity="0.35"/>
    <rect x="236" y="300" width="128" height="22" rx="11" fill="#cbd5e1"/>
    <rect x="236" y="338" width="128" height="22" rx="11" fill="#cbd5e1"/>
    <rect x="236" y="376" width="60" height="22" rx="11" fill="#cbd5e1"/>`,
  cable: `
    <path d="M150 400C150 200 450 420 450 200" fill="none" stroke="${BODY}" stroke-width="20" stroke-linecap="round"/>
    <rect x="112" y="396" width="64" height="56" rx="12" fill="${SCREEN}"/>
    <rect x="124" y="452" width="40" height="30" rx="6" fill="#cbd5e1"/>
    <rect x="424" y="148" width="64" height="56" rx="12" fill="${SCREEN}"/>
    <rect x="436" y="118" width="40" height="30" rx="6" fill="#cbd5e1"/>`,
};

// Thêm một số ký tự đặc biệt của XML để tên hãng như "A&B" không làm hỏng file SVG
const escapeXml = (text) =>
  String(text).replace(
    /[<>&"']/g,
    (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch],
  );

/**
 * @param {object} options
 * @param {keyof typeof PALETTES} options.kind Loại thiết bị
 * @param {number} [options.tone] Chọn tông màu trong loại đó (0, 1, 2...)
 * @param {string} options.brand Tên hãng, in ở cuối ảnh
 * @returns {string} Nội dung file SVG
 */
export const renderProductArt = ({ kind, tone = 0, brand }) => {
  const palettes = PALETTES[kind];
  if (!palettes) throw new Error(`Loại thiết bị không hỗ trợ: ${kind}`);
  const [from, to] = palettes[tone % palettes.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${escapeXml(brand)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e1b4b"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="${from}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${to}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="90" cy="90" r="150" fill="#fff" opacity="0.08"/>
  <circle cx="540" cy="520" r="190" fill="#fff" opacity="0.07"/>
  <ellipse cx="300" cy="520" rx="150" ry="14" fill="#020617" opacity="0.22"/>
  ${SHAPES[kind]}
  <text x="300" y="568" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="6" fill="#fff" opacity="0.85">${escapeXml(brand.toUpperCase())}</text>
</svg>
`;
};
