// ຂໍ້ມູນເລີ່ມຕົ້ນ 24 ຫ້ອງ
export const ROOM_STATUS = {
  AVAILABLE: 'available',
  BOOKED: 'booked',
  OCCUPIED: 'occupied',
  WAITING_CHECKIN: 'waiting_checkin',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
};

export const STATUS_LABELS = {
  available: 'ຫ້ອງວ່າງ',
  booked: 'ຈອງແລ້ວ',
  occupied: 'ກຳລັງພັກ',
  waiting_checkin: 'ລໍຖ້າເຂົ້າພັກ',
  cleaning: 'ກຳລັງອະນາໄມ',
  maintenance: 'ປິດສ້ອມແປງ',
};

export const STATUS_COLORS = {
  available: '#22c55e',
  booked: '#3b82f6',
  occupied: '#ef4444',
  waiting_checkin: '#eab308',
  cleaning: '#a855f7',
  maintenance: '#6b7280',
};

export const STATUS_EMOJI = {
  available: '🟢',
  booked: '🔵',
  occupied: '🔴',
  waiting_checkin: '🟡',
  cleaning: '🟣',
  maintenance: '⚫',
};

export const ROOM_TYPES = {
  standard: 'ຫ້ອງ Standard',
  superior: 'ຫ້ອງ Superior',
  deluxe: 'ຫ້ອງ Deluxe',
  suite: 'ຫ້ອງ Suite',
  family: 'ຫ້ອງ Family',
};

export const PAYMENT_METHODS = {
  cash: 'ເງິນສົດ',
  transfer: 'ໂອນເງິນ',
  qr: 'QR Code',
  card: 'ບັດ',
};

export const AMENITIES_LIST = [
  { key: 'wifi', label: 'Wi-Fi ຟຣີ', icon: '📶' },
  { key: 'ac', label: 'ເຄື່ອງປັບອາກາດ', icon: '❄️' },
  { key: 'hotwater', label: 'ນ້ຳອຸ່ນ', icon: '🚿' },
  { key: 'fridge', label: 'ຕູ້ເຢັນ', icon: '🧊' },
  { key: 'tv', label: 'ໂທລະທັດ', icon: '📺' },
  { key: 'balcony', label: 'ລະບຽງ', icon: '🌅' },
  { key: 'safe', label: 'ຕູ້ນິລະໄພ', icon: '🔒' },
  { key: 'hairdryer', label: 'ເຄື່ອງເປົ່າຜົມ', icon: '💨' },
  { key: 'bathtub', label: 'ອ່າງອາບນ້ຳ', icon: '🛁' },
  { key: 'breakfast', label: 'ອາຫານເຊົ້າລວມ', icon: '🍳' },
];

export const otherServicesList = [
  { key: 'parking', icon: '🚗' },
  { key: 'wifiFree', icon: '📶' },
  { key: 'security', icon: '🛡️' },
  { key: 'tour', icon: '🗺️' }
];

export const initialRooms = [
  // ຊັ້ນ 1 — ຫ້ອງ 101-106
  {
    id: '101', number: '101', floor: 1, type: 'standard', capacity: 2,
    price: 150000, size: '28 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: false, safe: false, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_101',
    images: [], currentBookingId: null,
  },
  {
    id: '102', number: '102', floor: 1, type: 'standard', capacity: 2,
    price: 150000, size: '28 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: false, safe: false, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_102',
    images: [], currentBookingId: null,
  },
  {
    id: '103', number: '103', floor: 1, type: 'standard', capacity: 2,
    price: 150000, size: '28 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: false, safe: false, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_103',
    images: [], currentBookingId: null,
  },
  {
    id: '104', number: '104', floor: 1, type: 'superior', capacity: 2,
    price: 200000, size: '32 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_104',
    images: [], currentBookingId: null,
  },
  {
    id: '105', number: '105', floor: 1, type: 'superior', capacity: 2,
    price: 200000, size: '32 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_105',
    images: [], currentBookingId: null,
  },
  {
    id: '106', number: '106', floor: 1, type: 'superior', capacity: 2,
    price: 200000, size: '32 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_106',
    images: [], currentBookingId: null,
  },
  // ຊັ້ນ 2 — ຫ້ອງ 201-206
  {
    id: '201', number: '201', floor: 2, type: 'superior', capacity: 2,
    price: 220000, size: '32 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_201',
    images: [], currentBookingId: null,
  },
  {
    id: '202', number: '202', floor: 2, type: 'superior', capacity: 2,
    price: 220000, size: '32 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_202',
    images: [], currentBookingId: null,
  },
  {
    id: '203', number: '203', floor: 2, type: 'deluxe', capacity: 2,
    price: 300000, size: '40 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: false },
    status: 'available', description: 'desc_203',
    images: [], currentBookingId: null,
  },
  {
    id: '204', number: '204', floor: 2, type: 'deluxe', capacity: 2,
    price: 300000, size: '40 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: false },
    status: 'available', description: 'desc_204',
    images: [], currentBookingId: null,
  },
  {
    id: '205', number: '205', floor: 2, type: 'deluxe', capacity: 2,
    price: 300000, size: '40 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_205',
    images: [], currentBookingId: null,
  },
  {
    id: '206', number: '206', floor: 2, type: 'deluxe', capacity: 2,
    price: 300000, size: '40 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_206',
    images: [], currentBookingId: null,
  },
  // ຊັ້ນ 3 — ຫ້ອງ 301-306
  {
    id: '301', number: '301', floor: 3, type: 'deluxe', capacity: 2,
    price: 320000, size: '42 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_301',
    images: [], currentBookingId: null,
  },
  {
    id: '302', number: '302', floor: 3, type: 'deluxe', capacity: 2,
    price: 320000, size: '42 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_302',
    images: [], currentBookingId: null,
  },
  {
    id: '303', number: '303', floor: 3, type: 'suite', capacity: 2,
    price: 500000, size: '60 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_303',
    images: [], currentBookingId: null,
  },
  {
    id: '304', number: '304', floor: 3, type: 'suite', capacity: 2,
    price: 500000, size: '60 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_304',
    images: [], currentBookingId: null,
  },
  {
    id: '305', number: '305', floor: 3, type: 'family', capacity: 4,
    price: 400000, size: '55 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: true },
    status: 'available', description: 'desc_305',
    images: [], currentBookingId: null,
  },
  {
    id: '306', number: '306', floor: 3, type: 'family', capacity: 4,
    price: 400000, size: '55 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: false, breakfast: true },
    status: 'available', description: 'desc_306',
    images: [], currentBookingId: null,
  },
  // ຊັ້ນ 4 — ຫ້ອງ 401-406
  {
    id: '401', number: '401', floor: 4, type: 'family', capacity: 4,
    price: 420000, size: '56 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_401',
    images: [], currentBookingId: null,
  },
  {
    id: '402', number: '402', floor: 4, type: 'suite', capacity: 2,
    price: 550000, size: '65 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_402',
    images: [], currentBookingId: null,
  },
  {
    id: '403', number: '403', floor: 4, type: 'suite', capacity: 2,
    price: 550000, size: '65 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_403',
    images: [], currentBookingId: null,
  },
  {
    id: '404', number: '404', floor: 4, type: 'suite', capacity: 2,
    price: 600000, size: '70 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_404',
    images: [], currentBookingId: null,
  },
  {
    id: '405', number: '405', floor: 4, type: 'deluxe', capacity: 2,
    price: 350000, size: '44 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: true, tv: true, balcony: true, safe: true, hairdryer: true, bathtub: true, breakfast: true },
    status: 'available', description: 'desc_405',
    images: [], currentBookingId: null,
  },
  {
    id: '406', number: '406', floor: 4, type: 'standard', capacity: 2,
    price: 170000, size: '30 ຕ.ມ',
    amenities: { wifi: true, ac: true, hotwater: true, fridge: false, tv: true, balcony: false, safe: false, hairdryer: false, bathtub: false, breakfast: false },
    status: 'available', description: 'desc_406',
    images: [], currentBookingId: null,
  },
];

// ບໍ່ມີບັນຊີ ແລະ ລະຫັດຜ່ານເລີ່ມຕົ້ນອີກແລ້ວ (ເພື່ອຄວາມປອດໄພ).
// ການເປີດໃຊ້ຄັ້ງທຳອິດ ລະບົບຈະໃຫ້ສ້າງບັນຊີເຈົ້າຂອງເອງ, ແລ້ວເຈົ້າຂອງເພີ່ມພະນັກງານໃນໜ້າຕັ້ງຄ່າ.
export const initialUsers = [];

export const initialHotelInfo = {
  name: 'ຣີສອດຕາດຟານ',
  nameEn: 'Tad Fane Resort',
  address: 'ບ້ານ ໜອງກົກ, ເມືອງ ປາກຊ່ອງ, ແຂວງ ຈຳປາສັກ (Km 38)',
  phone: '020 xxxx xxxx',
  email: '',
  lineContact: '@tadfane',
  whatsapp: '020 xxxx xxxx',
  facebook: 'Tad Fane Resort',
  logo: '',
  currency: 'ກີບ',
  currencySymbol: '₭',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

export const initialActivities = [
  {
    id: 'resort',
    label: 'ຣີສອດ ຫ້ອງພັກ (Resort)',
    emoji: '🏨',
    price: null,
    descKey: 'desc_resort',
    images: [],
    customDescriptionLo: `ຫຼີກໜີຄວາມວຸ້ນວາຍ ແລ້ວມາປ່ອຍໃຈໄປກັບຫ້ອງພັກທ່າມກາງຜືນປ່າທຳມະຊາດອັນອຸດົມສົມບູນ ທີ່ຕາດຟານ. ສຳຜັດກັບຄວາມງຽບສະຫງົບ ແລະ ຮັບອາກາດອັນບໍລິສຸດບໍລິເວນພູພຽງໂບລາເວນ.`,
    customDescriptionTh: `หลีกหนีความวุ่นวาย แล้วมาปล่อยใจไปกับห้องพักท่ามกลางผืนป่าธรรมชาติอันอุดมสมบูรณ์ที่ตาดฟาน สัมผัสความเงียบสงบและรับอากาศบริสุทธิ์ในบริเวณที่ราบสูงโบลาเวน`,
    customDescriptionEn: `Escape the bustle and immerse yourself in our sanctuary nestled within the lush rainforest of Tad Fane.`,
    customDescriptionVi: `Tránh xa sự ồn ào náo nhiệt để thả hồn vào không gian nghỉ dưỡng giữa đại ngàn xanh mướt tại Tad Fane.`,
  },
  { id: 'zipline', label: 'ສະລິງ (Zipline)', emoji: '🪂', price: 120000, descKey: 'desc_zipline', images: [] },
  { id: 'rafting', label: 'ລ່ອງແກງ (Rafting)', emoji: '🚣', price: 180000, descKey: 'desc_rafting', images: [] },
  { id: 'tubing', label: 'ລອຍໂຕ (Tubing)', emoji: '🍩', price: 50000, descKey: 'desc_tubing', images: [] },
  { id: 'trekking', label: 'ຍ່າງປ່າ (Trekking)', emoji: '🥾', price: 250000, descKey: 'desc_trekking', images: [] },
  { id: 'entrance', label: 'ປີ້ເຂົ້າຊົມ (Entrance)', emoji: '🎟️', price: 20000, descKey: 'desc_entrance', images: [] },
  { id: 'cafe', label: 'ຄ່າເຟ (Cafe)', emoji: '☕', price: 25000, descKey: 'desc_cafe', images: [] },
  { id: 'restaurant', label: 'ຮ້ານອາຫານ (Restaurant)', emoji: '🍲', price: 80000, descKey: 'desc_restaurant', images: [] },
  { id: 'market', label: 'ຕະຫຼາດຊຸມຊົນ (Local Market)', emoji: '🛍️', price: 15000, descKey: 'desc_market', images: [] },
];

/** ລະຫັດລັບແບບສຸ່ມ ສຳລັບລິ້ງໃຫ້ລູກຄ້າເບິ່ງການຈອງ (ໃຊ້ໄດ້ທັງ http ທຳມະດາ) */
export const generatePublicToken = () => {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint32Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr);
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 2 ** 32);
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
};

export const generateBookingId = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BK${y}${m}${d}-${r}`;
};

export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '0 ₭';
  return new Intl.NumberFormat('lo-LA').format(amount) + ' ₭';
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('lo-LA', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('lo-LA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const daysBetween = (d1, d2) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diff = Math.abs(date2 - date1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ---------- ວັນທີຕາມເວລາທ້ອງຖິ່ນ (ບໍ່ໃຊ້ UTC ເພື່ອບໍ່ໃຫ້ວັນທີເລື່ອນຕອນເຊົ້າມືດ) ----------
export const toLocalDateStr = (input = new Date()) => {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayStr = () => toLocalDateStr(new Date());

/** ບວກວັນໃສ່ 'YYYY-MM-DD' ແລ້ວຄືນເປັນ 'YYYY-MM-DD' */
export const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toLocalDateStr(dt);
};

/** ຄືນລາຍການວັນທີ [from, to] ລວມທັງສອງວັນ */
export const dateRange = (from, to) => {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 3700) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
};

// ສະຖານະການຈອງທີ່ຍັງຈັບຈອງຫ້ອງຢູ່ (ໃຊ້ກວດວັນທີຊ້ອນ)
export const BLOCKING_STATUSES = ['pending', 'booked', 'checked_in'];

export const BOOKING_STATUS_META = {
  pending: { label: 'ລໍຢືນຢັນ', color: '#eab308', emoji: '🟡' },
  booked: { label: 'ຈອງແລ້ວ', color: '#3b82f6', emoji: '🔵' },
  checked_in: { label: 'ກຳລັງພັກ', color: '#22c55e', emoji: '🟢' },
  checked_out: { label: 'ອອກແລ້ວ', color: '#6b7280', emoji: '⚫' },
  cancelled: { label: 'ຍົກເລີກ', color: '#ef4444', emoji: '🔴' },
  no_show: { label: 'ບໍ່ມາ (No-show)', color: '#a855f7', emoji: '👻' },
};
