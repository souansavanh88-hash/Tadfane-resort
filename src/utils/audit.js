// ================== AUDIT LOG ==================
// ບັນທຶກວ່າໃຜເຮັດຫຍັງ ເວລາໃດ (ເກັບໄວ້ໃນ localStorage, ສູງສຸດ 3000 ລາຍການ)

const KEY = 'audit_log';
const MAX = 3000;

export const AUDIT_EVENT = 'audit_log_updated';

export function getAuditLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * @param {object|null} user  ຜູ້ໃຊ້ທີ່ເຮັດລາຍການ (ຫຼື null = ລູກຄ້າ/ລະບົບ)
 * @param {string} action     ລະຫັດການກະທຳ ເຊັ່ນ 'booking.create'
 * @param {string} details    ລາຍລະອຽດ
 * @param {object} meta       ຂໍ້ມູນເພີ່ມເຕີມ (optional)
 */
export function logAudit(user, action, details = '', meta = {}) {
  const entry = {
    id: `LG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    at: new Date().toISOString(),
    userId: user?.id || null,
    username: user?.username || (user === null ? 'guest' : 'system'),
    userName: user?.name || (user === null ? 'ລູກຄ້າ (ອອນລາຍ)' : 'ລະບົບ'),
    role: user?.role || null,
    action,
    details,
    meta,
  };
  const log = [entry, ...getAuditLog()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // storage full — drop oldest half
    localStorage.setItem(KEY, JSON.stringify(log.slice(0, Math.floor(MAX / 2))));
  }
  window.dispatchEvent(new Event(AUDIT_EVENT));
  return entry;
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
};
