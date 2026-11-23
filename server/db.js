// ================== ຖານຂໍ້ມູນແບບໄຟລ໌ JSON (ບໍ່ຕ້ອງຕິດຕັ້ງຫຍັງເພີ່ມ) ==================
import fs from 'node:fs';
import path from 'node:path';

export const COLLECTIONS = [
  'rooms', 'bookings', 'activitySales', 'guestActivities', 'shiftCloses',
  'expenses', 'maintenanceLogs', 'ratePlans', 'auditLog',
];
export const DOCS = ['hotelInfo'];

const AUDIT_MAX = 5000;
const BACKUP_KEEP_DAYS = 30;

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function emptyDb() {
  return {
    schema: 1,
    createdAt: new Date().toISOString(),
    users: [],
    sessions: [],
    collections: Object.fromEntries(COLLECTIONS.map(c => [c, []])),
    docs: { hotelInfo: null },
    private: { telegram: { enabled: false, botToken: '', chatId: '' } },
  };
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'db.json');
    this.backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.db = this.#load();
    this.saveTimer = null;
  }

  #load() {
    if (!fs.existsSync(this.file)) return emptyDb();
    const raw = fs.readFileSync(this.file, 'utf8');
    const parsed = JSON.parse(raw); // ຖ້າໄຟລ໌ເສຍ ໃຫ້ error ດີກວ່າຂຽນທັບ
    const base = emptyDb();
    return {
      ...base,
      ...parsed,
      collections: { ...base.collections, ...(parsed.collections || {}) },
      docs: { ...base.docs, ...(parsed.docs || {}) },
      private: { ...base.private, ...(parsed.private || {}) },
    };
  }

  /** ບັນທຶກແບບ debounce + atomic (ຂຽນ tmp ແລ້ວ rename) */
  save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 250);
  }

  flush() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
    this.#dailyBackup();
  }

  #dailyBackup() {
    try {
      const target = path.join(this.backupDir, `db-${localDate()}.json`);
      if (!fs.existsSync(target)) {
        fs.copyFileSync(this.file, target);
        // ລຶບ backup ເກົ່າກວ່າ 30 ວັນ
        const files = fs.readdirSync(this.backupDir).filter(f => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
        while (files.length > BACKUP_KEEP_DAYS) {
          fs.unlinkSync(path.join(this.backupDir, files.shift()));
        }
      }
    } catch (e) {
      console.error('[backup] failed:', e.message);
    }
  }

  coll(name) { return this.db.collections[name]; }

  /** ນຳໃຊ້ ops ກັບ collection. op = {op:'upsert', item, index?} | {op:'delete', id} */
  applyOps(name, ops) {
    const list = this.db.collections[name];
    if (!list) throw new Error(`unknown collection ${name}`);
    for (const o of ops) {
      if (o.op === 'upsert' && o.item && o.item.id != null) {
        const i = list.findIndex(x => x.id === o.item.id);
        if (i >= 0) list[i] = o.item;
        else {
          const idx = Number.isInteger(o.index) ? Math.min(Math.max(0, o.index), list.length) : 0;
          list.splice(idx, 0, o.item);
        }
      } else if (o.op === 'delete' && o.id != null) {
        const i = list.findIndex(x => x.id === o.id);
        if (i >= 0) list.splice(i, 1);
      }
    }
    if (name === 'auditLog' && list.length > AUDIT_MAX) list.length = AUDIT_MAX;
    this.save();
  }

  setDoc(name, value) {
    this.db.docs[name] = value;
    this.save();
  }
}
