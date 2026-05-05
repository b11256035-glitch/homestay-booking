// ============================================================
// 後台管理邏輯
// ============================================================
import {
  IS_DEMO_MODE, getAuthInstance, getAuthLib
} from "./firebase-config.js";
import {
  listAllRooms, listOrders, createRoom, updateRoom, deleteRoom,
  updateOrderStatus, tsToDateStr, toMs
} from "./data.js";

// ===== Auth Guard =====
function gotoLogin() { location.href = "admin-login.html"; }
if (IS_DEMO_MODE) {
  if (sessionStorage.getItem("ss_admin") !== "1") gotoLogin();
} else {
  // 等 Firebase 載入後再驗證
  (async () => {
    const auth = await getAuthInstance();
    const authLib = await getAuthLib();
    authLib.onAuthStateChanged(auth, (user) => {
      if (!user) gotoLogin();
    });
  })();
}

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ===== Tab 切換 =====
$$(".tab-link").forEach(link => {
  link.addEventListener("click", () => {
    const tab = link.dataset.tab;
    $$(".tab-link").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    $$(".tab-page").forEach(p => p.classList.remove("active"));
    $(`#tab-${tab}`).classList.add("active");
    if (tab === "dashboard") loadDashboard();
    if (tab === "orders") loadOrders();
    if (tab === "rooms") loadRooms();
    if (tab === "calendar") loadCalendar();
  });
});

// ===== 登出 =====
$("#btnLogout").addEventListener("click", async () => {
  if (IS_DEMO_MODE) {
    sessionStorage.removeItem("ss_admin");
  } else {
    const auth = await getAuthInstance();
    const authLib = await getAuthLib();
    await authLib.signOut(auth);
  }
  location.href = "index.html";
});

// ============================================================
// 總覽
// ============================================================
async function loadDashboard() {
  const orders = await listOrders();
  const rooms = await listAllRooms();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const monthOrders = orders.filter(o => {
    const t = toMs(o.createdAt);
    return t >= monthStart && t < monthEnd;
  });
  const activeOrders = orders.filter(o => o.status !== "cancelled");
  const monthRevenue = monthOrders
    .filter(o => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  // 入住率（本月）：(本月被訂的「房間夜」 / (本月總天數 * 房型數))
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalRoomNights = daysInMonth * rooms.length;
  let bookedRoomNights = 0;
  activeOrders.forEach(o => {
    const inMs = Math.max(toMs(o.checkIn), monthStart);
    const outMs = Math.min(toMs(o.checkOut), monthEnd);
    if (outMs > inMs) bookedRoomNights += Math.round((outMs - inMs) / 86400000);
  });
  const occupancyRate = totalRoomNights > 0
    ? Math.round((bookedRoomNights / totalRoomNights) * 100)
    : 0;

  $("#statsGrid").innerHTML = `
    <div class="stat-card"><div class="label">本月訂單</div><div class="value">${monthOrders.length}</div></div>
    <div class="stat-card accent"><div class="label">本月營收</div><div class="value">$${monthRevenue.toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">本月入住率</div><div class="value">${occupancyRate}%</div></div>
    <div class="stat-card"><div class="label">房型數</div><div class="value">${rooms.length}</div></div>
  `;

  // 最近 5 筆
  const recent = orders.slice(0, 5);
  $("#recentOrders").innerHTML = recent.length === 0
    ? `<div class="empty-state"><h3>還沒有訂單</h3></div>`
    : `<table class="data-table">
        <thead><tr><th>訂單編號</th><th>房型</th><th>訂房人</th><th>入住</th><th>金額</th><th>狀態</th></tr></thead>
        <tbody>${recent.map(o => orderRowHtml(o, false)).join("")}</tbody>
       </table>`;
}

// ============================================================
// 訂單管理
// ============================================================
const STATUS_BADGE = {
  confirmed: { cls: "badge-success", text: "已確認" },
  "checked-in": { cls: "badge-info", text: "已入住" },
  cancelled: { cls: "badge-error", text: "已取消" },
};

function orderRowHtml(o, withActions = true) {
  const badge = STATUS_BADGE[o.status] || STATUS_BADGE.confirmed;
  return `
    <tr>
      <td><a href="#" data-detail="${o.orderId}" style="color: var(--c-clay-dark); font-family: var(--font-display); letter-spacing: 1px;">${o.orderId}</a></td>
      <td>${o.roomName}</td>
      <td>${o.bookerName}<br><small style="color: var(--c-ink-soft);">${o.bookerPhone}</small></td>
      <td>${tsToDateStr(o.checkIn)}<br><small style="color: var(--c-ink-soft);">${o.nights} 晚</small></td>
      <td><strong>$${o.totalPrice?.toLocaleString() || 0}</strong></td>
      <td><span class="badge ${badge.cls}">${badge.text}</span></td>
      ${withActions ? `<td>
        ${o.status === 'confirmed' ? `<button class="btn btn-outline btn-sm" data-checkin="${o.orderId}">入住</button>` : ''}
        ${o.status !== 'cancelled' ? `<button class="btn btn-ghost btn-sm" data-cancel-order="${o.orderId}" style="color: var(--c-error);">取消</button>` : ''}
      </td>` : ''}
    </tr>`;
}

async function loadOrders() {
  const filter = $("#orderFilter").value;
  let orders = await listOrders();
  if (filter) orders = orders.filter(o => o.status === filter);

  const wrap = $("#ordersTableWrap");
  if (orders.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>沒有訂單</h3></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>訂單編號</th><th>房型</th><th>訂房人</th><th>入住</th><th>金額</th><th>狀態</th><th>操作</th></tr></thead>
      <tbody>${orders.map(o => orderRowHtml(o, true)).join("")}</tbody>
    </table>`;

  wrap.querySelectorAll("[data-detail]").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      showOrderDetail(orders.find(o => o.orderId === a.dataset.detail));
    });
  });
  wrap.querySelectorAll("[data-checkin]").forEach(b => {
    b.addEventListener("click", async () => {
      await updateOrderStatus(b.dataset.checkin, "checked-in");
      toast("已標記為入住", "success");
      loadOrders();
    });
  });
  wrap.querySelectorAll("[data-cancel-order]").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("確定要取消此訂單嗎？")) return;
      await updateOrderStatus(b.dataset.cancelOrder, "cancelled");
      toast("訂單已取消", "success");
      loadOrders();
    });
  });
}
$("#orderFilter").addEventListener("change", loadOrders);

function showOrderDetail(o) {
  if (!o) return;
  const badge = STATUS_BADGE[o.status] || STATUS_BADGE.confirmed;
  $("#orderDetailContent").innerHTML = `
    <div style="background: var(--c-bg-warm); padding: 20px; border-radius: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <strong style="font-family: var(--font-display); font-size: 22px; color: var(--c-clay); letter-spacing: 2px;">${o.orderId}</strong>
        <span class="badge ${badge.cls}">${badge.text}</span>
      </div>
      <div style="font-family: var(--font-display); font-size: 18px; color: var(--c-forest);">${o.roomName}</div>
    </div>
    <table style="width: 100%; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft); width: 100px;">訂房人</td><td>${o.bookerName}</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">電話</td><td>${o.bookerPhone}</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">Email</td><td>${o.bookerEmail}</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">入住人數</td><td>${o.guests} 人</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">入住日期</td><td>${tsToDateStr(o.checkIn)}</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">退房日期</td><td>${tsToDateStr(o.checkOut)}</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">晚數</td><td>${o.nights} 晚</td></tr>
      <tr><td style="padding: 6px 0; color: var(--c-ink-soft);">總金額</td><td style="font-family: var(--font-display); font-size: 18px; color: var(--c-forest);">NT$ ${o.totalPrice?.toLocaleString()}</td></tr>
      ${o.notes ? `<tr><td style="padding: 6px 0; color: var(--c-ink-soft);">備註</td><td>${o.notes}</td></tr>` : ''}
    </table>`;
  $("#orderDetailModal").classList.add("show");
}
$("#btnOrderDetailClose").addEventListener("click", () => $("#orderDetailModal").classList.remove("show"));
$("#orderDetailModal").addEventListener("click", (e) => {
  if (e.target === $("#orderDetailModal")) $("#orderDetailModal").classList.remove("show");
});

// ============================================================
// 房型管理
// ============================================================
async function loadRooms() {
  const rooms = await listAllRooms();
  const grid = $("#roomsAdminGrid");
  if (rooms.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>還沒有房型</h3><p>點右上角「新增房型」開始</p></div>`;
    return;
  }
  grid.innerHTML = rooms.map(r => `
    <div class="room-admin-card ${r.active === false ? 'disabled' : ''}">
      <img src="${r.image}" alt="" onerror="this.style.background='var(--c-cream)'">
      <div class="body">
        <h4>${r.name}</h4>
        <div class="meta">${r.type} · ${r.capacity}人 · NT$${r.price?.toLocaleString()}/晚 ${r.active === false ? '· 已停用' : ''}</div>
        <div class="actions">
          <button class="btn btn-outline btn-sm" data-edit="${r.id}">編輯</button>
          <button class="btn btn-ghost btn-sm" data-delete="${r.id}" style="color: var(--c-error);">刪除</button>
        </div>
      </div>
    </div>`).join("");

  grid.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => openRoomModal(rooms.find(r => r.id === b.dataset.edit)));
  });
  grid.querySelectorAll("[data-delete]").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("確定要刪除此房型嗎？")) return;
      await deleteRoom(b.dataset.delete);
      toast("房型已刪除", "success");
      loadRooms();
    });
  });
}

let editingRoomId = null;
function openRoomModal(room = null) {
  editingRoomId = room?.id || null;
  $("#roomModalTitle").textContent = room ? "編輯房型" : "新增房型";
  $("#rmName").value = room?.name || "";
  $("#rmType").value = room?.type || "雙人";
  $("#rmCapacity").value = room?.capacity || 2;
  $("#rmPrice").value = room?.price || 3000;
  $("#rmImage").value = room?.image || "";
  $("#rmFeatures").value = (room?.features || []).join(", ");
  $("#rmDesc").value = room?.description || "";
  $("#rmActive").checked = room?.active !== false;
  $("#roomModal").classList.add("show");
}

$("#btnAddRoom").addEventListener("click", () => openRoomModal());
$("#btnRmCancel").addEventListener("click", () => $("#roomModal").classList.remove("show"));
$("#roomModal").addEventListener("click", (e) => {
  if (e.target === $("#roomModal")) $("#roomModal").classList.remove("show");
});

$("#btnRmSave").addEventListener("click", async () => {
  const data = {
    name: $("#rmName").value.trim(),
    type: $("#rmType").value,
    capacity: Number($("#rmCapacity").value),
    price: Number($("#rmPrice").value),
    image: $("#rmImage").value.trim(),
    features: $("#rmFeatures").value.split(",").map(s => s.trim()).filter(Boolean),
    description: $("#rmDesc").value.trim(),
    active: $("#rmActive").checked,
  };
  if (!data.name) return toast("請填寫房型名稱", "error");

  try {
    if (editingRoomId) {
      await updateRoom(editingRoomId, data);
      toast("房型已更新", "success");
    } else {
      await createRoom(data);
      toast("房型已新增", "success");
    }
    $("#roomModal").classList.remove("show");
    loadRooms();
  } catch (err) {
    toast("儲存失敗：" + err.message, "error");
  }
});

// ============================================================
// 訂房日曆
// ============================================================
let calMonth = new Date();
calMonth.setDate(1);

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function loadCalendar() {
  const rooms = await listAllRooms();
  const orders = (await listOrders()).filter(o => o.status !== "cancelled");

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  $("#monthLabel").textContent = `${year} 年 ${month + 1} 月`;

  const today = ymd(new Date());

  // 表頭：日期 1 ~ N
  let thead = `<tr><th class="room-col">房型</th>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
    const dateStr = ymd(date);
    const isToday = dateStr === today;
    thead += `<th class="${date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : ''}" ${isToday ? 'style="color: var(--c-clay);"' : ''}>
      ${d}<br><small style="font-weight:400;">${dow}</small>
    </th>`;
  }
  thead += `</tr>`;

  // tbody：每個房型一列
  let tbody = "";
  rooms.forEach(room => {
    tbody += `<tr><td class="room-name">${room.name}</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateMs = date.getTime();
      const nextMs = dateMs + 86400000;
      const dateStr = ymd(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = dateStr === today;

      // 找出當天此房間是否被訂走
      const booking = orders.find(o =>
        o.roomId === room.id &&
        toMs(o.checkIn) < nextMs &&
        toMs(o.checkOut) > dateMs
      );

      const cls = ['day'];
      if (isWeekend) cls.push('weekend');
      if (isToday) cls.push('today');

      tbody += `<td class="${cls.join(' ')}">`;
      if (booking) {
        tbody += `<div class="booked" title="${booking.bookerName} · ${booking.orderId}">${booking.bookerName.slice(0, 2)}</div>`;
      }
      tbody += `</td>`;
    }
    tbody += `</tr>`;
  });

  $("#calendarArea").innerHTML = `<table class="calendar-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

$("#btnPrevMonth").addEventListener("click", () => {
  calMonth.setMonth(calMonth.getMonth() - 1);
  loadCalendar();
});
$("#btnNextMonth").addEventListener("click", () => {
  calMonth.setMonth(calMonth.getMonth() + 1);
  loadCalendar();
});
$("#btnToday").addEventListener("click", () => {
  calMonth = new Date(); calMonth.setDate(1);
  loadCalendar();
});

// ===== 啟動 =====
loadDashboard();
