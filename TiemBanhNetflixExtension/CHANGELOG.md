# Changelog - Tiệm Bánh Netflix Extension

## [1.3.0] - 2025-10-26

### 🔄 Changed - Generic Cookie Parsing
- **Thay đổi logic parse cookie để giống Cookie-Editor**
- Khi import cookie dạng `name=value`, extension giờ chỉ parse ra `name` và `value`
- **Không còn hardcode** các field: `domain`, `path`, `secure`, `httpOnly`, `sameSite`
- Để browser tự động điền các giá trị mặc định dựa trên URL và context

### 📊 So sánh với version cũ:

#### Version 1.2.0 (Netflix-Specific):
```javascript
// Hardcode values cho Netflix
{
  name: 'NetflixId',
  value: 'abc123',
  domain: '.netflix.com',      // ✅ Wildcard subdomain
  path: '/',
  secure: true,
  httpOnly: false,
  sameSite: 'no_restriction'   // ✅ Không bị SameSite policy block
}
```

#### Version 1.3.0 (Generic):
```javascript
// Để browser tự động điền
{
  name: 'NetflixId',
  value: 'abc123',
  domain: null,                // ❗ Browser tự set = 'www.netflix.com'
  path: null,                  // ❗ Browser tự set = '/'
  secure: null,                // ❗ Browser tự set = true (HTTPS)
  httpOnly: null,              // ❗ Browser tự set = false
  sameSite: undefined          // ❗ Browser tự set = 'lax'
}
```

### ⚠️ Tác động:
- **Domain**: Cookie sẽ chỉ work cho exact domain (`www.netflix.com`) thay vì wildcard (`.netflix.com`)
- **SameSite**: Sẽ dùng `lax` thay vì `no_restriction`, có thể bị block trong một số trường hợp
- **Khả năng tương thích**: Tương tự như Cookie-Editor extension

### 🎯 Lý do thay đổi:
- Đồng bộ hành vi với Cookie-Editor extension (tiêu chuẩn industry)
- Giảm hardcoding, tăng tính linh hoạt
- Dễ maintain và debug hơn

---

## [1.2.0] - Previous Version

### Features
- Auto cleanup Netflix cookies
- Monitor Netflix tab
- Inject cookies with Netflix-specific settings
- Support multiple cookie formats

---

## Notes

### Để rollback về version 1.2.0 (Netflix-Specific):
Nếu cần domain `.netflix.com` và `sameSite: no_restriction`, sửa lại `parseSingleCookie`:

```javascript
return {
  name: name,
  value: decodedValue,
  domain: '.netflix.com',
  path: '/',
  secure: true,
  httpOnly: false,
  sameSite: 'no_restriction'  // Quan trọng cho Netflix
};
```

