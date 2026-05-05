// ============================================================
// AI 客服 (Gemini API)
// 若未填 GEMINI_API_KEY 則 fallback 到本地預設回覆
// ============================================================
import { GEMINI_API_KEY } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
const fab = $("#chatFab");
const win = $("#chatWindow");
const closeBtn = $("#chatClose");
const input = $("#chatInput");
const sendBtn = $("#chatSend");
const messages = $("#chatMessages");

// 開關 chat
fab?.addEventListener("click", () => {
  win.classList.toggle("show");
  if (win.classList.contains("show")) input.focus();
});
closeBtn?.addEventListener("click", () => win.classList.remove("show"));

// 訊息歷史（給 Gemini 上下文）
const history = [];

// === 系統指令 ===
const SYSTEM_PROMPT = `你是「山宿 Homestay」的線上客服小幫手，名字叫「小宿」。
山宿是一間位在南投山區的精品民宿，主打與山林共眠的慢活體驗。

【民宿資訊】
- 地址：南投縣山林深處（具體請洽訂房後告知）
- 房型：檜木雙人房 (NT$3,200/晚)、山嵐家庭房 (NT$5,400/晚)、獨棟小屋 (NT$8,800/晚)、森見單人房 (NT$1,800/晚)
- 入住時間：下午 3:00 後；退房時間：上午 11:00 前
- 設備：每間房都有 Wi-Fi、冷暖氣、獨立衛浴；家庭房與獨棟有客廳
- 早餐：免費供應在地有機早餐（07:30 - 09:30 於本館餐廳）
- 周邊：步行 10 分鐘可達山林步道，車程 20 分鐘有當地市集
- 取消政策：入住前 7 天可全額退費；3-7 天退 50%；3 天內不退費
- 寵物：基於其他旅客考量，目前不開放寵物入住
- 交通：建議自行開車；搭大眾運輸可至最近的火車站，民宿可預約接駁（NT$300/趟）

【客服守則】
1. 用親切、放鬆的口吻回答，像跟朋友聊天，不要太正式
2. 回答簡短（2-4 句為佳），不要長篇大論
3. 若顧客想訂房，引導他們關閉此對話視窗，到上方使用「查詢空房」功能
4. 若問題超出你的知識範圍（例如特定日期是否有空房），誠實說「這部分需要請您直接查詢空房狀態，或留下聯絡方式由民宿主人回覆您」
5. 偶爾可以加一個合適的 emoji，但不要過量
6. 用繁體中文回答`;

// === 顯示訊息 ===
function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = `chat-msg ${who}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function addTyping() {
  const div = document.createElement("div");
  div.className = "chat-msg bot typing";
  div.textContent = "小宿正在打字...";
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

// === Gemini 呼叫 ===
async function callGemini(userText) {
  history.push({ role: "user", parts: [{ text: userText }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: history,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 300,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（沒有回應）";
  history.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

// === 本地預設回覆 (沒 API key 時 fallback) ===
const FALLBACK_RULES = [
  { keys: ["早餐"], reply: "我們有提供免費的在地有機早餐 🍳，供應時間是 07:30 - 09:30，於本館餐廳享用。" },
  { keys: ["wifi", "WiFi", "網路"], reply: "每間房都有免費 Wi-Fi 唷～ 訊號狀況都不錯！" },
  { keys: ["寵物", "狗", "貓"], reply: "為了其他旅客的住宿品質，目前我們不開放寵物入住，敬請見諒 🙏" },
  { keys: ["交通", "怎麼去", "怎麼來"], reply: "建議自駕較方便，若搭大眾運輸可到最近火車站，我們可預約接駁（NT$300/趟）🚐" },
  { keys: ["取消", "退費"], reply: "入住前 7 天可全額退費；3-7 天退 50%；3 天內不退費哦。" },
  { keys: ["check", "幾點", "入住", "退房"], reply: "入住時間下午 3:00 後，退房上午 11:00 前 🕒" },
  { keys: ["景點", "周邊", "附近"], reply: "步行 10 分鐘可達山林步道，車程 20 分鐘有在地市集，主人會給您專屬的私房路線地圖 🗺️" },
  { keys: ["價格", "多少錢", "費用"], reply: "單人房 NT$1,800、雙人房 NT$3,200、家庭房 NT$5,400、獨棟 NT$8,800（每晚）。可上方查詢空房！" },
];

function fallbackReply(text) {
  for (const r of FALLBACK_RULES) {
    if (r.keys.some(k => text.includes(k))) return r.reply;
  }
  return "謝謝您的提問 🌿 這個問題我可能需要幫您轉給民宿主人，建議直接查詢空房後備註，或填寫訂房表單時留下聯絡方式喔！";
}

// === 送出 ===
async function send() {
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, "user");
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;

  const typing = addTyping();
  try {
    let reply;
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
      // 沒設定 → 用本地規則
      await new Promise(r => setTimeout(r, 600));
      reply = fallbackReply(text);
    } else {
      reply = await callGemini(text);
    }
    typing.remove();
    addMessage(reply, "bot");
  } catch (err) {
    typing.remove();
    addMessage("抱歉，AI 客服暫時無法回應 😔 請稍後再試，或直接填寫訂房表單留言。\n\n（錯誤：" + err.message + "）", "bot");
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn?.addEventListener("click", send);
input?.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
