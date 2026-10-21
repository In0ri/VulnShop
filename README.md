# 🛒 VulnShop — AuthN/AuthZ Pentest Lab

Một website bán hàng (e-commerce) **đầy đủ chức năng, giao diện đẹp**, nhưng được cài cắm
**nhiều lỗ hổng Authentication & Authorization** để luyện pentest.

Lab mô phỏng thực tế: **một số API kiểm soát truy cập đúng** (trả 401/403 khi vượt quyền),
**một số thì không**. Nhiệm vụ của bạn là tự dò và tìm ra những endpoint bị thủng — danh sách
lỗ hổng và lời giải **không** nằm trong repo này.

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
