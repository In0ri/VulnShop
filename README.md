# 🛒 VulnShop — AuthN/AuthZ Pentest Lab

Một website bán hàng (e-commerce) **đầy đủ chức năng, giao diện đẹp**, nhưng được cài cắm
**nhiều lỗ hổng Authentication & Authorization** để luyện pentest.

> ⚠️ **CHỈ dùng cho đào tạo security có phép.** Toàn bộ dữ liệu là giả, không có giao dịch thật.
> KHÔNG deploy ra Internet. Theo yêu cầu: **không có lỗi SQL Injection** (app không dùng database).

## Chạy lab

```bash
cd vuln-shop-lab
npm install
npm start
# mở http://localhost:3000
```

## Tài khoản mẫu

| Username  | Password          | Role    |
|-----------|-------------------|---------|
| `admin`   | `SuperAdmin!2021` | admin   |
| `alice`   | `password1`       | user    |
| `bob`     | `qwerty123`       | user    |
| `manager` | `Manager#99`      | manager |

---

## 🎯 Danh sách lỗ hổng (16)

### A. Authentication
| # | Lỗ hổng | Vị trí |
|---|---------|--------|
| 1 | **Weak JWT secret** (`shop-secret-2021`, hard-code) | `server.js` `JWT_SECRET` |
| 2 | **JWT `alg:none` accepted** → forge token không cần ký | `verifyToken()` |
| 3 | **JWT expiry không được enforce** → token sống mãi | `verifyToken()` |
| 4 | **User enumeration** (thông báo lỗi khác nhau) | `POST /api/login` |
| 5 | **No rate limiting / lockout** → brute force thoải mái | `POST /api/login` |
| 6 | **Token trong cookie non-HttpOnly + localStorage** → XSS đánh cắp | `/login`, `app.js` |
| 7 | **Predictable password-reset token** (`reset-<id>-<date>`) + trả về trong response | `/forgot-password` |
| 8 | **Reset không gắn danh tính, không hết hạn, không kiểm tra** | `/reset-password` |

### B. Authorization
| # | Lỗ hổng | Vị trí |
|---|---------|--------|
| 9  | **Mass assignment khi đăng ký** → tự set `role:admin`, `balance` | `POST /api/register` |
| 10 | **IDOR — hồ sơ người khác** | `GET /api/users/:id` |
| 11 | **IDOR + mass assignment khi update** → sửa role/balance bất kỳ ai | `PUT /api/users/:id` |
| 12 | **Horizontal privesc — đổi mật khẩu user khác**, không cần mật khẩu cũ | `POST /api/users/:id/change-password` |
| 13 | **Broken function-level authz — liệt kê toàn bộ user (PII)** | `GET /api/users` |
| 14 | **IDOR đơn hàng / invoice** (lộ địa chỉ, thẻ) | `GET /api/orders/:id`, `?userId=`, `/invoice` |
| 15 | **Price manipulation** — server tin `total` từ client | `POST /api/orders` |
| 16 | **Vertical privesc** — admin API không kiểm tra role: header `X-Admin: true`, `?debug=1`, hoặc không cần gì | `GET /api/admin/*`, `DELETE /api/admin/users/:id`, promote |

Phụ: **coupon enumeration** (lộ `VIP50`, `STAFF100` 100%-off) — `GET /api/coupons/:code`; **client-side-only access control** (link Admin chỉ bị `display:none`).

---

## Cấu trúc
```
vuln-shop-lab/
├── server.js            # API + JWT tự viết + toàn bộ lỗ hổng (có comment VULN:)
├── public/
│   ├── index.html       # storefront SPA
│   ├── styles.css       # giao diện tối, hiện đại
│   └── app.js           # router, cart, auth, admin UI
└── README.md
```
Mỗi lỗ hổng trong `server.js` được đánh dấu bằng comment `// VULN:` để tiện đối chiếu khi dạy.
