# 🛒 VulnShop — AuthN/AuthZ Pentest Lab

Một website bán hàng (e-commerce) **đầy đủ chức năng, giao diện đẹp**, nhưng được cài cắm
**nhiều lỗ hổng Authentication & Authorization** để luyện pentest.

Lab mô phỏng thực tế: **một số API kiểm soát truy cập đúng** (trả 401/403 khi vượt quyền),
**một số thì không**. Nhiệm vụ của bạn là tự dò và tìm ra những endpoint bị thủng — danh sách
lỗ hổng và lời giải **không** nằm trong repo này.

> ⚠️ **CHỈ dùng cho đào tạo security có phép.** Toàn bộ dữ liệu là giả, không có giao dịch thật.
> KHÔNG deploy ra Internet. Theo yêu cầu: **không có lỗi SQL Injection** (app không dùng database).

## Chạy lab

### Cách 1 — Docker (khuyến nghị)

Yêu cầu: đã cài [Docker](https://docs.docker.com/engine/install/). Kiểm tra: `docker --version`.

```bash
cd vuln-shop-lab

# 1) Build image từ Dockerfile (đặt tên là "vulnshop")
docker build -t vulnshop .

# 2) Chạy container, map cổng 3000 ra máy host
docker run -d --name vulnshop-lab -p 3000:3000 vulnshop

# 3) Mở trình duyệt: http://localhost:3000
```

Đổi cổng nếu 3000 đang bận (ví dụ chạy ở 8080): `docker run -d --name vulnshop-lab -p 8080:3000 vulnshop`

**Các lệnh quản lý container:**

```bash
docker logs -f vulnshop-lab     # xem log (thấy request khi test)
docker restart vulnshop-lab     # reset dữ liệu về trạng thái gốc (data lưu in-memory)
docker stop vulnshop-lab        # tắt
docker start vulnshop-lab       # bật lại
docker rm -f vulnshop-lab       # xoá container
docker rmi vulnshop             # xoá image (sau khi đã xoá container)
```

Sau khi sửa code, build lại rồi chạy container mới:

```bash
docker rm -f vulnshop-lab
docker build -t vulnshop .
docker run -d --name vulnshop-lab -p 3000:3000 vulnshop
```

### Cách 2 — Docker Compose

```bash
cd vuln-shop-lab
docker compose up -d --build   # build + chạy nền
docker compose logs -f         # xem log
docker compose restart         # reset dữ liệu
docker compose down            # tắt & xoá container
```

### Cách 3 — Node.js trực tiếp (không Docker)

Yêu cầu: Node.js ≥ 18.

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
