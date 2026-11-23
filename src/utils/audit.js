// ================== AUDIT LOG ==================
// ບັນທຶກວ່າໃຜເຮັດຫຍັງ ເວລາໃດ — ເກັບຢູ່ server (ຊື່ຜູ້ໃຊ້ຖືກກຳນົດໂດຍ server ຈາກ session, ປອມບໍ່ໄດ້)
import { pushAudit, getCollection, subscribe } from './syncEngine';

export const AUDIT_EVENT = 'audit_log_updated';

/** ລາຍການ audit ລ່າສຸດ (ສະເພາະເຈົ້າຂອງ ທີ່ server ສົ່ງມາໃຫ້) */
export function getAuditLog() {
  return getCollection('auditLog') || [];
}

// ແຈ້ງ UI ເມື່ອມີ audit ໃໝ່
subscribe('auditLog', () => {
  if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new Event(AUDIT_EVENT)), 0);
});

/**
 * @param {object|null} _user  (ບໍ່ໃຊ້ແລ້ວ — server ຮູ້ເອງວ່າແມ່ນໃຜ)
 * @param {string} action     ລະຫັດການກະທຳ ເຊັ່ນ 'booking.create'
 * @param {string} details    ລາຍລະອຽດ
 * @param {object} meta       ຂໍ້ມູນເພີ່ມເຕີມ (optional)
 */
export function logAudit(_user, action, details = '', meta = {}) {
  pushAudit({ action, details: String(details || ''), meta });
}

export const AUDIT_ACTION_LABELS = {
  'auth.login': '🔓 ເຂົ້າລະບົບ',
  'auth.login_failed': '⛔ ເຂົ້າລະບົບບໍ່ສຳເລັດ',
  'auth.locked': '🔒 ບັນຊີຖືກລັອກຊົ່ວຄາວ',
  'auth.logout': '🚪 ອອກຈາກລະບົບ',
  'auth.password_change': '🔑 ປ່ຽນລະຫັດຜ່ານ',
  'user.create': '👤 ເພີ່ມຜູ້ໃຊ້',
  'user.update': '👤 ແກ້ໄຂຜູ້ໃຊ້',
  'user.delete': '👤 ລຶບຜູ້ໃຊ້',
  'booking.create': '📋 ສ້າງການຈອງ',
  'booking.online': '🌐 ລູກຄ້າຈອງອອນລາຍ',
  'booking.confirm': '✅ ຢືນຢັນການຈອງ',
  'booking.reject': '🚫 ປະຕິເສດການຈອງ',
  'booking.update': '✏️ ແກ້ໄຂການຈອງ',
  'booking.checkin': '🛎️ Check-in',
  'booking.checkout': '🚪 Check-out',
  'booking.cancel': '❌ ຍົກເລີກການຈອງ',
  'booking.noshow': '👻 ລູກຄ້າບໍ່ມາ (No-show)',
  'activity.sale': '🎟️ ຂາຍກິດຈະກຳ',
  'activity.online': '🌐 ລູກຄ້າຈອງກິດຈະກຳອອນລາຍ',
  'activity.confirm': '✅ ຢືນຢັນກິດຈະກຳ',
  'activity.cancel': '❌ ຍົກເລີກກິດຈະກຳ',
  'activity.update': '🪂 ແກ້ໄຂກິດຈະກຳ',
  'room.status': '🛏️ ປ່ຽນສະຖານະຫ້ອງ',
  'room.create': '🛏️ ເພີ່ມຫ້ອງ',
  'room.update': '🛏️ ແກ້ໄຂຫ້ອງ',
  'room.delete': '🛏️ ລຶບຫ້ອງ',
  'hotel.update': '🏨 ແກ້ໄຂຂໍ້ມູນຣີສອດ',
  'report.export': '📤 Export ລາຍງານ',
  'auth.password_reset': '🔑 ຣີເຊັດລະຫັດຜ່ານ',
  'booking.signed': '✍️ ລູກຄ້າເຊັນຢືນຢັນ',
  'booking.refund': '💸 ຄືນເງິນ',
  'expense.create': '📉 ບັນທຶກລາຍຈ່າຍ',
  'expense.update': '📉 ແກ້ໄຂລາຍຈ່າຍ',
  'expense.delete': '📉 ລຶບລາຍຈ່າຍ',
  'maintenance.report': '🛠️ ແຈ້ງສ້ອມແປງ',
  'maintenance.resolve': '🛠️ ສ້ອມແປງສຳເລັດ',
  'rateplan.update': '📅 ແກ້ໄຂລາຄາລະດູການ',
  'rateplan.delete': '📅 ລຶບລາຄາລະດູການ',
  'shift.close': '🧾 ປິດກະ',
  'system.backup': '💾 ສຳຮອງຂໍ້ມູນ',
  'system.restore': '♻️ ກູ້ຄືນຂໍ້ມູນ',
  'system.import': '📥 ນຳເຂົ້າຂໍ້ມູນເກົ່າ',
  'system.notify': '🔔 ຕັ້ງຄ່າແຈ້ງເຕືອນ',
};
