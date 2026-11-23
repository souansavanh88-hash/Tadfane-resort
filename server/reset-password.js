// ================== ຣີເຊັດລະຫັດຜ່ານ (ໃຊ້ເມື່ອເຈົ້າຂອງລືມລະຫັດ) ==================
// ຕ້ອງແລ່ນຢູ່ເຄື່ອງ server ເທົ່ານັ້ນ (ຕ້ອງເຂົ້າເຖິງເຄື່ອງໂດຍກົງ = ປອດໄພ)
//
//   1) ປິດ server ກ່ອນ (Ctrl + C)
//   2) npm run reset-password -- <username>
//   3) ເປີດ server ຄືນ: npm start
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { validatePasswordStrength } from '../src/utils/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 8080);

async function main() {
  if (!fs.existsSync(FILE)) {
    console.error('❌ ບໍ່ພົບໄຟລ໌ຂໍ້ມູນ:', FILE);
    process.exit(1);
  }
  // ກວດວ່າ server ຍັງເປີດຢູ່ບໍ່ (ຖ້າເປີດຢູ່ ມັນຈະຂຽນທັບການປ່ຽນແປງ)
  try {
    await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
    console.error('❌ server ຍັງເປີດຢູ່. ກະລຸນາປິດ server ກ່ອນ (Ctrl + C) ແລ້ວແລ່ນຄຳສັ່ງນີ້ອີກຄັ້ງ.');
    process.exit(1);
  } catch { /* server ປິດແລ້ວ — ດີ */ }

  const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const username = (process.argv[2] || '').trim();
  if (!username) {
    console.log('ວິທີໃຊ້: npm run reset-password -- <username>\n');
    console.log('ບັນຊີທີ່ມີໃນລະບົບ:');
    (db.users || []).forEach(u => console.log(`  - ${u.username} (${u.role}${u.active === false ? ', ປິດໃຊ້ງານ' : ''})`));
    process.exit(0);
  }
  const user = (db.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    console.error(`❌ ບໍ່ພົບຊື່ຜູ້ໃຊ້ "${username}"`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pw = await rl.question(`ລະຫັດຜ່ານໃໝ່ສຳລັບ "${user.username}": `);
  const confirm = await rl.question('ຢືນຢັນລະຫັດຜ່ານໃໝ່: ');
  rl.close();
  if (pw !== confirm) { console.error('❌ ຢືນຢັນລະຫັດຜ່ານບໍ່ກົງກັນ'); process.exit(1); }
  const err = validatePasswordStrength(pw, user.username);
  if (err) { console.error('❌', err); process.exit(1); }

  const salt = crypto.randomBytes(16).toString('hex');
  user.passwordSalt = salt;
  user.passwordHash = crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), 120000, 32, 'sha256').toString('hex');
  user.active = true;
  user.mustChangePassword = false;
  db.sessions = (db.sessions || []).filter(s => s.userId !== user.id);
  db.collections = db.collections || {};
  db.collections.auditLog = [{
    id: `LG-${Date.now()}`, at: new Date().toISOString(), userId: null, username: 'system', userName: 'ລະບົບ',
    role: null, action: 'auth.password_reset', details: `ຣີເຊັດລະຫັດຜ່ານ "${user.username}" ຜ່ານຄຳສັ່ງໃນເຄື່ອງ server`, meta: {},
  }, ...(db.collections.auditLog || [])];

  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db));
  fs.renameSync(`${FILE}.tmp`, FILE);
  console.log(`✅ ຣີເຊັດລະຫັດຜ່ານຂອງ "${user.username}" ສຳເລັດ. ເປີດ server ຄືນດ້ວຍ: npm start`);
}

main();
