// ============================================================
// Firebase 設定檔（動態載入版）
// ============================================================
// ⚠️ 重要：請依以下步驟取得你自己的 Firebase 設定後，替換下方 firebaseConfig
//
// 【步驟】
// 1. 前往 https://console.firebase.google.com/
// 2. 點「新增專案」 → 取個名字（例如 homestay-demo）→ 建立
// 3. 進入專案 → 左側選單「Build」 → 「Firestore Database」 → 「建立資料庫」
//    - 模式選「以測試模式開始」（學習用，30 天後會自動鎖定）
//    - 位置選「asia-east1」(台灣)
// 4. 在專案首頁點「</>」(網頁) 圖示 → 註冊應用程式 → 取得 firebaseConfig
// 5. 把下方的 firebaseConfig 換成你的
// 6. （選用）若要管理者登入：左側「Authentication」→「Sign-in method」
//    → 啟用「電子郵件/密碼」→ 在「Users」分頁手動新增一組管理者帳號
//
// 【Gemini API Key】
// 請至 https://aistudio.google.com/apikey 申請 → 填入下方 GEMINI_API_KEY
// ============================================================

// 👇 把這裡換成你的 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyDYe2Rw1BYw6yK-uU9-z-Gwq88mnHkrKtA",
  authDomain: "homestay-demo-83872.firebaseapp.com",
  projectId: "homestay-demo-83872",
  storageBucket: "homestay-demo-83872.firebasestorage.app",
  messagingSenderId: "818426895986",
  appId: "1:818426895986:web:4ea220f5f04957ef6aaceb"
};
// 👇 把這裡換成你的 Gemini API Key
export const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

// 是否處於 demo 模式（沒填 Firebase 設定就用本地假資料）
export const IS_DEMO_MODE = firebaseConfig.apiKey === "YOUR_API_KEY";

if (IS_DEMO_MODE) {
  console.warn("⚠️ Demo 模式（未連接 Firebase）：資料儲存於瀏覽器 localStorage。請依 firebase-config.js 註解設定 Firebase。");
}

// ============================================================
// 動態載入 Firebase（只在非 Demo 模式才載入 CDN）
// 這讓網站在 Demo 模式不會被 Firebase CDN 阻擋
// ============================================================
let _firebaseModules = null;
async function loadFirebase() {
  if (_firebaseModules) return _firebaseModules;
  const [appMod, fsMod, authMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  _firebaseModules = {
    app,
    db: fsMod.getFirestore(app),
    auth: authMod.getAuth(app),
    fs: fsMod,
    authMod,
  };
  return _firebaseModules;
}

// 對外：需要時才載入
export async function getDb() { return (await loadFirebase()).db; }
export async function getAuthInstance() { return (await loadFirebase()).auth; }
export async function getFsLib() { return (await loadFirebase()).fs; }
export async function getAuthLib() { return (await loadFirebase()).authMod; }

// ============================================================
// 工具函式
// ============================================================
export function generateOrderId() {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SS${ymd}${rand}`;
}

export function calcNights(checkInStr, checkOutStr) {
  const inD = new Date(checkInStr);
  const outD = new Date(checkOutStr);
  return Math.max(0, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
}
