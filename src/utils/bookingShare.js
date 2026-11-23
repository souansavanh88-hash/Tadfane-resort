/**
 * Utility for generating and parsing shareable booking links & QR codes
 * Allows guests to view, sign, and download their booking confirmation on mobile devices
 * without needing staff authentication.
 */

import { getServerLanIps } from './api';

// Custom public or domain URL (if deployed online or using a permanent tunnel)
export const DEFAULT_PUBLIC_URL = '';

/**
 * Returns the best base URL for sharing with guests on mobile.
 * If running on localhost, uses the server's Wi-Fi IP (reported by /api/health).
 */
export function getShareBaseUrl(customHost = null) {
  if (customHost && customHost.trim()) {
    let clean = customHost.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    return clean.replace(/\/+$/, '');
  }

  if (DEFAULT_PUBLIC_URL && DEFAULT_PUBLIC_URL.trim()) {
    return DEFAULT_PUBLIC_URL.trim();
  }

  if (typeof window === 'undefined') return '';

  const { hostname, port, protocol, origin } = window.location;

  // If already on a real domain or network IP (e.g., 192.168.x.x, vercel.app, etc.)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return origin;
  }

  // On localhost → use the server machine's Wi-Fi IP so phones can open the link
  const lanIp = getServerLanIps().find(ip => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(ip)) || getServerLanIps()[0];
  if (!lanIp) return origin;
  return `${protocol}//${lanIp}${port ? `:${port}` : ''}`;
}

/**
 * Encodes booking object into a compact, URL-safe base64 string
 * Safe for Unicode characters (Lao, Thai, Vietnamese, etc.)
 */
export function encodeBookingPayload(payload) {
  try {
    if (!payload) return '';
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return encodeURIComponent(btoa(binary));
  } catch (e) {
    console.error('Failed to encode booking payload', e);
    return '';
  }
}

/**
 * Decodes base64 string back into booking object
 */
export function decodeBookingPayload(encodedStr) {
  try {
    if (!encodedStr) return null;
    const binary = atob(decodeURIComponent(encodedStr));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to decode booking payload', e);
    return null;
  }
}

/**
 * Extracts essential fields needed to render the registration & confirmation document
 */
export function buildBookingPayload(booking = {}, room = null) {
  if (!booking) return null;

  return {
    id: booking.id || '',
    guestName: booking.guestName || '',
    guestFirstName: booking.guestFirstName || booking.guestName || '',
    guestLastName: booking.guestLastName || '',
    guestTitle: booking.guestTitle || '',
    guestPhone: booking.guestPhone || '',
    guestEmail: booking.guestEmail || '',
    guestIdCard: booking.guestIdCard || '',
    guestAddress: booking.guestAddress || '',
    guestCity: booking.guestCity || '',
    guestProvince: booking.guestProvince || '',
    guestCountry: booking.guestCountry || 'ລາວ',
    guestDob: booking.guestDob || '',
    roomId: booking.roomId || room?.id || '',
    roomNumber: room?.number || booking.roomNumber || '',
    roomType: room?.type || booking.roomType || 'standard',
    roomPrice: room?.price || booking.roomPrice || 0,
    checkIn: booking.checkIn || '',
    checkOut: booking.checkOut || '',
    nights: Number(booking.nights || 1),
    adults: Number(booking.adults || 2),
    children: Number(booking.children || 0),
    totalAmount: Number(booking.totalAmount || 0),
    deposit: Number(booking.deposit || 0),
    remainingAmount: Number(booking.remainingAmount || 0),
    paymentMethod: booking.paymentMethod || 'cash',
    bookingChannel: booking.bookingChannel || 'walkin',
    status: booking.status || 'booked',
    notes: booking.notes || '',
    flight: booking.flight || '',
    prevStays: booking.prevStays || 0,
    bookedByStaff: booking.bookedByStaff || 'admin',
    signatureDataUrl: booking.signatureDataUrl || '',
    signedAt: booking.signedAt || '',
    createdAt: booking.createdAt || new Date().toISOString(),
    publicToken: booking.publicToken || '',
  };
}

/**
 * Generates the full shareable URL
 */
export function generateBookingShareUrl(booking, room, customHost = null) {
  if (!booking?.id) return '';
  const baseUrl = getShareBaseUrl(customHost);
  // ມີລະຫັດລັບ → ລູກຄ້າເປີດເບິ່ງຂໍ້ມູນຈິງຈາກ server ໄດ້ (ລິ້ງສັ້ນ, QR ອ່ານງ່າຍ, ເຊັນແລ້ວບັນທຶກເຂົ້າລະບົບ)
  if (booking.publicToken) {
    return `${baseUrl}/?booking=${encodeURIComponent(booking.id)}&t=${encodeURIComponent(booking.publicToken)}`;
  }
  // ການຈອງເກົ່າທີ່ບໍ່ມີລະຫັດລັບ → ຝັງຂໍ້ມູນໃນລິ້ງ (ບໍ່ລວມລາຍເຊັນເພື່ອບໍ່ໃຫ້ລິ້ງຍາວເກີນ)
  const payload = { ...buildBookingPayload(booking, room), signatureDataUrl: '' };
  const encoded = encodeBookingPayload(payload);
  return `${baseUrl}/?booking=${encodeURIComponent(booking.id)}&d=${encoded}`;
}

/**
 * Generates a pre-formatted message for LINE / WhatsApp / SMS
 */
export function generateBookingShareMessage(booking, room, shareUrl, hotelInfo = {}) {
  const hotelName = hotelInfo?.name || 'ຣີສອດຕາດຟານ (Tad Fane Resort)';
  const roomNum = room?.number || booking?.roomNumber || booking?.roomId || '-';
  const checkIn = booking?.checkIn || '-';
  const checkOut = booking?.checkOut || '-';
  const total = Number(booking?.totalAmount || 0).toLocaleString();
  const deposit = Number(booking?.deposit || 0).toLocaleString();

  return `🏨 ໃບຢືນຢັນການຈອງຫ້ອງພັກ — ${hotelName}
━━━━━━━━━━━━━━━━━━━━
📌 ລະຫັດການຈອງ: ${booking?.id}
👤 ຊື່ລູກຄ້າ: ${booking?.guestName || '-'}
🚪 ຫ້ອງພັກ: ຫ້ອງ ${roomNum}
📅 ເຂົ້າພັກ: ${checkIn} ຫາ ${checkOut} (${booking?.nights || 1} ຄືນ)
💰 ຍອດລວມ: ${total} ₭ ${Number(deposit) > 0 ? `(ມັດຈຳແລ້ວ: ${deposit} ₭)` : ''}

📱 ກົດລິ້ງດ້ານລຸ່ມນີ້ ເພື່ອກວດສອບ, ເຊັນຊື່ ແລະ ດາວໂຫຼດໃບຢືນຢັນເຂົ້າໂທລະສັບ:
👉 ${shareUrl}

📍 ທີ່ຕັ້ງ: ${hotelInfo?.address || 'ບ້ານ ໜອງກົກ, ເມືອງ ປາກຊ່ອງ (Km 38)'}
📞 ໂທ: ${hotelInfo?.phone || '+85620 98663366'}
💬 LINE: ${hotelInfo?.lineContact || '@tadfane'}
ຂອບໃຈທີ່ເລືອກພັກກັບ ${hotelName}!`;
}
