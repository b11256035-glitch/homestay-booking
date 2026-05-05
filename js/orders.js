// ============================================================
// 訂單查詢/取消頁邏輯
// ============================================================
import { findOrderByIdOrPhone, cancelOrder, tsToDateStr } from "./data.js";

const $ = (s) => document.querySelector(s);

function showToast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove("show"), 2500);
}

const STATUS_BADGE = {
  confirmed: { cls: "badge-success", text: "已確認" },
  "checked-in": { cls: "badge-info", text: "已入住" },
  cancelled: { cls: "badge-error", text: "已取消" },
};

async function search() {
  const kw = $("#searchKeyword").value.trim();
  const area = $("#resultArea");
  if (!kw) {
    showToast("請輸入查詢關鍵字", "error");
    return;
  }
  area.innerHTML = '<div class="spinner"></div>';
  const orders = await findOrderByIdOrPhone(kw);
  if (orders.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <h3>找不到符合的訂單</h3>
        <p>請確認訂單編號或手機號碼是否正確</p>
      </div>`;
    return;
  }
  area.innerHTML = orders.map(o => renderOrder(o)).join("");
  // 綁定取消按鈕
  area.querySelectorAll("[data-cancel]").forEach(btn => {
    btn.addEventListener("click", () => openCancelModal(btn.dataset.cancel, btn.dataset.room, btn.dataset.checkin));
  });
}

function renderOrder(o) {
  const badge = STATUS_BADGE[o.status] || STATUS_BADGE.confirmed;
  const checkIn = tsToDateStr(o.checkIn);
  const checkOut = tsToDateStr(o.checkOut);
  const canCancel = o.status === "confirmed";
  return `
    <article class="order-card ${o.status === 'cancelled' ? 'cancelled' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 12px;">
        <div>
          <div class="order-id">${o.orderId}</div>
          <div class="order-room">${o.roomName}</div>
        </div>
        <span class="badge ${badge.cls}">${badge.text}</span>
      </div>
      <div class="order-grid">
        <div><small>訂房人</small><strong>${o.bookerName}</strong></div>
        <div><small>入住人數</small><strong>${o.guests} 人</strong></div>
        <div><small>入住日</small><strong>${checkIn}</strong></div>
        <div><small>退房日</small><strong>${checkOut}</strong></div>
        <div><small>晚數</small><strong>${o.nights} 晚</strong></div>
        <div><small>聯絡電話</small><strong>${o.bookerPhone}</strong></div>
      </div>
      ${o.notes ? `<div style="background: var(--c-cream); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px;"><small style="color: var(--c-ink-soft);">備註：</small>${o.notes}</div>` : ''}
      <div class="order-actions">
        <div class="order-total">總計 NT$ ${o.totalPrice.toLocaleString()}</div>
        ${canCancel
          ? `<button class="btn btn-outline btn-sm" data-cancel="${o.orderId}" data-room="${o.roomName}" data-checkin="${checkIn}">取消訂房</button>`
          : ''}
      </div>
    </article>
  `;
}

// === 取消 modal ===
let pendingCancelId = null;
function openCancelModal(orderId, roomName, checkIn) {
  pendingCancelId = orderId;
  $("#cancelOrderInfo").textContent = `${roomName}　|　入住 ${checkIn}`;
  $("#cancelModal").classList.add("show");
}
$("#btnCancelClose").addEventListener("click", () => $("#cancelModal").classList.remove("show"));
$("#btnConfirmCancel").addEventListener("click", async () => {
  if (!pendingCancelId) return;
  $("#btnConfirmCancel").disabled = true;
  try {
    await cancelOrder(pendingCancelId);
    $("#cancelModal").classList.remove("show");
    showToast("訂單已取消", "success");
    search();
  } catch (err) {
    showToast("取消失敗：" + err.message, "error");
  } finally {
    $("#btnConfirmCancel").disabled = false;
    pendingCancelId = null;
  }
});

$("#cancelModal").addEventListener("click", (e) => {
  if (e.target === $("#cancelModal")) $("#cancelModal").classList.remove("show");
});

$("#btnSearch").addEventListener("click", search);
$("#searchKeyword").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
