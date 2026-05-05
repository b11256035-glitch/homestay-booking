// ============================================================
// 首頁邏輯：房型瀏覽 + 查空房 + 訂房
// ============================================================
import {
  listRooms, listRoomsWithAvailability, createOrder, calcNights, IS_DEMO_MODE
} from "./data.js";

// === 工具 ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove("show"), 2500);
}

function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// 預設日期：今天 / 明天
$("#checkInDate").value = todayStr(0);
$("#checkInDate").min = todayStr(0);
$("#checkOutDate").value = todayStr(1);
$("#checkOutDate").min = todayStr(1);

// 入住日改變時同步限制退房日下限
$("#checkInDate").addEventListener("change", () => {
  const inDate = $("#checkInDate").value;
  $("#checkOutDate").min = inDate;
  if ($("#checkOutDate").value <= inDate) {
    const next = new Date(inDate); next.setDate(next.getDate() + 1);
    $("#checkOutDate").value = next.toISOString().slice(0, 10);
  }
});

// === 載入房型 ===
let allRooms = [];
let currentSearchDates = null; // {checkIn, checkOut}

async function renderRooms(searchDates = null) {
  const grid = $("#roomsGrid");
  grid.innerHTML = '<div class="spinner"></div>';
  try {
    const rooms = searchDates
      ? await listRoomsWithAvailability(searchDates.checkIn, searchDates.checkOut)
      : (await listRooms()).map(r => ({ ...r, available: true }));

    // 套用篩選
    const filterType = $("#roomFilter").value;
    const minCap = Number($("#guestCount").value) || 1;
    const filtered = rooms.filter(r =>
      (!filterType || r.type === filterType) &&
      (r.capacity >= minCap)
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <h3>沒有符合條件的房型</h3>
          <p>試試調整人數或日期條件</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(r => `
      <article class="room-card">
        <img class="room-img" src="${r.image}" alt="${r.name}" onerror="this.style.background='var(--c-cream)'; this.style.display='flex'; this.alt='🏡'">
        ${searchDates ? `<span class="availability-tag ${r.available ? 'tag-available' : 'tag-full'}">${r.available ? '✓ 可訂' : '✗ 已訂'}</span>` : ''}
        <div class="room-card-body">
          <h3>${r.name}</h3>
          <div class="room-meta">${r.type} · 最多 ${r.capacity} 人 · ${(r.features || []).join(' · ')}</div>
          <p class="room-desc">${r.description}</p>
          <div class="room-card-footer">
            <div class="room-price">NT$ ${r.price.toLocaleString()}<small> / 晚</small></div>
            ${searchDates && !r.available
              ? `<button class="btn btn-ghost btn-sm" disabled>已被訂走</button>`
              : `<button class="btn btn-accent btn-sm" data-room-id="${r.id}" data-action="book">立即預訂 →</button>`}
          </div>
        </div>
      </article>
    `).join("");

    // 綁定訂房按鈕
    $$('[data-action="book"]').forEach(btn => {
      btn.addEventListener("click", () => openBookingModal(btn.dataset.roomId, filtered.find(r => r.id === btn.dataset.roomId)));
    });

    allRooms = filtered;
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>載入失敗</h3><p>${err.message}</p></div>`;
  }
}

// === 房型篩選下拉初始化 ===
async function initFilterDropdown() {
  const rooms = await listRooms();
  const types = [...new Set(rooms.map(r => r.type))];
  const sel = $("#roomFilter");
  types.forEach(t => sel.insertAdjacentHTML("beforeend", `<option value="${t}">${t}</option>`));
}

// === 查空房 ===
$("#btnSearch").addEventListener("click", () => {
  const checkIn = $("#checkInDate").value;
  const checkOut = $("#checkOutDate").value;
  if (!checkIn || !checkOut) return showToast("請選擇日期", "error");
  if (checkOut <= checkIn) return showToast("退房日必須晚於入住日", "error");
  currentSearchDates = { checkIn, checkOut };
  renderRooms(currentSearchDates);
  // 滾到房型區
  $("#rooms").scrollIntoView({ behavior: "smooth" });
});

$("#guestCount").addEventListener("change", () => renderRooms(currentSearchDates));
$("#roomFilter").addEventListener("change", () => renderRooms(currentSearchDates));

// === 訂房 Modal ===
let currentBookingRoom = null;

function openBookingModal(roomId, roomData) {
  if (!currentSearchDates) {
    showToast("請先選擇日期並查詢空房", "error");
    return;
  }
  currentBookingRoom = roomData;
  const nights = calcNights(currentSearchDates.checkIn, currentSearchDates.checkOut);
  const total = nights * roomData.price;

  $("#modalRoomName").textContent = `預訂 ${roomData.name}`;
  $("#modalRoomMeta").textContent = `${roomData.type} · NT$ ${roomData.price.toLocaleString()} / 晚`;
  $("#sumCheckIn").textContent = currentSearchDates.checkIn;
  $("#sumCheckOut").textContent = currentSearchDates.checkOut;
  $("#sumNights").textContent = nights;
  $("#sumTotal").textContent = total.toLocaleString();
  $("#bookerGuests").value = Math.min(2, roomData.capacity);
  $("#bookerGuests").max = roomData.capacity;

  $("#bookingModal").classList.add("show");
}

$("#btnCancelBooking").addEventListener("click", () => {
  $("#bookingModal").classList.remove("show");
});

$("#btnConfirmBooking").addEventListener("click", async () => {
  const name = $("#bookerName").value.trim();
  const phone = $("#bookerPhone").value.trim();
  const email = $("#bookerEmail").value.trim();
  const guests = Number($("#bookerGuests").value);
  const notes = $("#bookerNotes").value.trim();

  if (!name) return showToast("請填寫姓名", "error");
  if (!phone || !/^09\d{2}-?\d{3}-?\d{3}$|^09\d{8}$/.test(phone.replace(/-/g, ""))) {
    return showToast("請填寫正確的手機號碼", "error");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showToast("請填寫正確的 Email", "error");
  }
  if (guests > currentBookingRoom.capacity) {
    return showToast(`此房型最多 ${currentBookingRoom.capacity} 人`, "error");
  }

  const nights = calcNights(currentSearchDates.checkIn, currentSearchDates.checkOut);
  const totalPrice = nights * currentBookingRoom.price;

  const btn = $("#btnConfirmBooking");
  btn.disabled = true; btn.textContent = "處理中...";
  try {
    const orderId = await createOrder({
      roomId: currentBookingRoom.id,
      roomName: currentBookingRoom.name,
      bookerName: name,
      bookerPhone: phone,
      bookerEmail: email,
      guests,
      checkInStr: currentSearchDates.checkIn,
      checkOutStr: currentSearchDates.checkOut,
      nights,
      totalPrice,
      notes,
    });
    $("#bookingModal").classList.remove("show");
    $("#successOrderId").textContent = orderId;
    $("#successModal").classList.add("show");
    // 清空表單
    $("#bookerName").value = "";
    $("#bookerPhone").value = "";
    $("#bookerEmail").value = "";
    $("#bookerNotes").value = "";
    // 重新載入房型可訂狀態
    renderRooms(currentSearchDates);
  } catch (err) {
    if (err.message === "DUPLICATE_BOOKING") {
      showToast("⚠️ 此房型於該日期已被訂走，請重新查詢", "error");
      $("#bookingModal").classList.remove("show");
      renderRooms(currentSearchDates);
    } else {
      showToast("訂房失敗：" + err.message, "error");
    }
  } finally {
    btn.disabled = false; btn.textContent = "確認訂房";
  }
});

$("#btnSuccessClose").addEventListener("click", () => {
  $("#successModal").classList.remove("show");
});

// 點 modal 外面關閉
[$("#bookingModal"), $("#successModal")].forEach(m => {
  m.addEventListener("click", (e) => {
    if (e.target === m) m.classList.remove("show");
  });
});

// === 啟動 ===
(async () => {
  await initFilterDropdown();
  await renderRooms();
  if (IS_DEMO_MODE) {
    showToast("Demo 模式：資料儲存於瀏覽器。如需雲端儲存請設定 Firebase。");
  }
})();
