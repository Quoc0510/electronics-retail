/**
 * @feature [F12] Trang thông tin - Nội dung các trang chính sách và danh sách câu hỏi thường gặp.
 * Các con số khớp quy tắc nghiệp vụ trong docs/SRS.md: BR-05 (phí giao 30.000 đ, miễn phí từ 5.000.000 đ),
 * BR-06 (hủy đơn khi chờ xác nhận hoặc đã xác nhận), BR-07 (hủy đơn thì trả lại tồn kho), BR-08 (thanh toán khi nhận hàng).
 * Thời gian giao, thời hạn đổi trả là nội dung mẫu của đồ án.
 */

/** Mỗi chính sách: { slug, title, summary, icon (tên biểu tượng), sections: [{ heading, paragraphs?, items? }] } */
export const POLICIES = [
  {
    slug: 'van-chuyen',
    title: 'Chính sách vận chuyển',
    summary: 'Phí giao hàng, thời gian giao và cách kiểm tra hàng khi nhận.',
    icon: 'truck',
    sections: [
      {
        heading: 'Phí vận chuyển',
        items: [
          'Phí vận chuyển cố định 30.000 ₫ cho mỗi đơn hàng.',
          'Miễn phí vận chuyển khi tổng tiền hàng từ 5.000.000 ₫ trở lên.',
          'Phí được hiển thị rõ ở bước đặt hàng, trước khi bạn xác nhận.',
        ],
      },
      {
        heading: 'Thời gian giao hàng dự kiến',
        items: [
          'Nội thành các thành phố lớn: 1 - 2 ngày làm việc.',
          'Các tỉnh thành khác: 3 - 5 ngày làm việc.',
          'Thời gian được tính từ lúc đơn hàng được xác nhận, không tính ngày lễ.',
        ],
      },
      {
        heading: 'Khi nhận hàng',
        items: [
          'Vui lòng kiểm tra nguyên vẹn bao bì và sản phẩm trước khi thanh toán.',
          'Nếu phát hiện sản phẩm sai mẫu, thiếu phụ kiện hoặc hư hỏng, bạn có quyền từ chối nhận và liên hệ hotline để được hỗ trợ ngay.',
        ],
      },
    ],
  },
  {
    slug: 'bao-hanh',
    title: 'Chính sách bảo hành',
    summary: 'Bảo hành chính hãng 12 tháng, điều kiện và cách yêu cầu bảo hành.',
    icon: 'shield',
    sections: [
      {
        heading: 'Thời hạn bảo hành',
        paragraphs: [
          'Mọi sản phẩm chính hãng tại TechStore được bảo hành 12 tháng kể từ ngày nhận hàng, theo tiêu chuẩn của nhà sản xuất.',
        ],
      },
      {
        heading: 'Điều kiện được bảo hành',
        items: [
          'Sản phẩm còn trong thời hạn bảo hành và có thông tin mua hàng tại TechStore.',
          'Lỗi kỹ thuật do nhà sản xuất (lỗi nguồn, màn hình, linh kiện bên trong...).',
          'Tem bảo hành, số seri trên sản phẩm còn nguyên vẹn, rõ ràng.',
        ],
      },
      {
        heading: 'Trường hợp không được bảo hành',
        items: [
          'Sản phẩm rơi vỡ, vào nước, cháy nổ do sử dụng sai cách.',
          'Tự ý tháo, sửa chữa tại nơi không phải trung tâm bảo hành được ủy quyền.',
          'Hao mòn tự nhiên của phụ kiện như vỏ ốp, dây cáp, miếng dán.',
        ],
      },
      {
        heading: 'Cách yêu cầu bảo hành',
        items: [
          'Liên hệ hotline hoặc email của TechStore, cung cấp mã đơn hàng và mô tả lỗi.',
          'Mang sản phẩm đến cửa hàng hoặc gửi theo hướng dẫn của nhân viên hỗ trợ.',
        ],
      },
    ],
  },
  {
    slug: 'doi-tra',
    title: 'Chính sách đổi trả và hủy đơn',
    summary: 'Điều kiện đổi trả, hoàn tiền và cách hủy đơn hàng.',
    icon: 'refresh',
    sections: [
      {
        heading: 'Đổi trả sản phẩm',
        items: [
          'Đổi mới trong 7 ngày kể từ ngày nhận hàng nếu sản phẩm lỗi do nhà sản xuất.',
          'Sản phẩm phải đầy đủ hộp, phụ kiện, quà tặng kèm và không có dấu hiệu va đập, trầy xước do người dùng.',
          'Trường hợp hết hàng đổi, TechStore hoàn tiền theo cách thanh toán ban đầu.',
        ],
      },
      {
        heading: 'Hủy đơn hàng',
        items: [
          'Bạn có thể tự hủy đơn khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận".',
          'Đơn đã chuyển sang "Đang giao" hoặc "Hoàn thành" không thể hủy; vui lòng áp dụng chính sách đổi trả.',
          'Khi đơn bị hủy, số lượng sản phẩm được cộng trả lại kho ngay lập tức.',
        ],
      },
      {
        heading: 'Hoàn tiền',
        paragraphs: [
          'Với đơn thanh toán khi nhận hàng, bạn chưa phải trả tiền nên không phát sinh hoàn tiền khi hủy đơn. Trường hợp đổi trả sau khi đã thanh toán, tiền được hoàn trong 3 - 5 ngày làm việc.',
        ],
      },
    ],
  },
  {
    slug: 'thanh-toan',
    title: 'Chính sách thanh toán',
    summary: 'Thanh toán khi nhận hàng (COD) và các hình thức sắp có.',
    icon: 'cash',
    sections: [
      {
        heading: 'Thanh toán khi nhận hàng (COD)',
        items: [
          'Bạn kiểm tra hàng rồi mới trả tiền mặt cho nhân viên giao hàng.',
          'Đơn mới có trạng thái thanh toán "Chưa thanh toán" và tự chuyển sang "Đã thanh toán" khi đơn hoàn thành.',
        ],
      },
      {
        heading: 'Hình thức thanh toán trực tuyến',
        paragraphs: [
          'Thanh toán qua ví điện tử và cổng thanh toán trực tuyến đang được nghiên cứu để bổ sung ở các phiên bản sau. TechStore sẽ thông báo ngay khi có.',
        ],
      },
      {
        heading: 'Giá và hóa đơn',
        items: [
          'Giá hiển thị là giá đã bao gồm thuế, tính bằng đồng Việt Nam.',
          'Giá của đơn hàng được giữ nguyên tại thời điểm bạn đặt, dù sau đó cửa hàng điều chỉnh giá.',
        ],
      },
    ],
  },
  {
    slug: 'bao-mat',
    title: 'Chính sách bảo mật',
    summary: 'Dữ liệu cá nhân được thu thập, bảo vệ và sử dụng như thế nào.',
    icon: 'shield',
    sections: [
      {
        heading: 'Thông tin chúng tôi thu thập',
        items: [
          'Thông tin tài khoản: họ tên, email, số điện thoại.',
          'Thông tin giao hàng: địa chỉ nhận hàng bạn lưu trong sổ địa chỉ.',
          'Trình duyệt của bạn lưu một số tùy chọn cục bộ như chế độ sáng/tối, danh sách so sánh, sản phẩm đã xem; các dữ liệu này không được gửi về máy chủ.',
        ],
      },
      {
        heading: 'Cách chúng tôi bảo vệ dữ liệu',
        items: [
          'Mật khẩu được băm một chiều (bcrypt) trước khi lưu, kể cả quản trị viên cũng không đọc được mật khẩu của bạn.',
          'Phiên đăng nhập dùng mã truy cập có thời hạn ngắn và mã làm mới có thể thu hồi khi đăng xuất hoặc đổi mật khẩu.',
          'Chỉ tài khoản quản trị mới truy cập được các chức năng quản trị.',
        ],
      },
      {
        heading: 'Quyền của bạn',
        items: [
          'Xem và cập nhật thông tin cá nhân, địa chỉ, mật khẩu trong trang "Tài khoản của tôi".',
          'Không chia sẻ thông tin cá nhân cho bên thứ ba vì mục đích quảng cáo.',
        ],
      },
    ],
  },
];

export const getPolicy = (slug) => POLICIES.find((policy) => policy.slug === slug);

/** Câu hỏi thường gặp, chia theo nhóm. */
export const FAQ_GROUPS = [
  {
    title: 'Đặt hàng',
    items: [
      {
        q: 'Tôi có cần đăng ký tài khoản để xem sản phẩm không?',
        a: 'Không. Bạn xem, tìm kiếm, lọc và so sánh sản phẩm tự do. Chỉ khi thêm vào giỏ và đặt hàng bạn mới cần đăng nhập.',
      },
      {
        q: 'Làm sao để so sánh các sản phẩm?',
        a: 'Bấm nút so sánh trên thẻ hoặc trang chi tiết của sản phẩm. Bạn chọn tối đa 4 sản phẩm cùng danh mục, rồi bấm "So sánh" ở thanh cuối màn hình để xem bảng thông số cạnh nhau.',
      },
      {
        q: 'Tôi có hủy được đơn hàng sau khi đặt không?',
        a: 'Được, khi đơn còn ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận". Đơn đang giao hoặc đã hoàn thành thì không hủy được.',
      },
    ],
  },
  {
    title: 'Thanh toán',
    items: [
      {
        q: 'TechStore hỗ trợ những hình thức thanh toán nào?',
        a: 'Hiện tại là thanh toán khi nhận hàng (COD): bạn kiểm tra hàng rồi mới trả tiền. Thanh toán trực tuyến sẽ được bổ sung sau.',
      },
      {
        q: 'Giá trên website đã gồm thuế chưa?',
        a: 'Giá hiển thị là giá bán cuối cùng đã gồm thuế. Chỉ có phí vận chuyển được cộng thêm ở bước đặt hàng (nếu đơn chưa đủ điều kiện miễn phí).',
      },
    ],
  },
  {
    title: 'Giao hàng',
    items: [
      {
        q: 'Phí giao hàng là bao nhiêu?',
        a: 'Phí cố định 30.000 ₫ mỗi đơn, miễn phí khi tổng tiền hàng từ 5.000.000 ₫.',
      },
      {
        q: 'Bao lâu thì tôi nhận được hàng?',
        a: 'Nội thành các thành phố lớn khoảng 1 - 2 ngày làm việc, các tỉnh thành khác 3 - 5 ngày làm việc kể từ khi đơn được xác nhận.',
      },
      {
        q: 'Tôi có được kiểm tra hàng trước khi thanh toán không?',
        a: 'Có. Bạn nên kiểm tra bao bì và sản phẩm khi nhận; nếu có vấn đề, bạn có quyền từ chối nhận hàng.',
      },
    ],
  },
  {
    title: 'Bảo hành và đổi trả',
    items: [
      {
        q: 'Sản phẩm được bảo hành bao lâu?',
        a: 'Tất cả sản phẩm chính hãng được bảo hành 12 tháng theo tiêu chuẩn của nhà sản xuất.',
      },
      {
        q: 'Điều kiện để đổi sản phẩm lỗi?',
        a: 'Trong 7 ngày kể từ ngày nhận hàng, nếu sản phẩm lỗi do nhà sản xuất, còn đầy đủ hộp và phụ kiện, bạn được đổi mới.',
      },
    ],
  },
  {
    title: 'Tài khoản',
    items: [
      {
        q: 'Tôi quên mật khẩu thì làm thế nào?',
        a: 'Hãy liên hệ hotline hoặc email hỗ trợ để được trợ giúp. Khi đã đăng nhập, bạn có thể đổi mật khẩu trong trang "Tài khoản của tôi".',
      },
      {
        q: 'Thông tin của tôi có an toàn không?',
        a: 'Mật khẩu được băm một chiều trước khi lưu và chúng tôi không chia sẻ dữ liệu cá nhân cho bên thứ ba. Chi tiết xem ở Chính sách bảo mật.',
      },
    ],
  },
];
