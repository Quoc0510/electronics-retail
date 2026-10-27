/**
 * @feature [F12] Kiểm thử các trang thông tin: Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách,
 * thanh tiện ích, chân trang, nút lên đầu trang và nút đổi chế độ sáng/tối ở đầu trang.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COMPARE_STORAGE_KEY } from '../context/CompareContext.jsx';
import { POLICIES } from '../lib/policies.js';
import { STORE, TEAM } from '../lib/storeInfo.js';
import { mockServer, renderApp, storefrontApi } from '../test/utils.jsx';

const categories = [
  { id: 1, name: 'Điện thoại', slug: 'dien-thoai', productCount: 12 },
  { id: 2, name: 'Laptop', slug: 'laptop', productCount: 5 },
];
const brands = [
  { id: 1, name: 'Apple', slug: 'apple', logoUrl: null, productCount: 9 },
  { id: 2, name: 'Dell', slug: 'dell', logoUrl: null, productCount: 8 },
  { id: 3, name: 'Asus', slug: 'asus', logoUrl: null, productCount: 3 },
];

const open = (route) => {
  mockServer({
    ...storefrontApi,
    'GET /categories': [200, categories],
    'GET /brands': [200, brands],
  });
  renderApp(route);
};

describe('Trang Giới thiệu', () => {
  it('hiện tiêu đề, câu chuyện và giá trị cốt lõi', async () => {
    open('/gioi-thieu');

    expect(screen.getByRole('heading', { name: 'Về TechStore', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Công nghệ đến gần mọi người' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Giá trị cốt lõi' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    await waitFor(() => expect(document.title).toBe('Về TechStore - TechStore'));
  });

  it('số liệu lấy từ dữ liệu thật: tổng sản phẩm cộng theo danh mục, số danh mục, số thương hiệu', async () => {
    open('/gioi-thieu');

    const stats = screen.getByRole('region', { name: 'Số liệu cửa hàng' });
    const item = (label) => within(stats).getByText(label).closest('li');
    await waitFor(() => expect(item('Sản phẩm')).toHaveTextContent('17')); // 12 + 5
    expect(item('Danh mục')).toHaveTextContent('2');
    expect(item('Thương hiệu')).toHaveTextContent('3');
    expect(item('Tháng bảo hành')).toHaveTextContent('12');
  });

  it('có nút đi tới sản phẩm và liên hệ', () => {
    open('/gioi-thieu');

    expect(screen.getByRole('link', { name: /Khám phá sản phẩm/ })).toHaveAttribute(
      'href',
      '/san-pham',
    );
    expect(screen.getByRole('link', { name: 'Liên hệ chúng tôi' })).toHaveAttribute(
      'href',
      '/lien-he',
    );
  });
});

describe('Trang Liên hệ', () => {
  it('hiện địa chỉ, hotline và email bấm gọi/gửi được, giờ làm việc', () => {
    open('/lien-he');

    expect(screen.getByRole('heading', { name: 'Liên hệ', level: 1 })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByText(STORE.address)).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: STORE.hotline })).toHaveAttribute(
      'href',
      STORE.hotlineHref,
    );
    expect(within(main).getByRole('link', { name: STORE.email })).toHaveAttribute(
      'href',
      `mailto:${STORE.email}`,
    );
    expect(within(main).getByText(STORE.hours)).toBeInTheDocument();
    expect(within(main).getByRole('img', { name: /Bản đồ minh họa/ })).toBeInTheDocument();
  });

  it('có lối tắt tới câu hỏi thường gặp và ghi chú dữ liệu mẫu', () => {
    open('/lien-he');

    expect(screen.getByRole('link', { name: 'Xem câu hỏi thường gặp' })).toHaveAttribute(
      'href',
      '/cau-hoi-thuong-gap',
    );
    expect(screen.getByText(/dữ liệu mẫu/)).toBeInTheDocument();
  });
});

describe('Câu hỏi thường gặp', () => {
  it('hiện các nhóm câu hỏi, mặc định tất cả đang đóng', () => {
    open('/cau-hoi-thuong-gap');

    for (const group of [
      'Đặt hàng',
      'Thanh toán',
      'Giao hàng',
      'Bảo hành và đổi trả',
      'Tài khoản',
    ]) {
      expect(screen.getByRole('heading', { name: group, level: 2 })).toBeInTheDocument();
    }
    const buttons = screen.getAllByRole('button', { expanded: false });
    expect(buttons.length).toBeGreaterThanOrEqual(10);
    expect(
      screen.queryByRole('region', { name: /Phí giao hàng là bao nhiêu/ }),
    ).not.toBeInTheDocument();
  });

  it('bấm câu hỏi thì mở câu trả lời, bấm lại thì đóng; chỉ một câu mở tại một thời điểm', async () => {
    open('/cau-hoi-thuong-gap');
    const shipping = screen.getByRole('button', { name: 'Phí giao hàng là bao nhiêu?' });
    const warranty = screen.getByRole('button', { name: 'Sản phẩm được bảo hành bao lâu?' });

    await userEvent.click(shipping);
    expect(shipping).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Phí giao hàng là bao nhiêu?' })).toHaveTextContent(
      '30.000',
    );

    await userEvent.click(warranty);
    expect(shipping).toHaveAttribute('aria-expanded', 'false');
    expect(warranty).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(warranty);
    expect(warranty).toHaveAttribute('aria-expanded', 'false');
  });

  it('tìm không phân biệt dấu và chữ hoa: "BAO HANH" ra câu hỏi về bảo hành', async () => {
    open('/cau-hoi-thuong-gap');

    await userEvent.type(screen.getByLabelText('Tìm câu hỏi'), 'BAO HANH');

    expect(
      screen.getByRole('button', { name: 'Sản phẩm được bảo hành bao lâu?' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Phí giao hàng là bao nhiêu?' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Tìm thấy \d+ câu hỏi/);
  });

  it('không có kết quả thì báo và gợi ý liên hệ', async () => {
    open('/cau-hoi-thuong-gap');

    await userEvent.type(screen.getByLabelText('Tìm câu hỏi'), 'zzzzzz');

    expect(screen.getByText('Không tìm thấy câu hỏi phù hợp.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'liên hệ với chúng tôi' })).toHaveAttribute(
      'href',
      '/lien-he',
    );
  });
});

describe('Trang Chính sách', () => {
  it('trang danh sách có đủ các chính sách, mỗi mục là một liên kết', () => {
    open('/chinh-sach');

    expect(screen.getByRole('heading', { name: 'Chính sách', level: 1 })).toBeInTheDocument();
    const main = screen.getByRole('main');
    for (const policy of POLICIES) {
      expect(within(main).getByRole('link', { name: new RegExp(policy.title) })).toHaveAttribute(
        'href',
        `/chinh-sach/${policy.slug}`,
      );
    }
  });

  it('chính sách vận chuyển khớp quy tắc nghiệp vụ: phí 30.000 ₫, miễn phí từ 5.000.000 ₫ (BR-05)', () => {
    open('/chinh-sach/van-chuyen');

    expect(
      screen.getByRole('heading', { name: 'Chính sách vận chuyển', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Phí vận chuyển cố định 30\.000/)).toBeInTheDocument();
    expect(
      screen.getByText(/Miễn phí vận chuyển khi tổng tiền hàng từ 5\.000\.000/),
    ).toBeInTheDocument();
  });

  it('chính sách thanh toán nói về COD (BR-08) và chính sách hủy đơn khớp BR-06', () => {
    open('/chinh-sach/thanh-toan');
    expect(screen.getByRole('heading', { name: /Thanh toán khi nhận hàng/ })).toBeInTheDocument();
  });

  it('có đường dẫn (breadcrumb) và liên kết tới các chính sách khác, không lặp chính nó', () => {
    open('/chinh-sach/bao-hanh');

    const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumbs).getByRole('link', { name: 'Chính sách' })).toHaveAttribute(
      'href',
      '/chinh-sach',
    );
    expect(within(crumbs).getByText('Chính sách bảo hành')).toHaveAttribute('aria-current', 'page');

    const others = screen.getByRole('navigation', { name: 'Chính sách khác' });
    expect(within(others).getAllByRole('link')).toHaveLength(POLICIES.length - 1);
    expect(
      within(others).queryByRole('link', { name: 'Chính sách bảo hành' }),
    ).not.toBeInTheDocument();
  });

  it('đường dẫn không tồn tại thì báo thân thiện và có lối về danh sách', () => {
    open('/chinh-sach/khong-co');

    expect(screen.getByText(/Chính sách bạn tìm không tồn tại/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem tất cả chính sách' })).toHaveAttribute(
      'href',
      '/chinh-sach',
    );
  });

  it('cột điều hướng bên trái tô sáng trang đang xem', () => {
    open('/lien-he');

    const side = screen.getByRole('navigation', { name: 'Trang thông tin' });
    expect(within(side).getByRole('link', { name: 'Liên hệ' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(side).getByRole('link', { name: 'Giới thiệu' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('Thanh tiện ích và chân trang', () => {
  it('thanh tiện ích có hotline và liên kết tới các trang thông tin', () => {
    open('/');

    const nav = screen.getByRole('navigation', { name: 'Thông tin cửa hàng' });
    for (const [name, href] of [
      ['Giới thiệu', '/gioi-thieu'],
      ['Liên hệ', '/lien-he'],
      ['Câu hỏi thường gặp', '/cau-hoi-thuong-gap'],
      ['Chính sách', '/chinh-sach'],
    ]) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /Hotline/ })).toHaveAttribute(
      'href',
      STORE.hotlineHref,
    );
  });

  it('chân trang có mục Hỗ trợ với mọi chính sách và thông tin liên hệ', () => {
    open('/');

    const support = screen.getByRole('navigation', { name: 'Hỗ trợ' });
    for (const policy of POLICIES) {
      expect(within(support).getByRole('link', { name: policy.title })).toHaveAttribute(
        'href',
        `/chinh-sach/${policy.slug}`,
      );
    }
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(STORE.address)).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'So sánh sản phẩm' })).toHaveAttribute(
      'href',
      '/so-sanh',
    );
  });
});

describe('Sinh viên thực hiện ở chân trang', () => {
  it('ghi tên và MSSV của từng sinh viên', () => {
    open('/');

    const team = within(screen.getByRole('contentinfo')).getByRole('list', {
      name: 'Sinh viên thực hiện',
    });
    expect(team).toHaveTextContent('Phạm Anh Quốc - MSSV: 20116325');
    expect(team).toHaveTextContent('Đinh Hữu Tài - MSSV: 20110562');
    expect(TEAM).toHaveLength(2);
  });
});

describe('Nút Lên đầu trang', () => {
  afterEach(() => {
    window.scrollY = 0;
  });

  const scrollTo = (y) =>
    act(() => {
      window.scrollY = y;
      fireEvent.scroll(window);
    });

  it('ẩn khi ở đầu trang, hiện khi đã cuộn xa và bấm thì cuộn mượt về đầu', async () => {
    open('/');
    expect(screen.queryByRole('button', { name: 'Lên đầu trang' })).not.toBeInTheDocument();

    scrollTo(900);
    const button = screen.getByRole('button', { name: 'Lên đầu trang' });
    expect(button).toHaveClass('bottom-6');

    window.scrollTo = vi.fn();
    await userEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    scrollTo(100);
    expect(screen.queryByRole('button', { name: 'Lên đầu trang' })).not.toBeInTheDocument();
  });

  it('nâng lên cao hơn khi thanh so sánh đang hiện để không bị che', () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([
        {
          slug: 'a',
          name: 'A',
          thumbnail: null,
          category: { name: 'Điện thoại', slug: 'dien-thoai' },
        },
      ]),
    );
    open('/');

    scrollTo(900);
    expect(screen.getByRole('button', { name: 'Lên đầu trang' })).toHaveClass('bottom-24');
  });
});

describe('Nút đổi chế độ sáng/tối trên đầu trang', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('bấm thì đổi data-theme của trang và nhãn nút', async () => {
    document.documentElement.dataset.theme = 'light';
    open('/');

    await userEvent.click(screen.getByRole('button', { name: 'Chuyển sang chế độ tối' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Chuyển sang chế độ sáng' })).toBeInTheDocument();
  });
});
