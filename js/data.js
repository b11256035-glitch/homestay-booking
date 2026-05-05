// ============================================================
// 資料存取層
// 若 IS_DEMO_MODE 則用 localStorage，否則用 Firestore
// ============================================================
import {
  IS_DEMO_MODE, generateOrderId, calcNights, getDb, getFsLib
} from "./firebase-config.js";

// =========== Demo 模式預設資料 ===========
const DEMO_ROOMS = [
  {
    id: "room-1",
    name: "檜木雙人房",
    type: "雙人",
    capacity: 2,
    price: 3200,
    description: "整面落地窗對著百年檜木林。木造房舍、檜木浴池，連空氣裡都是淡淡的木香。",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    features: ["檜木浴池", "山景陽台", "雙人床"],
    active: true
  },
  {
    id: "room-2",
    name: "山嵐家庭房",
    type: "家庭",
    capacity: 4,
    price: 5400,
    description: "適合一家人。早晨會被山嵐溫柔包圍，孩子可以在前院的草地奔跑。",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
    features: ["雙大床", "獨立客廳", "兒童友善"],
    active: true
  },
  {
    id: "room-3",
    name: "獨棟小屋",
    type: "獨棟",
    capacity: 6,
    price: 8800,
    description: "整棟獨立小木屋，附私人庭院與烤肉區。最多可容納 6 人，適合三五好友包棟。",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80",
    features: ["私人庭院", "烤肉區", "包棟"],
    active: true
  },
  {
    id: "room-4",
    name: "森見單人房",
    type: "單人",
    capacity: 1,
    price: 1800,
    description: "為一個人準備的小房間。一張舒適的單人床、一張可以寫日記的書桌、一扇望向森林的窗。",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    features: ["靜謐獨立", "書桌", "森林窗景"],
    active: true
  },
];

// =========== localStorage 工具 ===========
const LS = {
  rooms: () => {
    const v = JSON.parse(localStorage.getItem("ss_rooms") || "null");
    if (v) return v;
    LS.setRooms(DEMO_ROOMS);
    return DEMO_ROOMS;
  },
  setRooms: (arr) => localStorage.setItem("ss_rooms", JSON.stringify(arr)),
  orders: () => JSON.parse(localStorage.getItem("ss_orders") || "[]"),
  setOrders: (arr) => localStorage.setItem("ss_orders", JSON.stringify(arr)),
};

// =========== 共用：日期重疊判斷 ===========
function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

// =========== Timestamp 工具 ===========
export function toMs(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "string") return new Date(t).getTime();
  if (t.toDate) return t.toDate().getTime();
  if (t.seconds) return t.seconds * 1000;
  return new Date(t).getTime();
}

export function tsToDateStr(t) {
  const ms = toMs(t);
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ============================================================
// 房型 API
// ============================================================
export async function listRooms() {
  if (IS_DEMO_MODE) return LS.rooms().filter(r => r.active !== false);
  const fs = await getFsLib();
  const db = await getDb();
  const snap = await fs.getDocs(fs.collection(db, "rooms"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.active !== false);
}

export async function listAllRooms() {
  if (IS_DEMO_MODE) return LS.rooms();
  const fs = await getFsLib();
  const db = await getDb();
  const snap = await fs.getDocs(fs.collection(db, "rooms"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createRoom(data) {
  if (IS_DEMO_MODE) {
    const rooms = LS.rooms();
    const newRoom = { id: "room-" + Date.now(), ...data, active: data.active !== false };
    rooms.push(newRoom);
    LS.setRooms(rooms);
    return newRoom;
  }
  const fs = await getFsLib();
  const db = await getDb();
  const ref = await fs.addDoc(fs.collection(db, "rooms"), data);
  return { id: ref.id, ...data };
}

export async function updateRoom(id, data) {
  if (IS_DEMO_MODE) {
    const rooms = LS.rooms();
    const idx = rooms.findIndex(r => r.id === id);
    if (idx >= 0) { rooms[idx] = { ...rooms[idx], ...data }; LS.setRooms(rooms); }
    return;
  }
  const fs = await getFsLib();
  const db = await getDb();
  await fs.updateDoc(fs.doc(db, "rooms", id), data);
}

export async function deleteRoom(id) {
  if (IS_DEMO_MODE) {
    LS.setRooms(LS.rooms().filter(r => r.id !== id));
    return;
  }
  const fs = await getFsLib();
  const db = await getDb();
  await fs.deleteDoc(fs.doc(db, "rooms", id));
}

// ============================================================
// 訂單 API
// ============================================================
export async function listOrders() {
  if (IS_DEMO_MODE) {
    return LS.orders().sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  }
  const fs = await getFsLib();
  const db = await getDb();
  const q = fs.query(fs.collection(db, "orders"), fs.orderBy("createdAt", "desc"));
  const snap = await fs.getDocs(q);
  return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

export async function findOrderByIdOrPhone(keyword) {
  const all = await listOrders();
  return all.filter(o =>
    o.orderId === keyword ||
    o.bookerPhone === keyword ||
    o.bookerPhone?.replace(/\D/g, "") === keyword.replace(/\D/g, "")
  );
}

export async function checkAvailability(roomId, checkInStr, checkOutStr, excludeOrderId = null) {
  const all = await listOrders();
  const inMs = new Date(checkInStr).getTime();
  const outMs = new Date(checkOutStr).getTime();
  const conflict = all.find(o => {
    if (o.roomId !== roomId) return false;
    if (o.status === "cancelled") return false;
    if (excludeOrderId && o.orderId === excludeOrderId) return false;
    return overlap(inMs, outMs, toMs(o.checkIn), toMs(o.checkOut));
  });
  return !conflict;
}

export async function listRoomsWithAvailability(checkInStr, checkOutStr) {
  const rooms = await listRooms();
  if (!checkInStr || !checkOutStr) return rooms.map(r => ({ ...r, available: true }));
  const orders = await listOrders();
  const inMs = new Date(checkInStr).getTime();
  const outMs = new Date(checkOutStr).getTime();
  return rooms.map(r => {
    const conflict = orders.find(o =>
      o.roomId === r.id &&
      o.status !== "cancelled" &&
      overlap(inMs, outMs, toMs(o.checkIn), toMs(o.checkOut))
    );
    return { ...r, available: !conflict };
  });
}

export async function createOrder(orderData) {
  // 1) 檢查可訂性
  const ok = await checkAvailability(orderData.roomId, orderData.checkInStr, orderData.checkOutStr);
  if (!ok) throw new Error("DUPLICATE_BOOKING");

  const orderId = generateOrderId();

  if (IS_DEMO_MODE) {
    const payload = {
      orderId,
      roomId: orderData.roomId,
      roomName: orderData.roomName,
      bookerName: orderData.bookerName,
      bookerPhone: orderData.bookerPhone,
      bookerEmail: orderData.bookerEmail,
      guests: Number(orderData.guests),
      checkIn: orderData.checkInStr,
      checkOut: orderData.checkOutStr,
      nights: orderData.nights,
      totalPrice: orderData.totalPrice,
      notes: orderData.notes || "",
      status: "confirmed",
      createdAt: Date.now(),
    };
    const orders = LS.orders();
    orders.push(payload);
    LS.setOrders(orders);
  } else {
    const fs = await getFsLib();
    const db = await getDb();
    const payload = {
      orderId,
      roomId: orderData.roomId,
      roomName: orderData.roomName,
      bookerName: orderData.bookerName,
      bookerPhone: orderData.bookerPhone,
      bookerEmail: orderData.bookerEmail,
      guests: Number(orderData.guests),
      checkIn: fs.Timestamp.fromDate(new Date(orderData.checkInStr + "T00:00:00")),
      checkOut: fs.Timestamp.fromDate(new Date(orderData.checkOutStr + "T00:00:00")),
      nights: orderData.nights,
      totalPrice: orderData.totalPrice,
      notes: orderData.notes || "",
      status: "confirmed",
      createdAt: fs.serverTimestamp(),
    };
    await fs.addDoc(fs.collection(db, "orders"), payload);
  }
  return orderId;
}

export async function cancelOrder(orderId) {
  if (IS_DEMO_MODE) {
    const orders = LS.orders();
    const idx = orders.findIndex(o => o.orderId === orderId);
    if (idx >= 0) { orders[idx].status = "cancelled"; LS.setOrders(orders); }
    return;
  }
  const fs = await getFsLib();
  const db = await getDb();
  const all = await listOrders();
  const found = all.find(o => o.orderId === orderId);
  if (found) await fs.updateDoc(fs.doc(db, "orders", found.docId), { status: "cancelled" });
}

export async function updateOrderStatus(orderId, status) {
  if (IS_DEMO_MODE) {
    const orders = LS.orders();
    const idx = orders.findIndex(o => o.orderId === orderId);
    if (idx >= 0) { orders[idx].status = status; LS.setOrders(orders); }
    return;
  }
  const fs = await getFsLib();
  const db = await getDb();
  const all = await listOrders();
  const found = all.find(o => o.orderId === orderId);
  if (found) await fs.updateDoc(fs.doc(db, "orders", found.docId), { status });
}

export { calcNights, IS_DEMO_MODE };
