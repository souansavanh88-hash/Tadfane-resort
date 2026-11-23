// ================== ເຊື່ອມຕໍ່ API ຂອງ server ==================
const TOKEN_KEY = 'hotel_token';

export const UNAUTHORIZED_EVENT = 'api_unauthorized';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** ID ຂອງແຖບ browser ນີ້ (ໃຊ້ບອກ server ວ່າບໍ່ຕ້ອງສົ່ງການປ່ຽນແປງຂອງເຮົາກັບຄືນມາ) */
export const CLIENT_ID = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function api(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'ບໍ່ສາມາດເຊື່ອມຕໍ່ server ໄດ້ — ກວດສອບວ່າເປີດ server ແລ້ວ ແລະ ເຊື່ອມ Wi-Fi ດຽວກັນ');
  }
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok) {
    if (res.status === 401 && auth && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(res.status, data?.error || `ເກີດຂໍ້ຜິດພາດ (HTTP ${res.status})`);
  }
  return data;
}

// ---------- IP ຂອງເຄື່ອງ server ໃນ Wi-Fi (ໃຊ້ສ້າງລິ້ງ/QR ໃຫ້ລູກຄ້າ) ----------
let serverLanIps = [];
export const setServerLanIps = (ips) => { serverLanIps = Array.isArray(ips) ? ips : []; };
export const getServerLanIps = () => serverLanIps;
