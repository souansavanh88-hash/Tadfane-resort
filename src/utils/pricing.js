// ================== ລາຄາຫ້ອງຕາມລະດູການ / ທ້າຍອາທິດ ==================
// ໃຊ້ຮ່ວມກັນທັງ browser ແລະ server (ຫ້າມ import ຫຍັງທີ່ເປັນ browser-only)
//
// ratePlan = {
//   id, name, active: true,
//   startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD'   (ລວມທັງສອງວັນ, ວ່າງ = ທຸກວັນ)
//   daysOfWeek?: [0..6]   (ວັນຂອງ "ຄືນ" ທີ່ພັກ: 0=ອາທິດ ... 5=ສຸກ, 6=ເສົາ; ວ່າງ = ທຸກວັນ)
//   roomTypes?: ['standard', ...]   (ວ່າງ = ທຸກປະເພດ)
//   adjustType: 'percent' | 'amount' | 'fixed',
//   value: number,       (percent: +20 = ເພີ່ມ 20%, -10 = ຫຼຸດ 10%; amount: ບວກ/ລົບເປັນກີບ; fixed: ລາຄາຄົງທີ່)
//   priority?: number    (ຫຼາຍກວ່າ = ໃຊ້ກ່ອນ ເມື່ອມີຫຼາຍແຜນຊ້ອນກັນ)
// }

const pad = (n) => String(n).padStart(2, '0');

export function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function planApplies(plan, room, dateStr) {
  if (!plan || plan.active === false) return false;
  if (plan.startDate && dateStr < plan.startDate) return false;
  if (plan.endDate && dateStr > plan.endDate) return false;
  if (Array.isArray(plan.daysOfWeek) && plan.daysOfWeek.length > 0 && !plan.daysOfWeek.includes(weekdayOf(dateStr))) return false;
  if (Array.isArray(plan.roomTypes) && plan.roomTypes.length > 0 && !plan.roomTypes.includes(room?.type)) return false;
  return true;
}

function applyPlan(base, plan) {
  const v = Number(plan.value) || 0;
  let price = base;
  if (plan.adjustType === 'percent') price = base * (1 + v / 100);
  else if (plan.adjustType === 'amount') price = base + v;
  else if (plan.adjustType === 'fixed') price = v;
  // ປັດເປັນຫຼັກພັນກີບ
  return Math.max(0, Math.round(price / 1000) * 1000);
}

/** ລາຄາຂອງຫ້ອງໃນຄືນ dateStr */
export function nightlyRate(room, dateStr, ratePlans = []) {
  const base = Number(room?.price) || 0;
  const plans = (ratePlans || []).filter(p => planApplies(p, room, dateStr));
  if (plans.length === 0) return { date: dateStr, base, price: base, plan: null };
  plans.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  const plan = plans[0];
  return { date: dateStr, base, price: applyPlan(base, plan), plan: { id: plan.id, name: plan.name } };
}

/**
 * ຄິດລາຄາທັງໝົດຂອງການພັກ [checkIn, checkOut)
 * @returns {{ nights:number, nightly:Array, total:number, baseTotal:number, hasAdjustment:boolean }}
 */
export function computeStayPrice(room, checkIn, checkOut, ratePlans = []) {
  const nightly = [];
  if (!room || !checkIn || !checkOut || checkIn >= checkOut) {
    return { nights: 0, nightly, total: 0, baseTotal: 0, hasAdjustment: false };
  }
  let cur = checkIn;
  let guard = 0;
  while (cur < checkOut && guard < 366) {
    nightly.push(nightlyRate(room, cur, ratePlans));
    cur = addDaysStr(cur, 1);
    guard++;
  }
  const total = nightly.reduce((s, n) => s + n.price, 0);
  const baseTotal = nightly.reduce((s, n) => s + n.base, 0);
  return { nights: nightly.length, nightly, total, baseTotal, hasAdjustment: total !== baseTotal };
}
