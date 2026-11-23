// ================== PASSWORD HASHING ==================
// ໃຊ້ PBKDF2-SHA256 + salt ຜ່ານ Web Crypto API (ບໍ່ເກັບລະຫັດຜ່ານແບບຂໍ້ຄວາມທຳມະດາ)

const ITERATIONS = 120000;

const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));

export function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}

/** ສ້າງ {passwordHash, passwordSalt} ຈາກລະຫັດຜ່ານ */
export async function createPasswordRecord(password) {
  const passwordSalt = generateSalt();
  const passwordHash = await hashPassword(password, passwordSalt);
  return { passwordHash, passwordSalt };
}

export async function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const hash = await hashPassword(password, user.passwordSalt);
  // constant-time-ish compare
  if (hash.length !== user.passwordHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ user.passwordHash.charCodeAt(i);
  return diff === 0;
}

/** ກວດຄວາມແຂງແຮງຂອງລະຫັດຜ່ານ — ຄືນຂໍ້ຄວາມ error ຫຼື '' ຖ້າຜ່ານ */
export function validatePasswordStrength(pw, username = '') {
  if (!pw || pw.length < 8) return 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'ລະຫັດຜ່ານຕ້ອງມີທັງຕົວອັກສອນ ແລະ ຕົວເລກ';
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return 'ລະຫັດຜ່ານຫ້າມມີຊື່ຜູ້ໃຊ້ຢູ່ໃນນັ້ນ';
  if (['12345678', 'password1', 'abcd1234', '1234abcd', 'qwerty123'].includes(pw.toLowerCase())) return 'ລະຫັດຜ່ານນີ້ງ່າຍເກີນໄປ';
  return '';
}
