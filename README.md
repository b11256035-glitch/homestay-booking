# 山宿 Homestay — 民宿訂房系統

> AI 跨域應用與案例 期末專案
> 一個結合 Firebase 雲端資料庫與 Gemini AI 客服的線上民宿訂房系統

---

## ✨ 功能特色

### 顧客端
- 🏡 房型瀏覽（圖文卡片、特色標籤、價格）
- 🔍 即時空房查詢（防重複訂房）
- 📝 線上訂房（含合計試算）
- 📋 訂單查詢／取消（用訂單編號或手機）
- 💬 AI 智慧客服（Gemini 驅動）

### 管理者後台
- 🔐 帳號登入驗證（Firebase Auth）
- 📊 經營總覽（本月訂單、營收、入住率）
- 📋 訂單管理（檢視、確認入住、取消）
- 🏡 房型管理（新增、編輯、刪除、啟用切換）
- 📅 訂房日曆視覺化（每房每日佔用一目了然）

---

## 📂 檔案結構

```
homestay-booking/
├── index.html              顧客首頁
├── my-orders.html          訂單查詢
├── admin-login.html        管理者登入
├── admin.html              後台
├── css/
│   └── style.css           共用樣式（大地色＋森林綠）
├── js/
│   ├── firebase-config.js  Firebase 設定（要填你的金鑰）
│   ├── data.js             資料存取層（含本地 fallback）
│   ├── main.js             首頁邏輯
│   ├── orders.js           訂單頁邏輯
│   ├── admin-login.js      登入邏輯
│   ├── admin.js            後台邏輯（含日曆）
│   └── ai-chat.js          Gemini 客服
└── README.md               這份檔案
```

---

## 🚀 快速開始（三種方式）

### 方法 A：Demo 模式（最快，零設定）
不需要任何金鑰，直接打開即可體驗。
資料儲存在瀏覽器的 localStorage（清除瀏覽器資料就會消失）。

```bash
# 直接用 VS Code Live Server 或 Python 啟動本地伺服器
python -m http.server 8000
# 開瀏覽器 http://localhost:8000
```

**Demo 管理者帳號：**
- Email：`admin@demo.com`
- 密碼：`demo1234`

---

### 方法 B：接上 Firebase（推薦給期末展示）

#### 1. 建立 Firebase 專案
1. 前往 https://console.firebase.google.com/
2. 點「**新增專案**」→ 取個名字（例如 `homestay-demo`）→ 建立
3. 進入專案 → 左側選單「**Build → Firestore Database**」→「**建立資料庫**」
   - 模式選「**以測試模式開始**」（學習用，30 天後會自動鎖定）
   - 位置選「**asia-east1**」(台灣)
4. 啟用 Authentication：左側「**Build → Authentication**」→「**Sign-in method**」
   →「**啟用「電子郵件/密碼」**」
   →切到「**Users**」分頁 →「**新增使用者**」建立你的管理者帳號

#### 2. 取得 Firebase 設定
1. 在 Firebase 專案首頁中央點「**</>**」(網頁) 圖示
2. 註冊應用程式（取個名字即可）
3. 複製顯示的 `firebaseConfig` 物件

#### 3. 填入設定
打開 `js/firebase-config.js`，把 `firebaseConfig` 換成你的：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",                    // 你的
  authDomain: "homestay-xxx.firebaseapp.com",
  projectId: "homestay-xxx",
  storageBucket: "homestay-xxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc..."
};
```

啟動本地伺服器，網站就會自動切換為 Firebase 模式。

---

### 方法 C：加上 Gemini AI 客服

1. 前往 https://aistudio.google.com/apikey
2. 申請 API key（免費額度足夠 demo）
3. 打開 `js/firebase-config.js`，填入：

```javascript
export const GEMINI_API_KEY = "AIza..."; // 你的 Gemini API Key
```

> ⚠️ 沒填 Gemini Key 時，AI 客服會自動 fallback 成本地關鍵字回覆，仍可正常使用。

---

## ☁️ 部署到 Vercel（讓老師可以連線看）

1. 把整個 `homestay-booking/` 資料夾推上 GitHub（建立一個新 repo）
2. 前往 https://vercel.com/，用 GitHub 帳號登入
3. 點「**Add New Project**」→ 選你剛剛的 repo →「**Deploy**」
4. 等待 30 秒，Vercel 會給你一個網址（例如 `homestay-xxx.vercel.app`）

> **安全提醒**：把 API key 推上公開 repo 有外洩風險。
> 期末展示用沒問題，正式上線需把 key 移到後端代理。

---

## 🗄️ Firestore 資料結構

### `rooms` collection
```
{
  name: "檜木雙人房",
  type: "雙人",
  capacity: 2,
  price: 3200,
  description: "...",
  image: "https://...",
  features: ["檜木浴池", "山景陽台"],
  active: true
}
```

### `orders` collection
```
{
  orderId: "SS202605030001",
  roomId: "...",
  roomName: "檜木雙人房",
  bookerName: "王小明",
  bookerPhone: "0912345678",
  bookerEmail: "...",
  guests: 2,
  checkIn: Timestamp,
  checkOut: Timestamp,
  nights: 2,
  totalPrice: 6400,
  notes: "",
  status: "confirmed",  // confirmed | checked-in | cancelled
  createdAt: Timestamp
}
```

---

## 🛡️ 防止重複訂房

系統在兩個關鍵點檢查日期衝突：

1. **顧客查空房時**：用入住-退房日期區間比對所有未取消訂單，不可訂的房型直接顯示「已被訂走」
2. **送出訂單前**：再做一次伺服器端檢查（`checkAvailability`），避免兩位顧客幾乎同時搶同一間造成競態

兩個區間 `[a1, a2)` 與 `[b1, b2)` 重疊條件：`a1 < b2 && b1 < a2`

---

## 🎨 設計理念

調性走「山林系」，避免一般訂房系統常見的科技藍：

| 色彩 | 用途 |
|------|------|
| 森林綠 `#2d4a3e` | 主色 — 文字、按鈕、navbar |
| 陶土橘 `#c87a4a` | 重點色 — CTA、訂房按鈕、價格 |
| 米白 `#faf6ef` | 主背景 |
| 暖米色 `#f3ebd9` | 次要背景、表格 hover |

字體：
- 標題：Noto Serif TC（典雅襯線）
- 內文：Noto Sans TC（清晰閱讀）

---

## 📝 開發備註

- 所有 JS 都用原生 ES module，無打包工具
- Firebase SDK 用 CDN 載入，無需 npm install
- 響應式（手機/平板/桌機都可用）
- 「Demo 模式」設計讓你即使沒設定 Firebase 也能完整跑起來，方便逐步開發

---

© 2026 山宿 Homestay · AI 跨域應用與案例 期末專案
