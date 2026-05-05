// ============================================================
// 管理者登入
// ============================================================
import { IS_DEMO_MODE, getAuthInstance, getAuthLib } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);

function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove("show"), 2500);
}

$("#btnLogin").addEventListener("click", async () => {
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;
  if (!email || !password) return toast("請輸入帳號密碼", "error");

  const btn = $("#btnLogin");
  btn.disabled = true; btn.textContent = "登入中...";
  try {
    if (IS_DEMO_MODE) {
      // Demo 帳號
      if (email === "admin@demo.com" && password === "demo1234") {
        sessionStorage.setItem("ss_admin", "1");
        location.href = "admin.html";
      } else {
        throw new Error("帳號或密碼錯誤");
      }
    } else {
      const auth = await getAuthInstance();
      const authLib = await getAuthLib();
      await authLib.signInWithEmailAndPassword(auth, email, password);
      location.href = "admin.html";
    }
  } catch (err) {
    toast("登入失敗：" + (err.code === "auth/invalid-credential" ? "帳號或密碼錯誤" : err.message), "error");
  } finally {
    btn.disabled = false; btn.textContent = "登 入";
  }
});

$("#loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#btnLogin").click();
});
