# 🎬 Netflix Guest Sharing - Demo Project

Hệ thống chia sẻ Netflix qua cookie với **Chrome Extension** tự động inject.

---

## 🚀 Quick Start

### 1. Cài Extension

```bash
1. Mở Chrome → chrome://extensions/
2. Bật "Developer mode"
3. Click "Load unpacked"
4. Chọn folder: NetflixSharingProject/extension
5. Extension "Netflix Guest Helper" sẽ xuất hiện
```

### 2. Chạy Web Demo

```bash
cd NetflixSharingProject
python -m http.server 8000
```

Mở trình duyệt: `http://localhost:8000`

### 3. Chuẩn bị Cookie

1. Đăng nhập Netflix
2. F12 → Application → Cookies → netflix.com
3. Copy cookie `NetflixId`
4. Paste vào `cookie.txt`:
   ```
   NetflixId=v%3D2%26mac%3D...
   ```

### 4. Test

1. Click **"🌐 Mở Netflix Tab"** → Tab Netflix mở
2. Click **"📺 Watch as Guest"** → Xem ad 2 giây
3. Click **"Bắt đầu xem"** → Cookie tự động inject!
4. Tab Netflix reload → Vào `/browse` → Thành công!

---

## 📋 Luồng hoạt động

```
USER                    WEB APP                 EXTENSION              NETFLIX
  │                         │                        │                      │
  │──① Mở Netflix Tab───────▶                        │                      │
  │                         │                        │                      │
  │                         ├──window.open()─────────┼─────────────────────▶│
  │                         │                        │                      │
  │◀────"Đã mở xong"────────┤                        │                      │
  │                         │                        │                      │
  │──② Watch as Guest───────▶                        │                      │
  │                         │                        │                      │
  │◀────Ad modal (2s)───────┤                        │                      │
  │                         │                        │                      │
  │──③ Bắt đầu xem──────────▶                        │                      │
  │                         │                        │                      │
  │                         ├──sendMessage()─────────▶                      │
  │                         │   {cookieData}         │                      │
  │                         │                        │                      │
  │                         │                        ├──clear cookies──────▶│
  │                         │                        │                      │
  │                         │                        ├──set new cookie─────▶│
  │                         │                        │                      │
  │                         │                        ├──reload tab─────────▶│
  │                         │                        │                      │
  │                         │                        │◀─────/browse─────────┤
  │                         │                        │                      │
  │◀────"Thành công!"───────┤◀─────response──────────┤                      │
  │                         │                        │                      │
  │─────────────────────────┼────────────────────────┼───Xem phim!─────────▶│
```

---

## 📂 Cấu trúc thư mục

```
NetflixSharingProject/
├── index.html              # Web UI với 2 nút (Bước 1 & 2)
├── app.js                  # Logic chính, extension communication
├── cookie.txt              # Netflix cookie (user edit)
├── README.md               # File này (quick start)
├── SETUP.md                # Hướng dẫn chi tiết đầy đủ
├── ANSWER.md               # Trả lời 2 câu hỏi kỹ thuật
└── extension/              # Chrome Extension
    ├── manifest.json       # Manifest V3 config
    ├── background.js       # Service worker (cookie injection)
    ├── content.js          # Content script (Netflix monitor)
    ├── popup.html          # Extension popup UI
    ├── popup.js            # Popup logic
    └── icon*.png           # Icons
```

---

## 🎯 Tính năng

### ✅ Đã hoàn thành

- ✅ Chrome Extension (Manifest V3)
- ✅ Luồng 2 nút rõ ràng
- ✅ Extension detection tự động
- ✅ Cookie injection hoàn toàn tự động
- ✅ Error handling đầy đủ
- ✅ Toast notifications
- ✅ Step-by-step status
- ✅ Ad countdown timer
- ✅ Tab management
- ✅ URL monitoring (/browse detection)
- ✅ Success notification trên Netflix page

### 🔧 Có thể mở rộng

- ⏳ Payment integration (Stripe/PayPal)
- ⏳ Backend API thay vì đọc file local
- ⏳ Session time limit
- ⏳ Multiple Netflix accounts pool
- ⏳ User analytics
- ⏳ Real ad video thay vì demo
- ⏳ Publish extension lên Chrome Web Store

---

## 🐛 Troubleshooting

### Extension không detect được?

```bash
1. Reload extension: chrome://extensions/ → ⟳
2. Reload web app: F5
3. Check console: F12 → Có log "Extension ready" không?
```

### Tab Netflix không mở?

```bash
1. Cho phép popup: Chrome Settings → Popups → Allow localhost
2. Hoặc click icon popup ở address bar
```

### Cookie inject nhưng không login?

```bash
1. Lấy cookie mới (cookie cũ có thể hết hạn)
2. Check format cookie.txt: NetflixId=value...
3. Test extension: Click icon → "🧪 Test Extension"
```

**Xem hướng dẫn chi tiết:** [SETUP.md](SETUP.md)

---

## 🔍 Technical Stack

### Extension
- **Manifest V3** (Chrome Extension latest)
- **Service Worker** (background.js)
- **Content Script** (Netflix page monitoring)
- **chrome.cookies API** (cookie injection)
- **chrome.tabs API** (tab management)
- **chrome.runtime API** (message passing)

### Web App
- **Vanilla JavaScript** (no framework)
- **Fetch API** (cookie reading)
- **Window.open()** (tab opening)
- **chrome.runtime.sendMessage()** (extension communication)
- **Custom Events** (extension detection)

---

## ⚖️ Legal Notice

**⚠️ Dự án này CHỈ phục vụ mục đích giáo dục:**

Học tập:
- Chrome Extension development (Manifest V3)
- Cookie-based authentication
- Message passing between web app & extension
- Tab management & URL monitoring

**Chia sẻ tài khoản Netflix có thể vi phạm Terms of Service.**

**Sử dụng có trách nhiệm và tuân thủ luật pháp!**

---

## 📚 Documentation

- **README.md** (file này) - Quick start
- **SETUP.md** - Hướng dẫn đầy đủ, troubleshooting, technical details
- **ANSWER.md** - Trả lời 2 câu hỏi về front-end cookie & extension requirements

---

## 🎓 Learn More

### Chrome Extension Development
- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [chrome.cookies API](https://developer.chrome.com/docs/extensions/reference/cookies/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

### Cookie-based Authentication
- [HTTP Cookies - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [SameSite Cookies](https://web.dev/samesite-cookies-explained/)

---

## 🤝 Contributing

Pull requests welcome! Vui lòng đảm bảo:
- Code có comments chi tiết
- Tuân thủ coding style hiện tại
- Test kỹ trước khi submit

---

## 📝 License

MIT License - Educational purposes only

---

**Made with ❤️ by Claude & Human**

**Happy Coding! 🚀**
#   L a s t   u p d a t e d :   1 0 / 1 2 / 2 0 2 5   0 6 : 3 3 : 1 5  
 