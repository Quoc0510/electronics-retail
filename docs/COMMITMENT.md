# Bản cam kết sản phẩm cuối cùng và bộ metric đánh giá

> **BẢN NHÁP.** Rubric yêu cầu chốt và ký trước mốc 50% thời gian (**10/11/2026**). Quá mốc mà chưa có bản này thì đồ án không đủ điều kiện bảo vệ (quy tắc G1). Cần in, ký (sinh viên và giảng viên hướng dẫn) và lưu bản scan vào hồ sơ minh chứng.

**Đề tài:** Xây dựng website bán thiết bị điện tử (TechStore)
**Sinh viên thực hiện:** _(điền họ tên, MSSV của 2 thành viên)_
**Giảng viên hướng dẫn:** _(điền)_
**Thời gian thực hiện:** 21/10/2026 – 30/11/2026

## 1. Sản phẩm cam kết

| Thành phần         | Cam kết                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| Backend REST API   | Express, Prisma, PostgreSQL; xác thực JWT, phân quyền, validate dữ liệu      |
| Frontend Client    | Website khách hàng (React, Tailwind), responsive                             |
| Frontend Admin     | Trang quản trị (React, Tailwind)                                             |
| Môi trường         | Staging công khai có thể truy cập từ internet                                |
| Chức năng bắt buộc | F01–F07, F10 (chi tiết user story và acceptance criteria ở [SRS.md](SRS.md)) |
| Chức năng bổ sung  | F08, F09 nếu đủ thời gian (không tính vào mức cam kết tối thiểu)             |
| Ngoài phạm vi      | Thanh toán trực tuyến (F11), tích hợp vận chuyển thật, ứng dụng di động      |

## 2. Phân công công việc

| Thành viên       | Phần việc                                                             |
| ---------------- | --------------------------------------------------------------------- |
| _(Thành viên 1)_ | _(điền: ví dụ toàn bộ backend, frontend, hạ tầng CI/CD)_              |
| _(Thành viên 2)_ | _(điền: ví dụ khảo sát người dùng, viết tài liệu, kiểm thử thủ công)_ |

## 3. Bộ metric đánh giá (KPI)

| ID     | KPI                                                                 | Ngưỡng cam kết        | Minh chứng                  |
| ------ | ------------------------------------------------------------------- | --------------------- | --------------------------- |
| KPI-01 | Tỉ lệ chức năng Must hoạt động ổn định trên staging                 | 100%                  | Biên bản demo/UAT           |
| KPI-02 | Thời gian phản hồi p95 của API đọc sản phẩm                         | ≤ 500 ms              | Báo cáo đo tải              |
| KPI-03 | Độ phủ test module cốt lõi; tỉ lệ test pass ở lần chạy CI cuối      | ≥ 70%; 100%           | Báo cáo coverage, log CI    |
| KPI-04 | Tỉ lệ hoàn thành tác vụ mua hàng; điểm SUS với ≥ 10 người dùng thật | ≥ 90%; ≥ 68           | Báo cáo thực nghiệm         |
| KPI-05 | Số chặng pipeline; tỉ lệ build xanh; số lần deploy tự động          | ≥ 6; ≥ 90%; ≥ 10      | Lịch sử GitHub Actions      |
| KPI-06 | Điểm Lighthouse Performance (mobile)                                | ≥ 80                  | Báo cáo Lighthouse          |
| KPI-07 | Lỗi ESLint; secret bị lộ; issue Blocker/Critical                    | 0; 0; 0               | ESLint, gitleaks, SonarQube |
| KPI-08 | Số đơn thành công khi 20 đơn đồng thời mua sản phẩm tồn kho 10      | đúng 10, kho không âm | Test tích hợp               |

## 4. Khối lượng công việc cam kết

- 10 tính năng (F01–F07, F10 bắt buộc; F08, F09 bổ sung), 27 user story trong SRS.
- Tài liệu: SRS, SDD, từ điển dữ liệu, kế hoạch kiểm thử, báo cáo thực nghiệm người dùng, nhật ký AI, luận văn.
- Kiểm thử: unit, integration, API, E2E.

## 5. Xác nhận

| Sinh viên 1         | Sinh viên 2         | Giảng viên hướng dẫn |
| ------------------- | ------------------- | -------------------- |
| (Ký, ghi rõ họ tên) | (Ký, ghi rõ họ tên) | (Ký, ghi rõ họ tên)  |

Ngày ký: ____ / 11 / 2026
