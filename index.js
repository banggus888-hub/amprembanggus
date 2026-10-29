// ====== LOADER .env (tanpa dependensi) ======
// Semua data rahasia (API key, Firebase, nomor DANA, dll) dibaca dari file ".env" di folder yang sama.
const __fsBoot = require('fs');
const __pathBoot = require('path');
const ENV_FILE = __pathBoot.join(__dirname, '.env');
(function loadEnvFile() {
  try {
    if (!__fsBoot.existsSync(ENV_FILE)) return;
    const lines = __fsBoot.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined || process.env[m[1]] === '') process.env[m[1]] = v;
    }
  } catch (e) { console.warn('[ENV] Gagal membaca .env:', e.message); }
})();

// Proses tidak boleh mati hanya karena satu error yang tidak tertangkap
process.on('unhandledRejection', (e) => console.error('[UNHANDLED REJECTION]', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => console.error('[UNCAUGHT EXCEPTION]', e && e.message ? e.message : e));

// Rahasia internal dibuat otomatis (sekali) dan disimpan ke .env bila belum ada
function ensureSecret(name) {
  const cur = process.env[name];
  if (cur && String(cur).length >= 32) return String(cur);
  const val = require('crypto').randomBytes(32).toString('hex');
  process.env[name] = val;
  try {
    let txt = __fsBoot.existsSync(ENV_FILE) ? __fsBoot.readFileSync(ENV_FILE, 'utf8') : '';
    const emptyLine = new RegExp('^' + name + '=[ \\t]*$', 'm');
    if (emptyLine.test(txt)) txt = txt.replace(emptyLine, name + '=' + val);   // isi baris kosong yang sudah ada
    else txt = txt + (txt && !txt.endsWith('\n') ? '\n' : '') + name + '=' + val + '\n';
    __fsBoot.writeFileSync(ENV_FILE, txt, { mode: 0o600 });
    console.log('[ENV] ' + name + ' dibuat otomatis dan disimpan ke .env');
  } catch (e) {
    console.warn('[ENV] ' + name + ' tidak bisa disimpan ke .env (login/enkripsi akan berubah setiap restart)');
  }
  return val;
}
const AUTH_SECRET = ensureSecret('AUTH_SECRET');   // kunci penanda tangan token login
const DATA_KEY_RAW = ensureSecret('DATA_KEY');     // kunci enkripsi data sensitif di database

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const tls = require('tls');
const crypto = require('crypto');
const Go = require('@xof/fetch');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get: rawGet, set: rawSet, child, remove } = require('firebase/database');

// ====== KONFIGURASI (semua rahasia dibaca dari .env / environment variable) ======
function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    const msg = '[ENV] Variabel "' + name + '" belum diisi. Isi di file .env (lokal) atau Vercel > Settings > Environment Variables, lalu jalankan/redeploy ulang.';
    console.error('\n' + msg + '\n');
    if (process.env.VERCEL) throw new Error(msg);
    process.exit(1);
  }
  return String(v).trim();
}

const config = {
  base: (process.env.KYZZNEKOO_BASE_URL || 'https://app.kyzznekoo.my.id').replace(/\/+$/, ''),
  kyzznekooApiKey: requireEnv('KYZZNEKOO_API_KEY')
};

const firebaseConfig = {
  apiKey: requireEnv('FIREBASE_API_KEY'),
  authDomain: requireEnv('FIREBASE_AUTH_DOMAIN'),
  databaseURL: requireEnv('FIREBASE_DATABASE_URL'),
  projectId: requireEnv('FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('FIREBASE_APP_ID')
};

const firebaseApp = initializeApp(firebaseConfig);

// Opsional: server login ke Firebase memakai akun khusus (FIREBASE_AUTH_EMAIL / FIREBASE_AUTH_PASSWORD)
// sehingga Rules database bisa dikunci menjadi ".read/.write": "auth != null" (publik tidak bisa akses).
let dbReady = Promise.resolve();
if (process.env.FIREBASE_AUTH_EMAIL && process.env.FIREBASE_AUTH_PASSWORD) {
  try {
    const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
    const fbAuth = getAuth(firebaseApp);
    dbReady = signInWithEmailAndPassword(fbAuth, process.env.FIREBASE_AUTH_EMAIL, process.env.FIREBASE_AUTH_PASSWORD)
      .then(() => console.log('[FIREBASE] Login akun server berhasil'))
      .catch((e) => console.error('[FIREBASE] Login akun server GAGAL:', e.message));
  } catch (e) { console.error('[FIREBASE] Modul firebase/auth tidak tersedia:', e.message); }
}
const db = getDatabase(firebaseApp);
const get = async (...args) => { await dbReady; return rawGet(...args); };
const set = async (...args) => { await dbReady; return rawSet(...args); };

// ====== KEAMANAN: TOKEN LOGIN, HASH PASSWORD, ENKRIPSI DATA, LIMITER ======
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signToken(username) {
  const payload = b64u(JSON.stringify({ u: String(username).toLowerCase(), exp: Date.now() + TOKEN_TTL_MS }));
  const sig = b64u(crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest());
  return payload + '.' + sig;
}

function verifyToken(token) {
  try {
    if (typeof token !== 'string' || token.length > 600) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const expected = b64u(crypto.createHmac('sha256', AUTH_SECRET).update(parts[0]).digest());
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!data || typeof data.u !== 'string' || !data.exp || data.exp < Date.now()) return null;
    return data.u;
  } catch (e) { return null; }
}

function scryptAsync(pw, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key));
  });
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(pw, salt);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}
async function verifyPasswordHash(pw, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const expected = Buffer.from(parts[2], 'hex');
    const key = await scryptAsync(pw, Buffer.from(parts[1], 'hex'));
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch (e) { return false; }
}
function safeEqualStr(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
// Cek password user. Data lama (teks biasa) otomatis di-upgrade menjadi hash saat berhasil login.
async function checkUserPassword(userObj, pw, username) {
  if (!userObj || pw === undefined || pw === null) return false;
  if (userObj.passwordHash) return verifyPasswordHash(pw, userObj.passwordHash);
  if (userObj.password !== undefined && userObj.password !== null && safeEqualStr(userObj.password, pw)) {
    try {
      if (username) {
        userObj.passwordHash = await hashPassword(pw);
        delete userObj.password;
        await saveUserToDb(username, userObj);
      }
    } catch (e) { }
    return true;
  }
  return false;
}

const DATA_KEY = crypto.createHash('sha256').update(String(DATA_KEY_RAW)).digest();
function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', DATA_KEY, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'enc1$' + iv.toString('hex') + '$' + c.getAuthTag().toString('hex') + '$' + enc.toString('hex');
}
function decryptText(blob) {
  try {
    const p = String(blob).split('$');
    if (p.length !== 4 || p[0] !== 'enc1') return '';
    const d = crypto.createDecipheriv('aes-256-gcm', DATA_KEY, Buffer.from(p[1], 'hex'));
    d.setAuthTag(Buffer.from(p[2], 'hex'));
    return Buffer.concat([d.update(Buffer.from(p[3], 'hex')), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}

// Pembatas percobaan (anti tebak password / spam daftar)
const rateBuckets = new Map();
function rateBlocked(bucket, key, max, windowMs) {
  const k = bucket + '|' + key;
  const e = rateBuckets.get(k);
  if (!e) return false;
  if (Date.now() - e.first > windowMs) { rateBuckets.delete(k); return false; }
  return e.count >= max;
}
function rateNote(bucket, key, windowMs) {
  const k = bucket + '|' + key;
  const now = Date.now();
  const e = rateBuckets.get(k);
  if (!e || now - e.first > windowMs) rateBuckets.set(k, { count: 1, first: now, win: windowMs });
  else e.count++;
}
function rateClear(bucket, key) { rateBuckets.delete(bucket + '|' + key); }
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rateBuckets) if (now - e.first > (e.win || 3600000)) rateBuckets.delete(k);
}, 10 * 60 * 1000).unref();
function clientIp(req) {
  if (process.env.TRUST_PROXY === '1' || process.env.VERCEL) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
const LOGIN_WINDOW = 15 * 60 * 1000;
const REGISTER_WINDOW = 60 * 60 * 1000;
const ADMIN_ENV_PW = (process.env.ADMIN_PASSWORD || '').length >= 6 ? process.env.ADMIN_PASSWORD : '';

// ====== KONFIGURASI DANA ADMIN ======
const DANA_ADMIN_NUMBER = requireEnv('DANA_ADMIN_NUMBER');
const DANA_ADMIN_NAME = process.env.DANA_ADMIN_NAME || '';

// ====== KONFIGURASI PEMBAYARAN QR OTOMATIS (INVOICE API) ======
// API key dibaca dari .env (QR_PAY_API_KEY)
const QR_PAY_API_KEY = process.env.QR_PAY_API_KEY || '';
if (!QR_PAY_API_KEY) console.warn('[ENV] QR_PAY_API_KEY kosong - pembayaran QR otomatis tidak akan berfungsi.');
// Base URL API invoice (akhiran /v1 otomatis dibuang karena path /v1/invoices sudah ditambahkan di kode)
const QR_PAY_BASE_URL = (process.env.QR_PAY_BASE_URL || 'https://api.sayabayar.com/v1').replace(/\/+$/, '').replace(/\/v1$/, '');
const QR_PAY_TIMEOUT = 20 * 1000;
const QR_PAID_STATUSES = ['paid', 'success', 'succeeded', 'settled', 'completed', 'confirmed', 'sukses', 'berhasil', 'lunas'];
const QR_FAILED_STATUSES = ['expired', 'failed', 'cancelled', 'canceled', 'void', 'rejected', 'kedaluwarsa', 'gagal'];
const QR_DEFAULT_VALID_MS = 25 * 60 * 1000;
const qrActivationLocks = new Set();
const qrConfirmCooldown = new Map();
const qrPendingIds = new Set();

// ====== KONFIGURASI ONLINE TRACKING ======
const ONLINE_TIMEOUT = 45 * 1000;
const ONLINE_CLEANUP_INTERVAL = 60 * 1000;

// ====== KONFIGURASI BONUS QUOTA EXPIRY ======
const BONUS_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;
const BASE_QUOTA = 2;

// ====== KONFIGURASI CHAT GLOBAL ======
// Pesan chat TIDAK dihapus otomatis. Batas di bawah hanya membatasi jumlah pesan terbaru yang dikirim ke browser (data di database tetap utuh).
const CHAT_MAX_RETURN = 1000;
const CHAT_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'fire'];
const CHAT_POLL_MAX_OPTIONS = 6;

// ====== NETFLIX CONFIG ======
const NETFLIX_BASE = 'https://nftools.aroshi.my.id';
const NETFLIX_COUNTRY = {
  US:'UNITED STATES',GB:'UNITED KINGDOM',DE:'GERMANY',FR:'FRANCE',JP:'JAPAN',
  KR:'SOUTH KOREA',IN:'INDIA',BR:'BRAZIL',CA:'CANADA',AU:'AUSTRALIA',
  IT:'ITALY',ES:'SPAIN',MX:'MEXICO',PH:'PHILIPPINES',ID:'INDONESIA',
  MY:'MALAYSIA',TH:'THAILAND',SG:'SINGAPORE',TR:'TURKEY',PL:'POLAND',
  NL:'NETHERLANDS',SE:'SWEDEN',NO:'NORWAY',DK:'DENMARK',FI:'FINLAND',
  PT:'PORTUGAL',AR:'ARGENTINA',CL:'CHILE',CO:'COLOMBIA',PK:'PAKISTAN',
  BD:'BANGLADESH',NG:'NIGERIA',EG:'EGYPT',ZA:'SOUTH AFRICA',VN:'VIETNAM',
  RU:'RUSSIA',UA:'UKRAINE',
};

const go = Go.create({
  baseURL: config.base,
  browser: true,
  headers: { 'X-apikey': config.kyzznekooApiKey },
  cookieJar: true,
  keepAlive: true
});

// ====== STORAGE UNTUK CHUNK UPLOAD ======
const UPLOAD_DIR = path.join(os.tmpdir(), 'am-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

setInterval(() => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const now = Date.now();
    files.forEach(f => {
      const fp = path.join(UPLOAD_DIR, f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > 3600000) {
          if (fs.statSync(fp).isDirectory()) fs.rmSync(fp, { recursive: true, force: true });
          else fs.unlinkSync(fp);
        }
      } catch (e) {}
    });
  } catch (e) {}
}, 3600000);

// ====== FIREBASE HELPERS ======
async function getServerStatusFromDb() {
  const snapshot = await get(child(ref(db), `settings/serverStatus`));
  return snapshot.exists() ? snapshot.val() : 'online';
}
async function saveServerStatusToDb(status) { await set(ref(db, `settings/serverStatus`), status); }
async function getUserFromDb(username) {
  if (!username) return null;
  const snapshot = await get(child(ref(db), `users/${username}`));
  return snapshot.exists() ? snapshot.val() : null;
}
async function saveUserToDb(username, userData) { await set(ref(db, `users/${username}`), userData); }
async function deleteUserFromDb(username) { await set(ref(db, `users/${username}`), null); }
async function getRedeemFromDb(code) {
  const snapshot = await get(child(ref(db), `redeems/${code}`));
  return snapshot.exists() ? snapshot.val() : null;
}
async function saveRedeemToDb(code, data) { await set(ref(db, `redeems/${code}`), data); }
async function removeRedeemFromDb(code) { await set(ref(db, `redeems/${code}`), null); }
async function getAllRedeemsFromDb() {
  const snapshot = await get(child(ref(db), `redeems`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function getAllAnnouncementsFromDb() {
  const snapshot = await get(child(ref(db), `announcements`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveAnnouncementToDb(id, data) { await set(ref(db, `announcements/${id}`), data); }
async function removeAnnouncementFromDb(id) { await set(ref(db, `announcements/${id}`), null); }
async function getAllUsersFromDb() {
  const snapshot = await get(child(ref(db), `users`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function getVideoFromDb() {
  const snapshot = await get(child(ref(db), `settings/featuredVideo`));
  return snapshot.exists() ? snapshot.val() : 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-lights-31910-large.mp4';
}
async function saveVideoToDb(videoUrl) { await set(ref(db, `settings/featuredVideo`), videoUrl); }

// ====== GLOBAL CHAT HELPERS ======
async function getGlobalChatFromDb() {
  const snapshot = await get(child(ref(db), `globalChat`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveGlobalChatMessageToDb(id, data) { await set(ref(db, `globalChat/${id}`), data); }
async function deleteGlobalChatMessageFromDb(id) { await set(ref(db, `globalChat/${id}`), null); }
async function getGlobalChatMessageFromDb(id) {
  const snapshot = await get(child(ref(db), `globalChat/${id}`));
  return snapshot.exists() ? snapshot.val() : null;
}
function isValidChatMessageId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id); }

// ====== VIP ACCOUNTS HELPERS ======
async function getVipAccountsFromDb() {
  const snapshot = await get(child(ref(db), `vipAccounts`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveVipAccountToDb(id, data) { await set(ref(db, `vipAccounts/${id}`), data); }
async function removeVipAccountFromDb(id) { await set(ref(db, `vipAccounts/${id}`), null); }

// ====== FEATURE REQUESTS HELPERS ======
async function getFeatureRequestsFromDb() {
  const snapshot = await get(child(ref(db), `featureRequests`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveFeatureRequestToDb(id, data) { await set(ref(db, `featureRequests/${id}`), data); }
async function removeFeatureRequestFromDb(id) { await set(ref(db, `featureRequests/${id}`), null); }

// ====== VIP SHOP HELPERS ======
async function getVipShopFromDb() {
  const snapshot = await get(child(ref(db), `vipShop`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveVipShopToDb(id, data) { await set(ref(db, `vipShop/${id}`), data); }
async function removeVipShopFromDb(id) { await set(ref(db, `vipShop/${id}`), null); }

// ====== TRANSACTIONS HELPERS ======
async function getTransactionsFromDb() {
  const snapshot = await get(child(ref(db), `transactions`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function getTransactionFromDb(id) {
  const snapshot = await get(child(ref(db), `transactions/${id}`));
  return snapshot.exists() ? snapshot.val() : null;
}
async function saveTransactionToDb(id, data) { await set(ref(db, `transactions/${id}`), data); }
async function removeTransactionFromDb(id) { await set(ref(db, `transactions/${id}`), null); }

// ====== HELPER PEMBAYARAN QR OTOMATIS ======
function qrPayRequest(method, apiPath, bodyObj) {
  return new Promise((resolve, reject) => {
    if (!QR_PAY_API_KEY) return reject(new Error('QR_PAY_API_KEY belum diisi di .env'));
    if (!QR_PAY_BASE_URL || QR_PAY_BASE_URL.includes('ISI-BASE-URL')) {
      return reject(new Error('QR_PAY_BASE_URL belum diisi di index.js / environment variable'));
    }
    let target;
    try { target = new URL(QR_PAY_BASE_URL + apiPath); } catch (e) { return reject(new Error('QR_PAY_BASE_URL tidak valid')); }
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = {
      'Accept': 'application/json',
      'X-API-Key': QR_PAY_API_KEY
    };
    if (payload) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    const lib = target.protocol === 'http:' ? http : https;
    const reqApi = lib.request(target, { method, headers, timeout: QR_PAY_TIMEOUT }, (resp) => {
      let raw = '';
      resp.on('data', (c) => { raw += c; });
      resp.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : {}; } catch (e) { json = null; }
        if (resp.statusCode >= 200 && resp.statusCode < 300 && json) return resolve(json);
        let msg = json && (json.message || json.error || json.detail);
        if (msg && typeof msg === 'object') msg = msg.message || JSON.stringify(msg);
        reject(new Error(msg || ('HTTP ' + resp.statusCode)));
      });
    });
    reqApi.on('timeout', () => reqApi.destroy(new Error('Timeout menghubungi API pembayaran')));
    reqApi.on('error', reject);
    if (payload) reqApi.write(payload);
    reqApi.end();
  });
}

function qrPick(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]; }
  return null;
}

function normalizeQrInvoice(raw) {
  const d = (raw && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) ? raw.data : (raw || {});
  const nested = (d.qris && typeof d.qris === 'object') ? d.qris : ((d.qr && typeof d.qr === 'object') ? d.qr : {});
  const id = qrPick(d, ['id', 'invoice_id', 'invoiceId', 'qris_invoiceid']);
  const status = String(qrPick(d, ['status', 'payment_status', 'state']) || '').toLowerCase();
  const isPaidFlag = d.paid === true || !!d.paid_at || !!d.paidAt;
  const amountRaw = Number(qrPick(d, ['amount', 'total', 'gross_amount', 'total_amount']));
  let qrImage = qrPick(d, ['qr_image', 'qrImage', 'qr_url', 'qrUrl', 'qr_image_url', 'qris_url']) || qrPick(nested, ['image', 'url', 'qr_image', 'qr_url']);
  let qrString = qrPick(d, ['qr_string', 'qrString', 'qris_string', 'qris_content', 'qr_content']) || qrPick(nested, ['string', 'content', 'qr_string', 'qris_content']);
  const qrCode = qrPick(d, ['qr_code', 'qrCode', 'qr']);
  if (typeof qrCode === 'string') {
    if (/^(data:image|https?:\/\/)/i.test(qrCode)) { if (!qrImage) qrImage = qrCode; } else if (!qrString) { qrString = qrCode; }
  }
  const checkoutUrl = qrPick(d, ['checkout_url', 'payment_url', 'invoice_url', 'url']);
  let expiresAt = qrPick(d, ['expires_at', 'expired_at', 'expiresAt', 'expiry_time', 'expiry']);
  if (expiresAt !== null) {
    if (typeof expiresAt === 'number') expiresAt = expiresAt < 1e12 ? expiresAt * 1000 : expiresAt;
    else { const t = Date.parse(expiresAt); expiresAt = isNaN(t) ? null : t; }
  }
  return {
    id: id !== null ? String(id) : null,
    status,
    isPaidFlag,
    amount: isNaN(amountRaw) ? null : amountRaw,
    qrImage: typeof qrImage === 'string' ? qrImage : null,
    qrString: typeof qrString === 'string' ? qrString : null,
    checkoutUrl: typeof checkoutUrl === 'string' && /^https?:\/\//i.test(checkoutUrl) ? checkoutUrl : null,
    expiresAt
  };
}

function qrClassify(inv) {
  if (inv.isPaidFlag || QR_PAID_STATUSES.includes(inv.status)) return 'paid';
  if (QR_FAILED_STATUSES.includes(inv.status)) return 'failed';
  return 'pending';
}

function buildSessionPayload(username, userObj) {
  const now = Date.now();
  return {
    success: true,
    username,
    isAdmin: !!userObj.isAdmin,
    usedQuota: userObj.activatedEmails ? userObj.activatedEmails.length : 0,
    bonusQuota: userObj.bonusQuota || 0,
    totalQuota: (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0),
    isVip: !!(userObj.vipUntil && userObj.vipUntil > now),
    vipUntil: userObj.vipUntil || 0
  };
}

function qrTrxClientView(trx) {
  return {
    transactionId: trx.transactionId,
    invoiceId: trx.invoiceId,
    vipName: trx.vipName,
    vipDays: trx.vipDays,
    amount: trx.qrAmount || trx.vipPrice,
    qrString: trx.qrString || null,
    qrImage: trx.qrImage || null,
    checkoutUrl: trx.checkoutUrl || null,
    expiresAt: trx.qrExpiresAt || (trx.createdAt + QR_DEFAULT_VALID_MS)
  };
}

// Aktivasi VIP otomatis setelah pembayaran terkonfirmasi (aman dipanggil berulang: hanya sekali aktif)
async function activateVipFromTransaction(transactionId) {
  if (qrActivationLocks.has(transactionId)) return { activated: false, busy: true };
  qrActivationLocks.add(transactionId);
  try {
    const trx = await getTransactionFromDb(transactionId);
    if (!trx) return { activated: false };
    if (trx.status === 'success') return { activated: false, already: true, trx };
    const targetUser = await getUserFromDb(trx.username);
    if (!targetUser) return { activated: false };
    const now = Date.now();
    const base = (targetUser.vipUntil && targetUser.vipUntil > now) ? targetUser.vipUntil : now;
    targetUser.vipUntil = base + (trx.vipDays * 24 * 60 * 60 * 1000);
    await saveUserToDb(trx.username, targetUser);
    trx.status = 'success';
    trx.paidAt = now;
    trx.updatedAt = now;
    trx.adminNote = trx.adminNote || 'Dikonfirmasi otomatis via pembayaran QR';
    await saveTransactionToDb(transactionId, trx);
    return { activated: true, trx, user: targetUser };
  } finally {
    qrActivationLocks.delete(transactionId);
  }
}

// Cek otomatis di server: pembayaran QR yang terdeteksi lunas langsung mengaktifkan VIP (walau halaman user sudah ditutup)
let qrSweepRunning = false;
async function sweepPendingQrTransactions() {
  if (qrSweepRunning || qrPendingIds.size === 0) return;
  qrSweepRunning = true;
  try {
    for (const trxId of Array.from(qrPendingIds)) {
      try {
        const trx = await getTransactionFromDb(trxId);
        if (!trx || trx.method !== 'qris' || trx.status !== 'pending' || (Date.now() - trx.createdAt) > 60 * 60 * 1000) { qrPendingIds.delete(trxId); continue; }
        const inv = normalizeQrInvoice(await qrPayRequest('GET', '/v1/invoices/' + encodeURIComponent(trx.invoiceId)));
        const state = qrClassify(inv);
        if (state === 'paid') {
          await activateVipFromTransaction(trxId);
          qrPendingIds.delete(trxId);
        } else if (state === 'failed') {
          trx.status = 'failed'; trx.adminNote = 'Invoice ' + (inv.status || 'gagal') + ' (QR)'; trx.updatedAt = Date.now();
          await saveTransactionToDb(trxId, trx);
          qrPendingIds.delete(trxId);
        }
      } catch (e) {}
    }
  } finally { qrSweepRunning = false; }
}
(async () => {
  try {
    const all = await getTransactionsFromDb();
    Object.values(all).forEach(t => { if (t && t.method === 'qris' && t.status === 'pending' && t.invoiceId && (Date.now() - t.createdAt) < 60 * 60 * 1000) qrPendingIds.add(t.transactionId); });
  } catch (e) {}
})();
setInterval(sweepPendingQrTransactions, 15000);

// ====== NETFLIX RESULTS HELPERS ======
async function getNetflixResultsFromDb() {
  const snapshot = await get(child(ref(db), `netflixResults`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveNetflixResultToDb(id, data) { await set(ref(db, `netflixResults/${id}`), data); }

// ====== ORDER HELPERS ======
async function getOrdersFromDb() {
  const snapshot = await get(child(ref(db), `orders`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveOrderToDb(id, data) { await set(ref(db, `orders/${id}`), data); }

// ====== ONLINE TRACKING HELPERS ======
async function getOnlineUsersFromDb() {
  const snapshot = await get(child(ref(db), `onlineUsers`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveOnlineUserToDb(username, data) { await set(ref(db, `onlineUsers/${username}`), data); }
async function removeOnlineUserFromDb(username) { await set(ref(db, `onlineUsers/${username}`), null); }

// ====== NOTIFICATION HELPERS (BARU) ======
async function getNotificationSubscribersFromDb() {
  const snapshot = await get(child(ref(db), `notificationSubscribers`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveNotificationSubscriberToDb(username, data) { await set(ref(db, `notificationSubscribers/${username}`), data); }
async function removeNotificationSubscriberFromDb(username) { await set(ref(db, `notificationSubscribers/${username}`), null); }

// ====== BONUS QUOTA EXPIRY ======
async function checkAndExpireBonusQuota(username) {
  try {
    const userObj = await getUserFromDb(username);
    if (!userObj) return null;
    const now = Date.now();
    let changed = false;

    if (userObj.baseQuota === undefined) {
      userObj.baseQuota = BASE_QUOTA;
      changed = true;
    }

    if (userObj.bonusQuota > 0) {
      if (!userObj.bonusGrantedAt) {
        userObj.bonusGrantedAt = userObj.lastBonusActivity || now;
        changed = true;
      }

      if ((now - userObj.bonusGrantedAt) >= BONUS_EXPIRY_MS) {
        userObj.bonusQuota = 0;
        userObj.bonusGrantedAt = 0;
        userObj.lastBonusActivity = 0;
        if (userObj.activatedEmails && userObj.activatedEmails.length > userObj.baseQuota) {
          userObj.activatedEmails = userObj.activatedEmails.slice(0, userObj.baseQuota);
        }
        changed = true;
        console.log(`[BONUS EXPIRED] User ${username} - bonus direset (2 hari), kembali ke kuota bawaan ${userObj.baseQuota}`);
      }
    }

    if (changed) await saveUserToDb(username, userObj);
    return userObj;
  } catch (e) {
    console.error('[BONUS EXPIRY] Error:', e.message);
    return null;
  }
}

// Sapu otomatis: reset bonus semua user yang sudah lewat 2 hari (walau user tidak sedang online)
async function sweepExpiredBonusQuotas() {
  try {
    const allUsers = await getAllUsersFromDb();
    for (const [uname, udata] of Object.entries(allUsers || {})) {
      if (udata && udata.bonusQuota > 0) await checkAndExpireBonusQuota(uname);
    }
  } catch (e) {
    console.error('[BONUS SWEEP] Error:', e.message);
  }
}
setTimeout(sweepExpiredBonusQuotas, 15 * 1000);
setInterval(sweepExpiredBonusQuotas, 10 * 60 * 1000);

// ====== HD FOTO (UPSCALE) - tanpa dependensi tambahan ======
const UPSCALE_ENDPOINT = config.base + '/api/imgbb/upscale-image';
const HD_MAX_BYTES = 10 * 1024 * 1024;

function httpRequestBuffer(urlStr, options, redirectsLeft) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return reject(new Error('URL tidak valid')); }
    const lib = u.protocol === 'http:' ? http : https;
    const reqOpts = {
      method: options.method || 'GET',
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      headers: options.headers || {}
    };
    const r = lib.request(reqOpts, (resp) => {
      if ([301, 302, 303, 307, 308].includes(resp.statusCode) && resp.headers.location && redirectsLeft > 0) {
        resp.resume();
        const next = new URL(resp.headers.location, urlStr).toString();
        return resolve(httpRequestBuffer(next, { method: 'GET', headers: {}, timeout: options.timeout }, redirectsLeft - 1));
      }
      const chunks = [];
      let total = 0;
      resp.on('data', (c) => {
        total += c.length;
        if (total > 40 * 1024 * 1024) { r.destroy(new Error('Respon terlalu besar')); return; }
        chunks.push(c);
      });
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: Buffer.concat(chunks) }));
      resp.on('error', reject);
    });
    r.setTimeout(options.timeout || 120000, () => r.destroy(new Error('Request timeout')));
    r.on('error', reject);
    if (options.body) r.write(options.body);
    r.end();
  });
}

function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

async function upscaleImage(input, meta) {
  try {
    meta = meta || {};
    let buffer;
    let contentType = meta.contentType || 'image/jpeg';
    let filename = meta.filename || 'image.jpg';

    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      const dl = await httpRequestBuffer(input, { method: 'GET' }, 3);
      if (dl.status < 200 || dl.status >= 300) throw new Error('Gagal mengunduh gambar (HTTP ' + dl.status + ')');
      buffer = dl.body;
      contentType = String(dl.headers['content-type'] || 'image/jpeg').split(';')[0];
    } else {
      throw new Error('Input harus berupa URL (string) atau Buffer.');
    }

    const boundary = '----HDFoto' + crypto.randomBytes(12).toString('hex');
    const head = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n' +
      'Content-Type: ' + contentType + '\r\n\r\n'
    );
    const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([head, buffer, tail]);

    const resp = await httpRequestBuffer(UPSCALE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
        'X-apikey': config.kyzznekooApiKey
      },
      body,
      timeout: 120000
    }, 0);

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error('Server upscale error (HTTP ' + resp.status + '): ' + resp.body.toString('utf8').substring(0, 200));
    }

    const ct = String(resp.headers['content-type'] || '').split(';')[0].toLowerCase();
    const sniffed = sniffImageType(resp.body);
    if (ct.indexOf('image/') === 0 || sniffed) {
      return { buffer: resp.body, contentType: ct.indexOf('image/') === 0 ? ct : sniffed };
    }

    try {
      const j = JSON.parse(resp.body.toString('utf8'));
      const cand = j.url || (j.result && (j.result.url || j.result)) || (j.data && (j.data.url || j.data));
      if (typeof cand === 'string' && /^https?:\/\//i.test(cand)) {
        const dl2 = await httpRequestBuffer(cand, { method: 'GET' }, 3);
        const t2 = sniffImageType(dl2.body);
        if (dl2.status >= 200 && dl2.status < 300 && t2) return { buffer: dl2.body, contentType: t2 };
      }
    } catch (e) { }

    throw new Error('Respon upscale tidak valid');
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

// ====== GENERATE ORDER ID ======
function generateOrderId(prefix = 'ORD') {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${timeStr}-${random}`;
}

// ====== AUTO REFILL QUOTA ======
async function refillQuotaIfNeeded(username, quotaEntry) {
  try {
    const userObj = await getUserFromDb(username);
    if (!userObj) return false;
    if (userObj.activatedEmails && quotaEntry) {
      const idx = userObj.activatedEmails.indexOf(quotaEntry);
      if (idx > -1) {
        userObj.activatedEmails.splice(idx, 1);
        await saveUserToDb(username, userObj);
        console.log(`[QUOTA REFILL] User ${username} - "${quotaEntry}" dikembalikan`);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('[QUOTA REFILL] Error:', e.message);
    return false;
  }
}

// ====== APK BUILDER (WEB -> APK) ======
const APK_API_BASE = 'https://code-v-compiler-sr.vercel.app/api';
const APK_POLL_INTERVAL = 2000;
const APK_BUILD_TIMEOUT = 10 * 60 * 1000;
const APK_MAX_POLL_ERRORS = 8;
const apkJobs = new Map();
const apkStarting = new Set();

function apkSafeKey(id) { return String(id).replace(/[.#$\[\]\/]/g, '_'); }
function apkSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function apkApi(method, apiPath, payload) {
  const bodyStr = payload ? JSON.stringify(payload) : null;
  const headers = { 'Accept': 'application/json' };
  if (bodyStr) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }
  const resp = await httpRequestBuffer(APK_API_BASE + apiPath, { method: method, headers: headers, body: bodyStr || undefined, timeout: 30000 }, 3);
  const text = resp.body.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: resp.status, json: json, text: text };
}

function apkErrMsg(r, fallback) {
  const j = r && r.json;
  if (j && typeof j === 'object') {
    const keys = ['error', 'message', 'detail', 'reason'];
    for (let i = 0; i < keys.length; i++) {
      const v = j[keys[i]];
      if (typeof v === 'string' && v) return v.substring(0, 200);
      if (v && typeof v === 'object' && typeof v.message === 'string' && v.message) return v.message.substring(0, 200);
    }
  }
  const t = r && r.text ? String(r.text).replace(/\s+/g, ' ').trim() : '';
  if (t && t.charAt(0) !== '<') return t.substring(0, 150);
  return fallback;
}

function apkAutoPackage(appName) {
  let seg = String(appName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!seg || /^[0-9]/.test(seg)) seg = 'app' + seg;
  return 'com.app.' + seg.substring(0, 40);
}

// ---- Izin (permission) yang bisa diminta APK saat aplikasi dibuka ----
const APK_PERMISSION_MAP = {
  notifications: ['android.permission.POST_NOTIFICATIONS'],
  camera: ['android.permission.CAMERA'],
  microphone: ['android.permission.RECORD_AUDIO'],
  location: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
  storage: ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_EXTERNAL_STORAGE'],
  contacts: ['android.permission.READ_CONTACTS'],
  bluetooth: ['android.permission.BLUETOOTH_CONNECT']
};
const APK_ICON_MAX_BYTES = 1536 * 1024;

function apkParseIcon(rawIcon) {
  if (rawIcon === undefined || rawIcon === null || rawIcon === '') return { value: '' };
  if (typeof rawIcon !== 'string') return { error: 'Format logo tidak valid!' };
  if (rawIcon.length > 3 * 1024 * 1024) return { error: 'Ukuran logo terlalu besar!' };
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+\/]+={0,2})$/.exec(rawIcon);
  if (!m) return { error: 'Logo harus berupa gambar PNG, JPG, atau WEBP!' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 100) return { error: 'File logo rusak atau terlalu kecil!' };
  if (buf.length > APK_ICON_MAX_BYTES) return { error: 'Ukuran logo maksimal 1.5MB!' };
  const kind = sniffImageType(buf);
  if (!kind) return { error: 'File logo bukan gambar yang valid!' };
  if (kind !== 'image/png') return { error: 'Logo harus berformat PNG!' };
  return { value: 'data:' + kind + ';base64,' + m[2] };
}

function apkParsePermissions(rawPerms) {
  if (rawPerms === undefined || rawPerms === null || rawPerms === '') return { value: [] };
  if (!Array.isArray(rawPerms)) return { error: 'Format izin tidak valid!' };
  const out = [];
  for (let i = 0; i < rawPerms.length; i++) {
    const k = String(rawPerms[i] || '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(APK_PERMISSION_MAP, k)) return { error: 'Izin tidak dikenal: ' + k.substring(0, 30) };
    if (out.indexOf(k) === -1) out.push(k);
  }
  return { value: out };
}

function apkAndroidPermissions(keys) {
  const list = [];
  (keys || []).forEach(function (k) {
    (APK_PERMISSION_MAP[k] || []).forEach(function (n) { if (list.indexOf(n) === -1) list.push(n); });
  });
  return list;
}

function apkNormalizeInput(raw) {
  raw = raw || {};
  let siteUrl = String(raw.url || '').trim();
  if (!siteUrl) return { error: 'URL website wajib diisi!' };
  if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(siteUrl)) siteUrl = 'https://' + siteUrl;
  if (siteUrl.length > 2000) return { error: 'URL terlalu panjang!' };
  let parsed;
  try { parsed = new URL(siteUrl); } catch (e) { return { error: 'URL website tidak valid!' }; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'URL harus diawali http:// atau https://' };
  const appName = String(raw.appName || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!appName) return { error: 'Nama aplikasi wajib diisi!' };
  if (appName.length > 50) return { error: 'Nama aplikasi maksimal 50 karakter!' };
  if (/[<>]/.test(appName)) return { error: 'Nama aplikasi tidak boleh mengandung < atau >' };
  let packageName = String(raw.packageName || '').trim();
  if (!packageName) packageName = apkAutoPackage(appName);
  if (packageName.length > 100 || !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
    return { error: 'Package name tidak valid! Contoh: com.contoh.appku' };
  }
  const versionName = String(raw.versionName || '').trim() || '1.0.0';
  if (!/^[0-9A-Za-z][0-9A-Za-z._+\-]{0,19}$/.test(versionName)) return { error: 'Version name tidak valid! Contoh: 1.0.0' };
  const vcRaw = (raw.versionCode === undefined || raw.versionCode === null || String(raw.versionCode).trim() === '') ? 1 : Number(raw.versionCode);
  if (!Number.isInteger(vcRaw) || vcRaw < 1 || vcRaw > 2100000000) return { error: 'Version code harus angka bulat minimal 1!' };
  const iconRes = apkParseIcon(raw.icon);
  if (iconRes.error) return { error: iconRes.error };
  const permRes = apkParsePermissions(raw.permissions);
  if (permRes.error) return { error: permRes.error };
  return { value: { url: siteUrl, appName: appName, packageName: packageName, versionName: versionName, versionCode: vcRaw, icon: iconRes.value, permissions: permRes.value } };
}

function apkFileName(b) {
  const n = String((b && b.appName) || 'app').replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '') || 'app';
  const v = String((b && b.versionName) || '1.0.0').replace(/[^A-Za-z0-9._\-]+/g, '_');
  return n + '-' + v + '.apk';
}

// ---- Penyimpanan build di Firebase (path: apkBuilds) ----
function apkJobToRecord(job) {
  return {
    buildId: String(job.buildId), username: job.username, appName: job.appName, packageName: job.packageName,
    versionName: job.versionName, versionCode: job.versionCode, url: job.url,
    status: job.status, remoteStatus: job.remoteStatus || '', downloadUrl: job.downloadUrl || '', error: job.error || '',
    quotaEntry: job.quotaEntry || '', charged: !!job.charged, refunded: !!job.refunded, orderId: job.orderId || '',
    permissions: Array.isArray(job.permissions) ? job.permissions : [], hasIcon: !!job.hasIcon,
    timestamp: job.timestamp, finishedAt: job.finishedAt || 0
  };
}

function apkRecordToJob(rec) {
  const done = rec.status === 'ready' || rec.status === 'failed';
  return {
    buildId: String(rec.buildId), username: rec.username || '', appName: rec.appName || '', packageName: rec.packageName || '',
    versionName: rec.versionName || '1.0.0', versionCode: rec.versionCode || 1, url: rec.url || '',
    status: done ? rec.status : 'building', remoteStatus: rec.remoteStatus || '', progress: null,
    downloadUrl: rec.downloadUrl || '', error: rec.error || '', quotaEntry: rec.quotaEntry || '',
    charged: !!rec.charged, refunded: !!rec.refunded, orderId: rec.orderId || '',
    permissions: Array.isArray(rec.permissions) ? rec.permissions : [], hasIcon: !!rec.hasIcon,
    timestamp: rec.timestamp || Date.now(), finishedAt: rec.finishedAt || 0, finalized: done, monitoring: false
  };
}

function apkPublicBuild(job) {
  return {
    buildId: String(job.buildId), appName: job.appName, packageName: job.packageName, versionName: job.versionName,
    versionCode: job.versionCode, url: job.url, status: job.status, remoteStatus: job.remoteStatus || '',
    downloadUrl: job.status === 'ready' ? (job.downloadUrl || '') : '', error: job.error || '', refunded: !!job.refunded,
    orderId: job.orderId || '', permissions: Array.isArray(job.permissions) ? job.permissions : [], hasIcon: !!job.hasIcon,
    timestamp: job.timestamp, finishedAt: job.finishedAt || 0
  };
}

async function apkSaveJob(job) {
  try { await set(ref(db, 'apkBuilds/' + apkSafeKey(job.buildId)), apkJobToRecord(job)); }
  catch (e) { console.error('[APK] Gagal simpan build ke database:', e.message); }
}

async function apkListUserBuilds(username) {
  const merged = new Map();
  try {
    const snap = await get(child(ref(db), 'apkBuilds'));
    const all = snap.exists() ? snap.val() : {};
    Object.keys(all).forEach(function (k) {
      const rec = all[k];
      if (rec && rec.username === username) merged.set(String(rec.buildId), apkPublicBuild(apkRecordToJob(rec)));
    });
  } catch (e) { console.error('[APK] Gagal baca riwayat build:', e.message); }
  apkJobs.forEach(function (job) {
    if (job.username === username) merged.set(String(job.buildId), apkPublicBuild(job));
  });
  return Array.from(merged.values()).sort(function (a, b) { return b.timestamp - a.timestamp; }).slice(0, 20);
}

function apkHasActiveJob(username) {
  let active = false;
  apkJobs.forEach(function (job) { if (job.username === username && !job.finalized) active = true; });
  return active;
}

function apkScheduleCleanup(job) {
  const t = setTimeout(function () { apkJobs.delete(String(job.buildId)); }, 60 * 60 * 1000);
  if (t && t.unref) t.unref();
}

async function apkFinalize(job, ok, info) {
  if (job.finalized) return;
  job.finalized = true;
  job.finishedAt = Date.now();
  if (ok) {
    job.status = 'ready';
    job.downloadUrl = info;
    try {
      job.orderId = generateOrderId('APK');
      await saveOrderToDb(job.orderId, {
        orderId: job.orderId, username: job.username, type: 'apk',
        detail: 'APK • ' + job.appName + ' • ' + job.packageName + ' v' + job.versionName,
        result: 'Build berhasil', timestamp: job.finishedAt, quotaEntry: job.quotaEntry || ''
      });
    } catch (e) { console.error('[APK] Gagal simpan order:', e.message); }
  } else {
    job.status = 'failed';
    job.error = String(info || 'Build gagal').substring(0, 300);
    if (job.charged && job.quotaEntry) job.refunded = await refillQuotaIfNeeded(job.username, job.quotaEntry);
  }
  await apkSaveJob(job);
  apkScheduleCleanup(job);
}

async function apkMonitor(job) {
  if (job.monitoring || job.finalized) return;
  job.monitoring = true;
  let errors = 0;
  try {
    while (!job.finalized) {
      if (Date.now() - job.timestamp > APK_BUILD_TIMEOUT) { await apkFinalize(job, false, 'Build melebihi batas waktu (10 menit)'); break; }
      await apkSleep(APK_POLL_INTERVAL);
      let r;
      try {
        r = await apkApi('GET', '/build/' + encodeURIComponent(job.buildId));
      } catch (netErr) {
        errors++;
        if (errors >= APK_MAX_POLL_ERRORS) await apkFinalize(job, false, 'Koneksi ke server build terputus');
        continue;
      }
      if (r.status === 404) { await apkFinalize(job, false, 'Build tidak ditemukan di server'); break; }
      if (r.status < 200 || r.status >= 300 || !r.json || typeof r.json !== 'object') {
        errors++;
        if (errors >= APK_MAX_POLL_ERRORS) await apkFinalize(job, false, apkErrMsg(r, 'Server build tidak merespons'));
        continue;
      }
      errors = 0;
      const st = String(r.json.status || '').toLowerCase();
      if (st) job.remoteStatus = st;
      const pg = Number(r.json.progress);
      job.progress = (r.json.progress !== undefined && r.json.progress !== null && isFinite(pg) && pg >= 0 && pg <= 100) ? pg : null;
      if (st === 'ready') {
        const dl = r.json.download_url || r.json.downloadUrl;
        if (typeof dl === 'string' && dl) await apkFinalize(job, true, dl);
        else await apkFinalize(job, false, 'Build selesai tetapi URL download tidak tersedia');
        break;
      }
      if (st === 'failed') { await apkFinalize(job, false, apkErrMsg(r, 'Build gagal di server')); break; }
    }
  } catch (e) {
    console.error('[APK] Monitor error:', e.message);
    try { await apkFinalize(job, false, 'Terjadi kesalahan saat memantau build'); } catch (e2) { }
  } finally {
    job.monitoring = false;
  }
}

async function apkGetJob(buildId) {
  buildId = String(buildId || '');
  if (!buildId) return null;
  const mem = apkJobs.get(buildId);
  if (mem) return mem;
  let rec = null;
  try {
    const snap = await get(child(ref(db), 'apkBuilds/' + apkSafeKey(buildId)));
    rec = snap.exists() ? snap.val() : null;
  } catch (e) { rec = null; }
  if (!rec) return null;
  const again = apkJobs.get(buildId);
  if (again) return again;
  const job = apkRecordToJob(rec);
  apkJobs.set(buildId, job);
  if (job.finalized) apkScheduleCleanup(job);
  else apkMonitor(job).catch(function (e) { console.error('[APK] Monitor error:', e.message); });
  return job;
}

async function initAdmin() {
  const adminData = await getUserFromDb('adminbaguss');
  if (!adminData) {
    let pw = ADMIN_ENV_PW;
    let generated = false;
    if (!pw) { pw = crypto.randomBytes(9).toString('base64url'); generated = true; }
    await saveUserToDb('adminbaguss', {
      passwordHash: await hashPassword(pw), isAdmin: true, activatedEmails: [], bonusQuota: 0,
      baseQuota: BASE_QUOTA, lastResetTime: Date.now(), vipUntil: 0
    });
    if (generated) console.log('[ADMIN] Akun admin dibuat. Password awal (catat, hanya tampil sekali): ' + pw);
  }
}

// Amankan data lama: password teks biasa -> hash, password akun VIP -> terenkripsi
async function migrateLegacySecrets() {
  try {
    await dbReady;
    const vip = await getVipAccountsFromDb();
    for (const [id, acc] of Object.entries(vip || {})) {
      if (acc && acc.password !== undefined && !acc.passwordEnc) {
        const { password: legacyPw, ...rest } = acc;
        await saveVipAccountToDb(id, { ...rest, passwordEnc: encryptText(legacyPw) });
      }
    }
    const users = await getAllUsersFromDb();
    let migrated = 0;
    for (const uname of Object.keys(users || {})) {
      const u0 = users[uname];
      if (!u0 || u0.password === undefined) continue;
      const u = await getUserFromDb(uname);
      if (!u || u.password === undefined) continue;
      if (!u.passwordHash) {
        let plain = String(u.password);
        if (uname === 'adminbaguss' && plain === 'baguss') {
          if (ADMIN_ENV_PW) plain = ADMIN_ENV_PW;
          else console.warn('[ADMIN] Password admin masih bawaan lama. Segera ganti lewat menu Profil atau isi ADMIN_PASSWORD di .env.');
        }
        u.passwordHash = await hashPassword(plain);
      }
      delete u.password;
      await saveUserToDb(uname, u);
      migrated++;
    }
    if (migrated > 0) console.log('[KEAMANAN] ' + migrated + ' password lama berhasil diamankan (di-hash).');
  } catch (e) { console.error('[MIGRASI]', e.message); }
}
initAdmin().catch((e) => console.error('[ADMIN INIT]', e.message)).then(migrateLegacySecrets);

async function initDefaultVipShop() {
  const shop = await getVipShopFromDb();
  if (Object.keys(shop).length === 0) {
    const defaultItems = [
      { id: 'vip_7d', name: 'VIP 7 Hari', price: 2000, days: 7, active: true, order: 1 },
      { id: 'vip_30d', name: 'VIP 30 Hari', price: 5000, days: 30, active: true, order: 2 },
      { id: 'vip_90d', name: 'VIP 90 Hari', price: 12000, days: 90, active: true, order: 3 }
    ];
    for (const item of defaultItems) await saveVipShopToDb(item.id, item);
  }
}
initDefaultVipShop();

// ====== CLEANUP ONLINE USERS ======
setInterval(async () => {
  try {
    const onlineUsers = await getOnlineUsersFromDb();
    const now = Date.now();
    for (const [username, data] of Object.entries(onlineUsers)) {
      if (now - (data.lastSeen || 0) > ONLINE_TIMEOUT) {
        await removeOnlineUserFromDb(username);
        console.log(`[ONLINE CLEANUP] ${username} timeout`);
      }
    }
  } catch (e) { console.error('[ONLINE CLEANUP]', e.message); }
}, ONLINE_CLEANUP_INTERVAL);

// ====== ALIGHT MOTION API ======
const AM_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

// Request manual (https bawaan Node) supaya GET bisa membawa body '{}' persis seperti curl
function amRequest(method, apiPath, query, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(config.base + apiPath);
    if (query) Object.keys(query).forEach(k => u.searchParams.set(k, query[k]));
    const payload = Buffer.from(JSON.stringify(bodyObj || {}));
    const req = https.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || 443,
      path: u.pathname + u.search, method,
      headers: {
        'User-Agent': AM_UA,
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-apikey': config.kyzznekooApiKey
      },
      timeout: 60000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { status: false, data: { message: text.substring(0, 200) } }; }
        resolve({ httpStatus: res.statusCode, data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout menghubungi API AM')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function amCheck(r) {
  const d = r.data;
  if (r.httpStatus >= 400 || !d || d.status === false) {
    const msg = (d && d.data && d.data.message) || (d && d.message) || ('HTTP ' + r.httpStatus);
    console.error('[AM API]', r.httpStatus, JSON.stringify(d).substring(0, 300));
    throw new Error(msg);
  }
  return d;
}

const am = {
  async magiclink(email) {
    if (!email || !email.includes("@") || !email.includes(".")) throw new Error("Invalid email.");
    email = String(email).trim();
    const r = await amRequest('GET', '/api/alightmotion/v5/magiclink', { email }, {});
    return amCheck(r);
  },
  async verif(email, url) {
    const r = await amRequest('POST', '/api/alightmotion/v5/premium', null, { email, url });
    return amCheck(r);
  }
};

// ====== NETFLIX ======
function TestProxy(proxy) {
  return new Promise((resolve) => {
    const [proxyHost, proxyPort] = proxy.split(':');
    const opts = { host: proxyHost, port: parseInt(proxyPort), method: 'CONNECT', path: `${proxyHost}:443`, timeout: 4000 };
    const req = http.request(opts);
    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) {
        const tlsSocket = tls.connect({ socket, servername: proxyHost, rejectUnauthorized: false });
        tlsSocket.on('secureConnect', () => { tlsSocket.destroy(); resolve(proxy); });
        tlsSocket.on('error', () => resolve(null));
        setTimeout(() => { tlsSocket.destroy(); resolve(null); }, 3000);
      } else resolve(null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function getHttpProxies() {
  const url = 'https://api.kyzznekoo.my.id/assets/proxy.json';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const data = await r.json();
    return data.data.filter(p => p.protocol === 'http').map(p => `${p.ip}:${p.port}`).filter(p => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(p));
  } catch (e) {
    console.error('Failed proxies:', e.message);
    return [];
  }
}

async function findWorkingProxies(proxyList, count) {
  const shuffled = [...proxyList].sort(() => Math.random() - 0.5);
  const batchSize = Math.min(shuffled.length, 500);
  const batch = shuffled.slice(0, batchSize);
  const results = await Promise.allSettled(batch.map(p => TestProxy(p)));
  return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
}

async function generateNetflixToken(plan, proxy) {
  try {
    const sessionRes = await fetch(`${NETFLIX_BASE}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!sessionRes.ok) throw new Error('Failed to create session');
    const sessionData = await sessionRes.json();
    if (!sessionData.success) throw new Error(sessionData.error || 'Session failed');
    const tokenRes = await fetch(`${NETFLIX_BASE}/api/random`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-NFToken-Session': sessionData.token },
      body: JSON.stringify({ plan })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.success && tokenData.url) {
      return { success: true, plan: tokenData.plan || plan, quality: tokenData.quality || 'HD', country: tokenData.country || 'US', url: tokenData.url, expires: tokenData.expires || null, pool: tokenData.pool || null };
    }
    if (tokenData.powChallenge) {
      const enc = new TextEncoder();
      let proof = null;
      for (let n = 0; n < 2000000; n++) {
        const h = await crypto.subtle.digest('SHA-256', enc.encode(tokenData.powChallenge + n));
        const hex = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (hex.startsWith('0000')) { proof = tokenData.powChallenge + ':' + n; break; }
      }
      if (proof) {
        const retryRes = await fetch(`${NETFLIX_BASE}/api/random`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-NFToken-Session': sessionData.token, 'X-PoW-Proof': proof },
          body: JSON.stringify({ plan })
        });
        const retryData = await retryRes.json();
        if (retryData.success && retryData.url) {
          return { success: true, plan: retryData.plan || plan, quality: retryData.quality || 'HD', country: retryData.country || 'US', url: retryData.url, expires: retryData.expires || null, pool: retryData.pool || null };
        }
      }
    }
    return { success: false, error: tokenData.error || 'Unknown error' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// HTML TEMPLATE
// ==========================================
const htmlTemplate = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>AM PREMIUM • BANGGUS</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Bangers&family=Comic+Neue:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-0: #0a0a0f; --bg-1: #12121a; --bg-2: #1a1a24;
    --line: #26262f; --line-2: #33333f;
    --text-0: #f0f0f5; --text-1: #a8a8b8; --text-2: #6c6c7c;
    --accent: #8b7cf6; --accent-2: #6d5ce6; --accent-soft: rgba(139,124,246,0.12);
    --ok: #4ade80; --ok-soft: rgba(74,222,128,0.12);
    --warn: #fbbf24; --warn-soft: rgba(251,191,36,0.12);
    --err: #f87171; --err-soft: rgba(248,113,113,0.12);
    --info: #60a5fa; --info-soft: rgba(96,165,250,0.12);
    --netflix: #e50914;
  }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  html, body { width:100%; max-width:100%; overflow-x:hidden; margin:0; padding:0; background:var(--bg-0); color:var(--text-0); font-family:'Inter',system-ui,sans-serif; font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased; }
  body { background-image: linear-gradient(rgba(139,124,246,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(139,124,246,0.015) 1px, transparent 1px); background-size: 32px 32px; min-height:100vh; }
  .mono { font-family:'IBM Plex Mono','Courier New',monospace; }
  .display-font { font-family:'Space Grotesk',sans-serif; letter-spacing:-0.02em; }
  .app-shell { width:100%; max-width:520px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; padding:12px; position:relative; }
  .card { background:var(--bg-1); border:1px solid var(--line); border-radius:14px; padding:16px; position:relative; }
  .card-elevated { background:linear-gradient(180deg,var(--bg-2) 0%,var(--bg-1) 100%); border:1px solid var(--line-2); border-radius:14px; padding:16px; }
  .topbar { display:flex; align-items:center; justify-content:space-between; padding:4px 0 16px 0; }
  .brand-mark { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--accent),var(--accent-2)); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; color:white; box-shadow:0 4px 14px rgba(109,92,230,0.35); overflow:hidden; }
  .brand-text { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px; letter-spacing:-0.01em; }
  .brand-sub { font-size:10px; color:var(--text-2); letter-spacing:0.08em; text-transform:uppercase; font-weight:600; margin-top:1px; }
  .inp { width:100%; padding:11px 14px; background:var(--bg-0); border:1px solid var(--line-2); border-radius:10px; color:var(--text-0); font-size:13px; font-family:inherit; outline:none; transition:border-color 0.15s, box-shadow 0.15s; }
  .inp:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
  .inp::placeholder { color:var(--text-2); }
  .inp.mono { font-family:'IBM Plex Mono',monospace; font-size:12.5px; }
  label.field-label { display:block; font-size:11px; font-weight:600; color:var(--text-1); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:11px 16px; border-radius:10px; font-size:13px; font-weight:600; font-family:inherit; border:none; cursor:pointer; transition:transform 0.1s, box-shadow 0.15s, background 0.15s, border-color 0.15s; width:100%; color:white; background:var(--accent); }
  .btn:hover:not(:disabled) { background:var(--accent-2); }
  .btn:active:not(:disabled) { transform:translateY(1px); }
  .btn:disabled { opacity:0.5; cursor:not-allowed; }
  .btn-ghost { background:var(--bg-2); color:var(--text-0); border:1px solid var(--line-2); }
  .btn-ghost:hover:not(:disabled) { background:var(--line); border-color:var(--line-2); }
  .btn-sm { padding:7px 12px; font-size:12px; width:auto; border-radius:8px; }
  .btn-xs { padding:5px 10px; font-size:11px; width:auto; border-radius:6px; font-weight:600; }
  .btn-ok { background:var(--ok); color:#032a17; }
  .btn-ok:hover:not(:disabled) { background:#3ecf70; }
  .btn-err { background:var(--err); color:white; }
  .btn-err:hover:not(:disabled) { background:#e85c5c; }
  .btn-netflix { background:var(--netflix); }
  .btn-netflix:hover:not(:disabled) { background:#c4070f; }
  .btn-warn { background:var(--warn); color:#3a2800; }
  .btn-warn:hover:not(:disabled) { background:#e6ac1e; }
  .btn-info { background:var(--info); }
  .btn-info:hover:not(:disabled) { background:#4a90e2; }
  .badge { display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; font-size:10.5px; font-weight:600; letter-spacing:0.02em; }
  .badge-ok { background:var(--ok-soft); color:var(--ok); border:1px solid rgba(74,222,128,0.25); }
  .badge-err { background:var(--err-soft); color:var(--err); border:1px solid rgba(248,113,113,0.25); }
  .badge-warn { background:var(--warn-soft); color:var(--warn); border:1px solid rgba(251,191,36,0.25); }
  .badge-info { background:var(--info-soft); color:var(--info); border:1px solid rgba(96,165,250,0.25); }
  .badge-accent { background:var(--accent-soft); color:var(--accent); border:1px solid rgba(139,124,246,0.25); }
  .badge-muted { background:var(--bg-2); color:var(--text-1); border:1px solid var(--line-2); }
  #nav-drawer { position:fixed; top:0; bottom:0; right:0; width:86%; max-width:340px; background:var(--bg-1); border-left:1px solid var(--line-2); z-index:50; transform:translateX(105%); transition:transform 0.25s cubic-bezier(0.32,0.72,0,1); display:flex; flex-direction:column; padding:16px; overflow-y:auto; }
  #nav-drawer.open { transform:translateX(0); }
  .nav-link { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:9px; background:transparent; color:var(--text-1); font-size:13px; font-weight:500; border:1px solid transparent; cursor:pointer; text-align:left; font-family:inherit; transition:background 0.12s, color 0.12s, border-color 0.12s; }
  .nav-link:hover { background:var(--bg-2); color:var(--text-0); }
  .nav-link.active { background:var(--accent-soft); color:var(--accent); border-color:rgba(139,124,246,0.3); font-weight:600; }
  .nav-link.netflix-nav.active { background:rgba(229,9,20,0.12); color:#ff6b6b; border-color:rgba(229,9,20,0.3); }
  .nav-link.orders-nav.active { background:rgba(96,165,250,0.12); color:#7dd3fc; border-color:rgba(96,165,250,0.3); }
  .nav-section-label { font-size:10px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.1em; padding:14px 12px 6px 12px; }
  .stat { background:var(--bg-2); border:1px solid var(--line-2); border-radius:10px; padding:11px 13px; display:flex; align-items:center; justify-content:space-between; }
  .stat-label { font-size:10px; color:var(--text-2); text-transform:uppercase; letter-spacing:0.06em; font-weight:700; }
  .stat-value { font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:15px; margin-top:2px; color:var(--text-0); }
  .divider { height:1px; background:var(--line); margin:14px 0; }
  .section-head { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; color:var(--text-1); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:9px; }
  .toast { position:fixed; top:14px; left:50%; transform:translateX(-50%) translateY(-140%); padding:11px 16px; border-radius:10px; font-size:12.5px; font-weight:600; z-index:9999; transition:transform 0.28s cubic-bezier(0.32,0.72,0,1); display:flex; align-items:center; gap:8px; max-width:calc(100vw - 28px); box-shadow:0 10px 40px rgba(0,0,0,0.6); }
  .toast.show { transform:translateX(-50%) translateY(0); }
  .toast-success { background:#1a3a26; color:#a7f3c8; border:1px solid #2d5f3f; }
  .toast-error { background:#3a1a1f; color:#fecaca; border:1px solid #5f2d33; }
  .toast-info { background:#1f1a3a; color:#ddd6fe; border:1px solid #3d2f5f; }
  .toast-netflix { background:#3a0a0c; color:#fecaca; border:1px solid #5f0a0d; }
  .toast-order { background:#0a2a3a; color:#bae6fd; border:1px solid #0a4a5f; }
  .prog { height:6px; background:var(--bg-0); border-radius:999px; overflow:hidden; }
  .prog-fill { height:100%; background:var(--accent); border-radius:999px; transition:width 0.25s; width:0%; }
  .dropzone { border:1.5px dashed var(--line-2); border-radius:10px; padding:20px 12px; text-align:center; cursor:pointer; transition:border-color 0.15s, background 0.15s; }
  .dropzone:hover, .dropzone.dragover { border-color:var(--accent); background:var(--accent-soft); }
  .chat-wrap { height:82vh; height:82dvh; min-height:520px; max-height:1000px; background:var(--bg-0); border:1px solid var(--line-2); border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  body.chat-wide .app-shell { max-width:1100px; }
  .chat-stream { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
  .chat-msg { max-width:88%; padding:8px 12px; border-radius:12px; font-size:12.5px; line-height:1.45; word-wrap:break-word; overflow-wrap:anywhere; animation:fadeUp 0.25s; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .chat-msg-them { align-self:flex-start; background:var(--bg-2); border:1px solid var(--line-2); border-bottom-left-radius:3px; }
  .chat-msg-me { align-self:flex-end; background:var(--accent); color:white; border-bottom-right-radius:3px; }
  .chat-msg-header { font-size:10.5px; font-weight:700; opacity:0.9; margin-bottom:3px; display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
  .chat-time { font-size:9.5px; opacity:0.6; margin-top:4px; }
  .chat-input-bar { display:flex; gap:10px; padding:12px; border-top:1px solid var(--line-2); background:var(--bg-1); }
  .chat-input-bar input { flex:1; font-size:13px; padding:11px 13px; }
  .chat-input-bar button { width:42px; height:42px; border-radius:11px; background:var(--accent); border:none; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.15s; flex-shrink:0; }
  .chat-input-bar button:hover { background:var(--accent-2); }
  .chat-reacts { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
  .react-chip { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; border:1px solid rgba(127,127,127,0.35); background:rgba(127,127,127,0.16); color:inherit; font-size:11px; font-family:inherit; cursor:pointer; line-height:1.4; }
  .react-chip:hover { background:rgba(127,127,127,0.3); }
  .react-chip.mine { border-color:currentColor; background:rgba(127,127,127,0.34); font-weight:700; }
  .react-chip.react-add { opacity:0.7; }
  .react-picker { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; padding:6px; border-radius:12px; background:var(--bg-0); border:1px solid var(--line-2); width:fit-content; }
  .react-pick { font-size:20px; padding:4px 7px; border-radius:9px; border:none; background:transparent; cursor:pointer; line-height:1.2; }
  .react-pick:hover { background:var(--bg-2); transform:scale(1.15); }
  .chat-msg-poll { align-self:stretch; max-width:100%; background:var(--bg-2); border:1px solid var(--accent); color:var(--text-0); border-bottom-left-radius:14px; }
  .poll-title { font-size:13.5px; font-weight:800; margin:2px 0 4px; }
  .poll-meta { font-size:10.5px; color:var(--text-2); margin-top:6px; }
  .poll-opt { position:relative; display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; margin-top:7px; padding:8px 11px; border-radius:10px; border:1px solid var(--line-2); background:var(--bg-0); color:var(--text-0); font-family:inherit; font-size:12.5px; text-align:left; cursor:pointer; overflow:hidden; }
  .poll-opt:hover:not(:disabled) { border-color:var(--accent); }
  .poll-opt.chosen { border-color:var(--accent); font-weight:700; }
  .poll-opt:disabled { cursor:default; opacity:0.85; }
  .poll-fill { position:absolute; left:0; top:0; bottom:0; background:var(--accent-soft); transition:width 0.3s; z-index:0; }
  .poll-opt-text, .poll-opt-count { position:relative; z-index:1; }
  .poll-opt-count { font-size:10.5px; color:var(--text-1); white-space:nowrap; flex-shrink:0; }
  .poll-admin-btn { margin-top:9px; padding:6px 12px; border-radius:8px; border:1px solid var(--line-2); background:var(--bg-0); color:var(--text-1); font-size:11.5px; font-family:inherit; cursor:pointer; }
  .poll-form { display:flex; flex-direction:column; gap:8px; padding:12px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:12px; }
  .opt-row { display:flex; align-items:center; justify-content:space-between; padding:11px 13px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:10px; cursor:pointer; margin-bottom:7px; transition:border-color 0.15s, background 0.15s; }
  .opt-row:hover { border-color:var(--line); background:var(--line); }
  .opt-row.selected { border-color:var(--accent); background:var(--accent-soft); }
  .opt-row.netflix.selected { border-color:var(--netflix); background:rgba(229,9,20,0.1); }
  .dana-card { background:linear-gradient(180deg,#0a1a2e,#08121d); border:1px solid #10385c; border-radius:12px; padding:16px; text-align:center; }
  .dana-chip { display:inline-flex; align-items:center; justify-content:center; padding:4px 12px; background:#0084ff; color:white; border-radius:6px; font-weight:800; font-size:12px; letter-spacing:0.04em; margin-bottom:10px; }
  .dana-number { font-family:'IBM Plex Mono',monospace; font-size:22px; font-weight:800; color:#60c4ff; letter-spacing:0.03em; margin:8px 0; }
  .dana-copy { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; background:#0084ff; color:white; border:none; border-radius:8px; font-weight:600; font-size:12px; cursor:pointer; transition:background 0.15s; }
  .dana-copy:hover { background:#0070db; }
  .dana-step { display:flex; gap:8px; align-items:flex-start; font-size:11.5px; color:var(--text-1); margin-bottom:7px; }
  .dana-step-num { width:20px; height:20px; border-radius:50%; background:#10385c; color:#60c4ff; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .countdown-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .countdown-cell { background:var(--bg-0); border:1px solid var(--line-2); border-radius:8px; padding:8px 4px; text-align:center; }
  .countdown-num { font-family:'IBM Plex Mono',monospace; font-size:18px; font-weight:800; color:var(--err); line-height:1; }
  .countdown-lbl { font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700; margin-top:3px; letter-spacing:0.06em; }
  .shop-item { background:var(--bg-2); border:1px solid var(--line-2); border-radius:12px; padding:14px; transition:border-color 0.15s, transform 0.15s; }
  .shop-item:hover { border-color:var(--warn); transform:translateY(-1px); }
  .online-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:var(--ok-soft); border:1px solid rgba(74,222,128,0.3); border-radius:999px; font-size:11px; font-weight:600; color:var(--ok); }
  .online-dot { width:6px; height:6px; border-radius:50%; background:var(--ok); box-shadow:0 0 6px var(--ok); animation:pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  .hist-item { background:var(--bg-2); border:1px solid var(--line-2); border-radius:10px; padding:12px; }
  .hist-item-order-id { font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:700; color:var(--info); background:var(--info-soft); padding:2px 7px; border-radius:5px; display:inline-block; }
  .link-line { font-family:'IBM Plex Mono',monospace; font-size:11px; word-break:break-all; color:var(--text-1); background:var(--bg-0); border:1px solid var(--line-2); border-radius:7px; padding:8px 10px; cursor:pointer; transition:border-color 0.15s, background 0.15s; }
  .link-line:hover { border-color:var(--accent); background:var(--accent-soft); }
  @media (max-width:480px) { .app-shell { padding:10px; } .card, .card-elevated { padding:13px; } .chat-wrap { height:80vh; height:80dvh; min-height:460px; } .chat-msg { max-width:94%; } }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--line-2); border-radius:999px; }
  ::-webkit-scrollbar-thumb:hover { background:var(--text-2); }
  .hide { display:none !important; }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    50% { transform: translateX(5px); }
    75% { transform: translateX(-5px); }
  }
  .shake-error { animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; border-color: var(--err) !important; }
  .auth-tab-content { animation: fadeInScale 0.3s ease-out forwards; }
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.95) translateY(5px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .btn-loading { position: relative; color: transparent !important; pointer-events: none; }
  .btn-loading::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    top: 50%;
    left: 50%;
    margin-top: -9px;
    margin-left: -9px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .nav-link.hd-nav.active { background:rgba(34,211,238,0.12); color:#67e8f9; border-color:rgba(34,211,238,0.3); }
  .btn-hd { background:linear-gradient(135deg,#06b6d4,#3b82f6); color:white; }
  .btn-hd:hover:not(:disabled) { filter:brightness(1.1); }
  .nav-link.apk-nav.active { background:rgba(52,211,153,0.12); color:#6ee7b7; border-color:rgba(52,211,153,0.3); }
  .btn-apk { background:linear-gradient(135deg,#10b981,#059669); color:white; }
  .btn-apk:hover:not(:disabled) { filter:brightness(1.1); }
  .apk-icon-row { display:flex; align-items:center; gap:10px; }
  .apk-icon-box { width:64px; height:64px; border-radius:16px; background:var(--bg-0); border:1px dashed rgba(52,211,153,0.45); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; font-size:22px; }
  .apk-icon-box img { width:100%; height:100%; object-fit:cover; display:block; }
  .apk-perm-list { display:flex; flex-direction:column; gap:6px; }
  .apk-perm { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; padding:9px 11px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:10px; color:var(--text-1); font-size:12px; font-weight:600; cursor:pointer; text-align:left; transition:all 0.15s; font-family:inherit; }
  .apk-perm:hover { border-color:rgba(52,211,153,0.45); }
  .apk-perm .apk-perm-sub { display:block; font-size:10px; font-weight:400; color:var(--text-2); margin-top:1px; }
  .apk-perm .apk-switch { position:relative; width:34px; height:19px; border-radius:20px; background:var(--line-2); flex-shrink:0; transition:background 0.15s; }
  .apk-perm .apk-switch::after { content:''; position:absolute; top:2px; left:2px; width:15px; height:15px; border-radius:50%; background:#fff; transition:transform 0.15s; }
  .apk-perm.on { background:rgba(52,211,153,0.1); border-color:rgba(52,211,153,0.45); }
  .apk-perm.on .apk-switch { background:#10b981; }
  .apk-perm.on .apk-switch::after { transform:translateX(15px); }
  .hd-compare { position:relative; width:100%; overflow:hidden; border-radius:10px; background:var(--bg-0); border:1px solid var(--line-2); user-select:none; -webkit-user-select:none; touch-action:pan-y; }
  .hd-compare img { display:block; width:100%; height:auto; }
  .hd-before-layer { position:absolute; top:0; left:0; width:100%; height:100%; clip-path:inset(0 50% 0 0); }
  .hd-before-layer img { width:100%; height:100%; object-fit:fill; }
  .hd-slider-line { position:absolute; top:0; bottom:0; left:50%; width:2px; background:white; box-shadow:0 0 6px rgba(0,0,0,0.6); pointer-events:none; }
  .hd-slider-knob { position:absolute; top:50%; left:50%; width:30px; height:30px; margin:-15px 0 0 -15px; border-radius:50%; background:white; color:#0f172a; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; box-shadow:0 2px 8px rgba(0,0,0,0.5); }
  .hd-range { position:absolute; top:0; left:0; width:100%; height:100%; margin:0; opacity:0; cursor:ew-resize; }
  .hd-tag { position:absolute; top:8px; padding:3px 8px; border-radius:6px; background:rgba(0,0,0,0.6); color:white; font-size:10px; font-weight:700; pointer-events:none; }
  
  .notif-toggle { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:8px; font-size:11px; font-weight:600; color:var(--text-1); cursor:pointer; transition:all 0.15s; }
  .notif-toggle:hover { border-color:var(--accent); background:var(--accent-soft); }
  .notif-toggle.active { background:var(--ok-soft); border-color:rgba(74,222,128,0.3); color:var(--ok); }
  .notif-toggle.blocked { background:var(--err-soft); border-color:rgba(248,113,113,0.3); color:var(--err); }
  .notif-toggle svg { width:14px; height:14px; }

  /* ============================================================
     TEMA KOMIK (POP-ART) - hanya tampilan, semua fitur tetap sama
     ============================================================ */
  :root {
    --bg-0: #140f3a; --bg-1: #211a5a; --bg-2: #2c2475;
    --line: #07041c; --line-2: #07041c;
    --text-0: #fff8e7; --text-1: #e4dcc0; --text-2: #a9a1d6;
    --accent: #ffd23f; --accent-2: #ffb700; --accent-soft: rgba(255,210,63,0.16);
    --ok: #3ddc84; --ok-soft: rgba(61,220,132,0.16);
    --warn: #ff9f1c; --warn-soft: rgba(255,159,28,0.18);
    --err: #ff4d6d; --err-soft: rgba(255,77,109,0.18);
    --info: #4cc9f0; --info-soft: rgba(76,201,240,0.16);
    --netflix: #e50914;
    --ink: #07041c;
  }
  html, body { font-family:'Comic Neue','Comic Sans MS',system-ui,sans-serif; font-size:14.5px; font-weight:700; }
  body {
    background-color:#140f3a;
    background-image:
      radial-gradient(rgba(255,210,63,0.16) 1.6px, transparent 2px),
      radial-gradient(rgba(255,77,109,0.12) 1.4px, transparent 1.8px),
      linear-gradient(180deg, #1b1450 0%, #140f3a 60%, #0d0a2b 100%);
    background-size:16px 16px, 16px 16px, 100% 100%;
    background-position:0 0, 8px 8px, 0 0;
    background-attachment:fixed;
  }
  .display-font, .brand-text, .section-head, .stat-label, .nav-section-label, .btn, .badge, .field-label, .poll-title, .toast, .brand-sub {
    font-family:'Bangers','Comic Neue',cursive; letter-spacing:0.06em; font-weight:400;
  }
  .brand-text { font-size:22px; color:var(--accent); text-shadow:2px 2px 0 var(--ink), 3px 3px 0 var(--err); }
  .brand-sub { font-size:12px; color:var(--text-0); }
  .brand-mark { background:var(--accent); border:3px solid var(--ink); border-radius:12px; box-shadow:3px 3px 0 var(--err); transform:rotate(-6deg); }
  .brand-mark svg { stroke:var(--ink); }
  .brand-mark span { color:var(--ink) !important; font-family:'Bangers',cursive; }
  .display-font { color:var(--accent) !important; font-size:30px !important; text-shadow:3px 3px 0 var(--ink), 4px 4px 0 var(--err); }

  .card, .card-elevated {
    background:var(--bg-1); border:3px solid var(--ink); border-radius:14px;
    box-shadow:5px 5px 0 var(--ink), 5px 5px 0 2px rgba(255,210,63,0.55);
    animation:comicPop 0.35s cubic-bezier(0.34,1.56,0.64,1);
  }
  .card-elevated { background:linear-gradient(135deg, #2c2475 0%, #211a5a 100%); position:relative; }
  @keyframes comicPop { 0% { opacity:0; transform:scale(0.94) rotate(-0.6deg); } 100% { opacity:1; transform:scale(1) rotate(0); } }

  #auth-view::before {
    content:'NEW ISSUE #1!'; position:absolute; top:-14px; right:-6px; padding:4px 12px;
    background:var(--err); color:#fff; border:3px solid var(--ink); border-radius:8px;
    font-family:'Bangers',cursive; letter-spacing:0.08em; font-size:14px; transform:rotate(5deg);
    box-shadow:3px 3px 0 var(--ink); z-index:2;
  }
  #auth-view h1::after { content:' POW!'; color:var(--err); }
  #terminal-view > .card:first-of-type, #terminal-view > div:nth-child(2) { position:relative; }

  .inp { background:#120d33; border:3px solid var(--ink); border-radius:10px; color:var(--text-0); font-family:'Comic Neue',sans-serif; font-weight:700; box-shadow:inset 2px 2px 0 rgba(255,255,255,0.06); }
  .inp:focus { border-color:var(--accent); box-shadow:3px 3px 0 var(--accent); }
  .inp.mono { font-family:'IBM Plex Mono',monospace; font-weight:600; }
  label.field-label { color:var(--accent); font-size:13px; }

  .btn {
    color:var(--ink); background:var(--accent); border:3px solid var(--ink); border-radius:10px;
    box-shadow:4px 4px 0 var(--ink); text-transform:uppercase; font-size:15px; letter-spacing:0.07em;
    transition:transform 0.08s, box-shadow 0.08s, background 0.12s;
  }
  .btn:hover:not(:disabled) { background:#ffe27a; transform:translate(-1px,-1px) rotate(-0.6deg); box-shadow:5px 5px 0 var(--ink); }
  .btn:active:not(:disabled) { transform:translate(3px,3px); box-shadow:1px 1px 0 var(--ink); }
  .btn-ghost { background:var(--bg-2); color:var(--text-0); border-color:var(--ink); }
  .btn-ghost:hover:not(:disabled) { background:#3a3190; }
  .btn-ok { background:var(--ok); color:var(--ink); }
  .btn-ok:hover:not(:disabled) { background:#6af0a6; }
  .btn-err { background:var(--err); color:#fff; text-shadow:1px 1px 0 var(--ink); }
  .btn-err:hover:not(:disabled) { background:#ff7a92; }
  .btn-info { background:var(--info); color:var(--ink); }
  .btn-info:hover:not(:disabled) { background:#86dbf5; }
  .btn-warn { background:var(--warn); color:var(--ink); }
  .btn-netflix { background:var(--netflix); color:#fff; text-shadow:1px 1px 0 var(--ink); }
  .btn-hd { background:linear-gradient(135deg,#22d3ee,#6366f1); color:#fff; text-shadow:1px 1px 0 var(--ink); }
  .btn-apk { background:linear-gradient(135deg,#34d399,#10b981); color:var(--ink); text-shadow:none; }
  .btn-sm { font-size:14px; }
  .btn-xs { font-size:12.5px; box-shadow:2px 2px 0 var(--ink); border-width:2.5px; }
  .btn-loading::after { border-color:rgba(7,4,28,0.3); border-top-color:var(--ink); }
  .user-filter-btn[style*="var(--accent)"] { color:var(--ink) !important; }

  .badge { border:2px solid var(--ink); border-radius:8px; box-shadow:2px 2px 0 var(--ink); font-size:12px; }
  .badge-ok { background:var(--ok); color:var(--ink); }
  .badge-err { background:var(--err); color:#fff; }
  .badge-warn { background:var(--warn); color:var(--ink); }
  .badge-info { background:var(--info); color:var(--ink); }
  .badge-accent { background:var(--accent); color:var(--ink); }
  .badge-muted { background:var(--bg-2); color:var(--text-0); }
  .online-pill { background:var(--ok); color:var(--ink); border:2.5px solid var(--ink); box-shadow:2px 2px 0 var(--ink); font-family:'Bangers',cursive; letter-spacing:0.06em; font-size:13px; }
  .online-pill .online-dot { background:var(--ink); box-shadow:none; }

  #nav-drawer { background:var(--bg-1); border-left:4px solid var(--ink); box-shadow:-6px 0 0 rgba(255,210,63,0.45); }
  .nav-link { color:var(--text-0); border:2.5px solid transparent; border-radius:10px; font-family:'Bangers',cursive; letter-spacing:0.06em; font-size:16px; font-weight:400; }
  .nav-link:hover { background:var(--bg-2); border-color:var(--ink); transform:translateX(3px) rotate(-0.5deg); }
  .nav-link.active { background:var(--accent); color:var(--ink); border-color:var(--ink); box-shadow:3px 3px 0 var(--ink); }
  .nav-link.netflix-nav.active { background:var(--netflix); color:#fff; }
  .nav-link.orders-nav.active { background:var(--info); color:var(--ink); }
  .nav-link.hd-nav.active { background:#22d3ee; color:var(--ink); }
  .nav-link.apk-nav.active { background:#34d399; color:var(--ink); }
  .nav-section-label { color:var(--err); font-size:14px; }

  .stat { background:var(--bg-2); border:3px solid var(--ink); border-radius:12px; box-shadow:3px 3px 0 var(--ink); }
  .stat-label { color:var(--accent); font-size:12.5px; }
  .stat-value { font-family:'Bangers',cursive; font-weight:400; letter-spacing:0.05em; font-size:20px; }
  .divider { height:0; background:none; border-top:3px dashed rgba(255,210,63,0.5); }
  .section-head { color:var(--accent); font-size:16px; text-shadow:2px 2px 0 var(--ink); }

  .toast { border:3px solid var(--ink) !important; box-shadow:5px 5px 0 var(--ink); font-size:15px; border-radius:14px; }
  .toast-success { background:var(--ok); color:var(--ink); }
  .toast-error { background:var(--err); color:#fff; text-shadow:1px 1px 0 var(--ink); }
  .toast-info { background:var(--accent); color:var(--ink); }
  .toast-netflix { background:var(--netflix); color:#fff; text-shadow:1px 1px 0 var(--ink); }
  .toast-order { background:var(--info); color:var(--ink); }

  .prog { height:14px; background:#120d33; border:2.5px solid var(--ink); border-radius:999px; }
  .prog-fill { background:repeating-linear-gradient(45deg, var(--accent), var(--accent) 8px, var(--accent-2) 8px, var(--accent-2) 16px); }
  .dropzone, #hd-dropzone { border:3px dashed var(--accent) !important; border-radius:12px; }
  .dropzone:hover, .dropzone.dragover { background:var(--accent-soft); }

  /* Chat: balon bicara komik */
  .chat-wrap { background:#120d33; border:3px solid var(--ink); border-radius:14px; box-shadow:4px 4px 0 var(--ink); }
  .chat-msg { border:2.5px solid var(--ink); box-shadow:3px 3px 0 var(--ink); font-size:14px; position:relative; }
  .chat-msg-them { background:#fff8e7; color:var(--ink); border-radius:16px 16px 16px 3px; }
  .chat-msg-them .chat-msg-header, .chat-msg-them .chat-time { color:var(--ink); }
  .chat-msg-me { background:var(--accent); color:var(--ink); border-radius:16px 16px 3px 16px; }
  .chat-msg-poll { background:var(--bg-2); color:var(--text-0); border-color:var(--ink); border-radius:14px; }
  .chat-msg-header { font-family:'Bangers',cursive; letter-spacing:0.05em; font-weight:400; font-size:13px; }
  .chat-input-bar { background:var(--bg-1); border-top:3px solid var(--ink); }
  .chat-input-bar button { background:var(--err); border:3px solid var(--ink); box-shadow:3px 3px 0 var(--ink); color:#fff; }
  .chat-input-bar button:hover { background:#ff7a92; }
  .react-chip { border:2px solid var(--ink); background:var(--bg-2); color:var(--text-0); box-shadow:2px 2px 0 var(--ink); }
  .chat-msg-them .react-chip { background:#ffe9b0; color:var(--ink); }
  .react-chip.mine { background:var(--accent); color:var(--ink); }
  .react-picker { background:var(--bg-1); border:2.5px solid var(--ink); box-shadow:3px 3px 0 var(--ink); }
  .poll-opt { border:2.5px solid var(--ink); background:#120d33; box-shadow:2px 2px 0 var(--ink); }
  .poll-opt.chosen { border-color:var(--accent); }
  .poll-fill { background:rgba(255,210,63,0.3); }
  .poll-form { border:3px solid var(--ink); box-shadow:3px 3px 0 var(--ink); }
  .poll-admin-btn { border:2.5px solid var(--ink); background:var(--bg-2); color:var(--text-0); box-shadow:2px 2px 0 var(--ink); }

  .opt-row, .hist-item, .shop-item { border:3px solid var(--ink); border-radius:12px; box-shadow:3px 3px 0 var(--ink); }
  .opt-row:hover { background:#3a3190; transform:translate(-1px,-1px); }
  .opt-row.selected { border-color:var(--accent); background:var(--accent-soft); box-shadow:3px 3px 0 var(--accent); }
  .opt-row.netflix.selected { border-color:var(--netflix); box-shadow:3px 3px 0 var(--netflix); }
  .shop-item:hover { border-color:var(--accent); transform:translate(-2px,-2px) rotate(-0.5deg); box-shadow:5px 5px 0 var(--accent); }
  .hist-item-order-id { background:var(--info); color:var(--ink); border:2px solid var(--ink); }
  .link-line { border:2.5px solid var(--ink); background:#120d33; }
  .dana-card { border:3px solid var(--ink); box-shadow:4px 4px 0 #0084ff; }
  .dana-chip { border:2.5px solid var(--ink); font-family:'Bangers',cursive; font-weight:400; letter-spacing:0.08em; }
  .dana-copy { border:3px solid var(--ink); box-shadow:3px 3px 0 var(--ink); font-family:'Bangers',cursive; font-weight:400; letter-spacing:0.06em; font-size:14px; }
  .countdown-cell { border:3px solid var(--ink); box-shadow:2px 2px 0 var(--ink); }
  .countdown-num { font-family:'Bangers',cursive; font-weight:400; font-size:24px; }
  .apk-perm { border:2.5px solid var(--ink); box-shadow:2px 2px 0 var(--ink); }
  .apk-perm.on { background:rgba(61,220,132,0.2); border-color:var(--ok); }
  .apk-icon-box { border:3px dashed #34d399; }
  .hd-compare { border:3px solid var(--ink); box-shadow:4px 4px 0 var(--ink); }
  .hd-tag { border:2px solid var(--ink); font-family:'Bangers',cursive; font-weight:400; letter-spacing:0.06em; }
  .notif-toggle { border:2.5px solid var(--ink); box-shadow:2px 2px 0 var(--ink); font-family:'Bangers',cursive; letter-spacing:0.06em; font-weight:400; font-size:13px; color:var(--text-0); }
  .notif-toggle.active { background:var(--ok); color:var(--ink); }
  .notif-toggle.blocked { background:var(--err); color:#fff; }
  #tab-indicator { background:var(--err) !important; border:2.5px solid var(--ink); box-shadow:2px 2px 0 var(--ink); }
  #tab-login-btn, #tab-reg-btn { font-family:'Bangers',cursive !important; letter-spacing:0.08em; font-weight:400 !important; font-size:15px !important; }
  #auth-view [style*="border:1px solid var(--line-2); border-radius:10px; padding:3px"] { border:3px solid var(--ink) !important; background:#120d33 !important; }
  #offline-banner { border:3px solid var(--ink) !important; box-shadow:3px 3px 0 var(--ink); font-family:'Bangers',cursive; letter-spacing:0.06em; font-size:15px; }
  #main-display-video { border-radius:10px; }
  #terminal-view > div[style*="height:150px"] { border:4px solid var(--ink) !important; box-shadow:5px 5px 0 var(--err); border-radius:12px !important; }

  /* Info-box inline bergaya komik */
  [style*="border-radius:9px"][style*="padding:11px"], [style*="border-radius:11px"][style*="padding:13px"], [style*="border-radius:10px"][style*="padding:10px 12px"] { border-width:2.5px !important; }

  ::-webkit-scrollbar { width:9px; height:9px; }
  ::-webkit-scrollbar-track { background:var(--bg-0); }
  ::-webkit-scrollbar-thumb { background:var(--accent); border:2px solid var(--ink); border-radius:999px; }
  ::-webkit-scrollbar-thumb:hover { background:var(--accent-2); }
  ::selection { background:var(--err); color:#fff; }
  @media (prefers-reduced-motion: reduce) { .card, .card-elevated { animation:none; } .btn, .nav-link, .shop-item, .opt-row { transition:none; } }
</style>
</head>
<body>
<div id="toast-container"></div>
<div class="app-shell">
  <div class="topbar">
    <div style="display:flex; align-items:center; gap:10px;">
      <div class="brand-mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div>
        <div class="brand-text">AM PREMIUM</div>
        <div class="brand-sub">by Banggus</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <button id="notif-btn" onclick="toggleNotifications()" class="notif-toggle" title="Aktifkan notifikasi browser">
        <svg id="notif-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span id="notif-text">Notif</span>
      </button>
      <div id="online-pill-top" class="online-pill hide" title="User online">
        <span class="online-dot"></span>
        <span id="online-count-top">0</span> online
      </div>
      <button id="menu-btn" onclick="toggleMenu()" class="btn-ghost btn btn-sm hide" style="width:auto; padding:7px 9px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  </div>

  <div id="drawer-overlay" onclick="toggleMenu()" class="hide" style="position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:40;"></div>

  <aside id="nav-drawer">
    <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; border-bottom:1px solid var(--line-2); margin-bottom:10px;">
      <div>
        <div style="font-size:10px; color:var(--text-2); text-transform:uppercase; letter-spacing:0.1em; font-weight:700;">Navigation</div>
        <div style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:16px; margin-top:2px;">Menu</div>
      </div>
      <button onclick="toggleMenu()" class="btn-ghost btn btn-xs" style="width:32px; height:32px; padding:0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="nav-section-label">Fitur</div>
    <button onclick="switchView('generator')" data-nav="generator" class="nav-link active"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Alight Motion</button>
    <button onclick="switchView('netflix')" data-nav="netflix" class="nav-link netflix-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/></svg>Netflix Token</button>
    <button onclick="switchView('hdfoto')" data-nav="hdfoto" class="nav-link hd-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>HD Foto<span class="badge badge-ok" style="margin-left:auto; font-size:9px; padding:1px 6px;">NEW</span></button>
    <button onclick="switchView('apk')" data-nav="apk" class="nav-link apk-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>Build APK<span class="badge badge-ok" style="margin-left:auto; font-size:9px; padding:1px 6px;">NEW</span></button>
    <button onclick="switchView('orders')" data-nav="orders" class="nav-link orders-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>Orderan Saya</button>
    <div class="nav-section-label">Akun</div>
    <button onclick="switchView('vipshop')" data-nav="vipshop" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>Beli VIP<span class="badge badge-warn" style="margin-left:auto; font-size:9px; padding:1px 6px;">HOT</span></button>
    <button onclick="switchView('chat')" data-nav="chat" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat Global<span id="chat-unread-badge" class="badge badge-err hide" style="margin-left:auto; font-size:9px; padding:1px 6px;">0</span></button>
    <button onclick="switchView('profile')" data-nav="profile" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Profil Akun</button>
    <div class="nav-section-label">Lainnya</div>
    <button onclick="switchView('announcement')" data-nav="announcement" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>Pengumuman</button>
    <button onclick="switchView('request')" data-nav="request" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Request Fitur</button>
    <button id="nav-admin-btn" onclick="switchView('admin')" data-nav="admin" class="nav-link hide"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Panel Admin</button>
    <div style="margin-top:auto; padding-top:14px; border-top:1px solid var(--line-2);">
      <div style="display:flex; align-items:center; gap:10px; padding:9px; background:var(--bg-2); border-radius:10px; border:1px solid var(--line-2); margin-bottom:9px;">
        <div class="brand-mark" style="width:34px; height:34px; font-size:14px; background:var(--bg-1); border:1px solid var(--line-2); box-shadow:none;"><span id="drawer-avatar" style="color:var(--accent);">?</span></div>
        <div style="flex:1; min-width:0;">
          <div id="drawer-username" style="font-weight:700; font-size:12.5px; overflow:hidden; text-overflow:ellipsis;">Guest</div>
          <div id="drawer-role" style="font-size:10px; color:var(--text-2);">Belum login</div>
        </div>
      </div>
      <button onclick="handleLogout()" id="drawer-logout-btn" class="btn btn-err btn-sm hide" style="width:100%;">Logout</button>
    </div>
  </aside>

  <div style="flex:1; display:flex; flex-direction:column; justify-content:center; padding:8px 0; gap:12px;">
    <div id="offline-banner" class="card hide" style="background:var(--err-soft); border-color:rgba(248,113,113,0.3); padding:10px 13px; font-size:12px; color:var(--err); text-align:center;">⚠ Server offline — fitur generator dinonaktifkan</div>

    <div id="auth-view" class="card-elevated" style="display:flex; flex-direction:column; gap:16px;">
      <div style="text-align:center; padding:8px 0 4px;">
        <div style="width:54px; height:54px; border-radius:14px; background:linear-gradient(135deg,var(--accent),var(--accent-2)); display:inline-flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(109,92,230,0.4); margin-bottom:10px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 class="display-font" style="font-size:22px; font-weight:800; margin:0 0 4px; color:var(--text-0);">Selamat datang</h1>
        <p style="font-size:12.5px; color:var(--text-2); margin:0;">Login atau daftar untuk mulai menggunakan layanan</p>
      </div>
      
      <div style="display:flex; background:var(--bg-0); border:1px solid var(--line-2); border-radius:10px; padding:3px; position:relative;">
        <div id="tab-indicator" style="position:absolute; top:3px; bottom:3px; left:3px; width:calc(50% - 3px); background:var(--accent); border-radius:7px; transition:transform 0.25s cubic-bezier(0.32,0.72,0,1);"></div>
        <button onclick="switchAuthTab('login')" id="tab-login-btn" style="position:relative; z-index:1; flex:1; padding:8px; background:transparent; border:none; font-weight:600; font-size:12.5px; cursor:pointer; color:white; font-family:inherit; border-radius:7px;">Login</button>
        <button onclick="switchAuthTab('register')" id="tab-reg-btn" style="position:relative; z-index:1; flex:1; padding:8px; background:transparent; border:none; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--text-1); font-family:inherit; border-radius:7px;">Daftar</button>
      </div>
      
      <div id="auth-form-container" class="auth-tab-content" style="display:flex; flex-direction:column; gap:12px;">
        <div><label class="field-label">Username</label><input type="text" id="auth-username" placeholder="username_kamu" class="inp mono"></div>
        <div><label class="field-label">Password</label><input type="password" id="auth-password" placeholder="••••••••" class="inp"></div>
        <div id="email-field-container" class="hide">
          <label class="field-label">Email (untuk reset password)</label><input type="email" id="auth-email" placeholder="email@gmail.com" class="inp" style="margin-bottom:8px;">
          <p style="font-size:10.5px; color:var(--warn); margin:0;">1 perangkat hanya bisa mendaftar 1 akun</p>
        </div>
      </div>
      <button onclick="handleAuthAction()" id="auth-submit-btn" class="btn"><span id="auth-btn-text">Masuk</span></button>
      <div id="forgot-link-wrap" style="text-align:center;"><a href="#" onclick="toggleForgotPanel(true); return false;" style="font-size:12px; color:var(--accent);">Lupa password?</a></div>
      <div id="forgot-panel" class="hide" style="display:flex; flex-direction:column; gap:10px;">
        <div style="font-size:12px; color:var(--text-1);">Masukkan username. Kode 6 digit akan dikirim ke email yang kamu daftarkan.</div>
        <input type="text" id="forgot-username" placeholder="username_kamu" class="inp mono">
        <button onclick="sendResetCode()" id="forgot-send-btn" class="btn">Kirim Kode</button>
        <div id="forgot-step2" class="hide" style="display:flex; flex-direction:column; gap:10px;">
          <input type="text" id="forgot-code" placeholder="Kode 6 digit" inputmode="numeric" maxlength="6" class="inp mono">
          <input type="password" id="forgot-newpass" placeholder="Password baru" class="inp">
          <button onclick="submitResetPassword()" id="forgot-submit-btn" class="btn">Ubah Password</button>
        </div>
        <button onclick="toggleForgotPanel(false)" class="btn btn-ghost btn-sm">Kembali ke login</button>
      </div>
    </div>

    <div id="terminal-view" class="hide" style="display:flex; flex-direction:column; gap:10px;">
      <div style="width:100%; height:150px; border-radius:12px; overflow:hidden; border:1px solid var(--line-2); background:black;">
        <video id="main-display-video" src="" autoplay loop muted playsinline preload="none" style="width:100%; height:100%; object-fit:cover;"></video>
      </div>
      <div class="card" style="padding:11px 13px; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <div class="brand-mark" style="width:34px; height:34px; font-size:14px; background:var(--bg-2); border:1px solid var(--line-2); box-shadow:none;"><span id="user-avatar" style="color:var(--accent);">U</span></div>
          <div style="min-width:0;">
            <div id="logged-username" style="font-weight:700; font-size:13px; overflow:hidden; text-overflow:ellipsis;">-</div>
            <div style="margin-top:3px;"><span id="role-badge" class="badge badge-muted">User</span></div>
          </div>
        </div>
        <span id="server-status-indicator" class="badge badge-ok"><span id="server-dot" class="online-dot"></span><span id="server-status-text">...</span></span>
      </div>
      <div id="vip-status-banner" class="hide" style="background:linear-gradient(135deg,var(--warn-soft),var(--accent-soft)); border:1px solid rgba(251,191,36,0.3); border-radius:12px; padding:12px 14px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:9px; background:rgba(251,191,36,0.2); display:flex; align-items:center; justify-content:center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
            </div>
            <div>
              <div style="font-size:12px; font-weight:800; color:var(--warn);">VIP PREMIUM</div>
              <div id="vip-expiry-text" style="font-size:10.5px; color:var(--text-1); margin-top:2px;">Aktif hingga: -</div>
            </div>
          </div>
          <span class="badge badge-warn">Active</span>
        </div>
      </div>
      <div id="reset-banner-main" class="hide" style="background:var(--err-soft); border:1px solid rgba(248,113,113,0.3); border-radius:12px; padding:13px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:rgba(248,113,113,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div style="flex:1;">
            <div style="font-size:12px; font-weight:800; color:var(--err);">Kuota habis</div>
            <div style="font-size:10.5px; color:var(--text-1);">Reset otomatis dalam:</div>
          </div>
        </div>
        <div class="countdown-grid">
          <div class="countdown-cell"><div id="cd-hours-main" class="countdown-num">00</div><div class="countdown-lbl">Jam</div></div>
          <div class="countdown-cell"><div id="cd-minutes-main" class="countdown-num">00</div><div class="countdown-lbl">Menit</div></div>
          <div class="countdown-cell"><div id="cd-seconds-main" class="countdown-num">00</div><div class="countdown-lbl">Detik</div></div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="stat"><div><div class="stat-label">Kuota</div><div id="quota-display" class="stat-value">0/2</div></div>
          <div style="width:30px; height:30px; border-radius:8px; background:var(--accent-soft); display:flex; align-items:center; justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
        </div>
        <div class="stat"><div><div class="stat-label">Reset</div><div id="reset-timer-display" class="stat-value">24 Jam</div></div>
          <div style="width:30px; height:30px; border-radius:8px; background:rgba(96,165,250,0.15); display:flex; align-items:center; justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        </div>
      </div>
      <div class="card" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <div class="section-head"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Kirim Magic Link</div>
          <input type="email" id="target-email" placeholder="target@gmail.com" class="inp">
        </div>
        <button id="btn-send" onclick="handleSendEmail()" class="btn"><span id="send-text">Kirim Magic Link</span></button>
        <div class="divider"></div>
        <div>
          <div class="section-head" style="color:var(--ok);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Verifikasi Magic URL</div>
          <input type="text" id="magic-url" placeholder="https://alight-creative..." class="inp mono" style="font-size:11.5px;">
        </div>
        <button onclick="handleActivate()" class="btn btn-ok">Verifikasi Sekarang</button>
      </div>
      <div class="card" style="display:flex; flex-direction:column; gap:12px;">
        <div class="section-head" style="color:var(--info);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>Klaim Kode Redeem</div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="redeem-code-input-main" placeholder="KODE-REDEEM" class="inp mono" style="flex:1; text-transform:uppercase; font-weight:700;">
          <button onclick="handleRedeemCodeMain()" class="btn btn-sm">Klaim</button>
        </div>
        <div style="border-top:1px solid var(--line); padding-top:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--info); letter-spacing:0.06em;">Kode Aktif</div>
            <button onclick="loadActiveRedeems()" class="btn btn-ghost btn-xs">Refresh</button>
          </div>
          <div id="active-redeem-list" style="display:flex; flex-direction:column; gap:7px; max-height:180px; overflow-y:auto;">
            <p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Memuat...</p>
          </div>
        </div>
      </div>
      <div id="result-box" class="hide">
        <div class="card" style="padding:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--text-1); letter-spacing:0.06em;">Response</div>
            <button onclick="copyResult()" class="btn btn-ghost btn-xs">Copy</button>
          </div>
          <pre id="result-text" class="mono" style="font-size:10.5px; color:var(--accent); white-space:pre-wrap; word-break:break-all; max-height:180px; overflow-y:auto; margin:0;"></pre>
        </div>
      </div>
    </div>

    <div id="section-orders" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0; color:var(--info);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>Orderan Saya</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <div style="padding:8px 4px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.2); border-radius:8px; text-align:center;"><div style="font-size:9px; color:var(--info); font-weight:700; text-transform:uppercase;">Total</div><div id="my-orders-total" class="mono" style="font-size:14px; font-weight:800;">0</div></div>
        <div style="padding:8px 4px; background:var(--accent-soft); border:1px solid rgba(139,124,246,0.2); border-radius:8px; text-align:center;"><div style="font-size:9px; color:var(--accent); font-weight:700; text-transform:uppercase;">AM</div><div id="my-orders-am" class="mono" style="font-size:14px; font-weight:800;">0</div></div>
      </div>
      <div style="display:flex; gap:7px;">
        <input type="text" id="order-search-input" oninput="renderMyOrders()" placeholder="Cari Order ID..." class="inp mono" style="flex:1;">
        <button onclick="loadMyOrders(true)" class="btn btn-ghost btn-sm" style="width:auto;">↻</button>
      </div>
      <div id="my-orders-list" style="display:flex; flex-direction:column; gap:9px; max-height:460px; overflow-y:auto;">
        <p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Memuat...</p>
      </div>
    </div>

    <div id="section-netflix" class="hide" style="display:flex; flex-direction:column; gap:10px;">
      <div class="card" style="padding:11px 13px; display:flex; align-items:center; justify-content:space-between; border-color:rgba(229,9,20,0.3);">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,var(--netflix),#b20710); display:flex; align-items:center; justify-content:center; font-weight:900; color:white; font-size:15px;">N</div>
          <div><div style="font-weight:700; font-size:13px;">Netflix Token</div><div style="font-size:10.5px; color:var(--err);">Premium access</div></div>
        </div>
        <span class="badge badge-ok"><span class="online-dot"></span>Ready</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="stat" style="border-color:rgba(229,9,20,0.3);"><div><div class="stat-label">Kuota</div><div id="netflix-quota-display" class="stat-value">0</div></div></div>
        <div class="stat" style="border-color:rgba(229,9,20,0.3);"><div><div class="stat-label">Reset</div><div id="netflix-reset-display" class="stat-value">24 Jam</div></div></div>
      </div>
      <div style="padding:10px 12px; background:var(--err-soft); border:1px solid rgba(248,113,113,0.25); border-radius:10px; font-size:11px; color:var(--err); display:flex; gap:6px; align-items:flex-start;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-top:1px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span><strong>Quota sama</strong> dengan semua fitur — setiap generate = -1 quota</span>
      </div>
      <div class="card" style="border-color:rgba(229,9,20,0.3); display:flex; flex-direction:column; gap:12px;">
        <div class="section-head" style="color:var(--err);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/></svg>Pilih Plan</div>
        <div id="plan-options">
          <div class="opt-row netflix" data-plan="premium" onclick="selectNetflixPlan('premium')"><div><div style="font-weight:700; font-size:12.5px;">🏆 Premium</div><div style="font-size:10px; color:var(--text-2);">4K + HDR • 4 Screen</div></div><span style="font-size:11px; color:var(--err); font-weight:700;">1 Q</span></div>
          <div class="opt-row netflix" data-plan="standard" onclick="selectNetflixPlan('standard')"><div><div style="font-weight:700; font-size:12.5px;">⭐ Standard</div><div style="font-size:10px; color:var(--text-2);">1080p • 2 Screen</div></div><span style="font-size:11px; color:var(--err); font-weight:700;">1 Q</span></div>
          <div class="opt-row netflix" data-plan="basic" onclick="selectNetflixPlan('basic')"><div><div style="font-weight:700; font-size:12.5px;">📱 Basic</div><div style="font-size:10px; color:var(--text-2);">720p • 1 Screen</div></div><span style="font-size:11px; color:var(--err); font-weight:700;">1 Q</span></div>
        </div>
        <label style="display:flex; align-items:center; gap:8px; padding:9px 11px; background:var(--bg-0); border:1px solid var(--line-2); border-radius:9px; cursor:pointer;">
          <input type="checkbox" id="netflix-use-proxy" checked style="accent-color:var(--netflix);">
          <span style="font-size:11.5px; color:var(--text-1);">Gunakan Proxy</span>
        </label>
        <button id="btn-generate-netflix" onclick="handleGenerateNetflix()" class="btn btn-netflix"><span id="netflix-btn-text">Generate Token</span></button>
      </div>
      <div id="netflix-loading" class="hide card" style="border-color:rgba(229,9,20,0.3);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:var(--err-soft); display:flex; align-items:center; justify-content:center;">
            <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          </div>
          <div><div style="font-weight:700; font-size:12px;">Memproses...</div><div id="netflix-status-text" style="font-size:10.5px; color:var(--text-2);">Menyiapkan browser</div></div>
        </div>
        <div class="prog"><div id="netflix-progress-fill" class="prog-fill" style="background:var(--netflix);"></div></div>
        <p id="netflix-log-text" class="mono" style="font-size:10px; color:var(--text-2); margin-top:8px; text-align:center;">Initializing...</p>
      </div>
      <div id="netflix-results-container" class="hide" style="display:flex; flex-direction:column; gap:9px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="section-head" style="margin:0; color:var(--err);">Hasil</div>
          <button onclick="clearNetflixResults()" class="btn btn-ghost btn-xs">Bersihkan</button>
        </div>
        <div id="netflix-results-list" style="display:flex; flex-direction:column; gap:9px;"></div>
      </div>
      <div class="card" style="border-color:rgba(229,9,20,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--err); letter-spacing:0.06em;">Riwayat</div>
          <button onclick="loadNetflixHistory()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="netflix-history-list" style="display:flex; flex-direction:column; gap:7px; max-height:220px; overflow-y:auto;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Memuat...</p>
        </div>
      </div>
    </div>

    <div id="section-hdfoto" class="hide" style="display:flex; flex-direction:column; gap:10px;">
      <div class="card" style="padding:11px 13px; display:flex; align-items:center; justify-content:space-between; border-color:rgba(34,211,238,0.3);">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,#06b6d4,#3b82f6); display:flex; align-items:center; justify-content:center; font-weight:900; color:white; font-size:13px;">HD</div>
          <div><div style="font-weight:700; font-size:13px;">HD Foto Generator</div><div style="font-size:10.5px; color:#67e8f9;">Upscale &amp; perjelas foto</div></div>
        </div>
        <span class="badge badge-ok"><span class="online-dot"></span>Ready</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="stat" style="border-color:rgba(34,211,238,0.3);"><div><div class="stat-label">Kuota</div><div id="hd-quota-display" class="stat-value">0</div></div></div>
        <div class="stat" style="border-color:rgba(34,211,238,0.3);"><div><div class="stat-label">Reset</div><div id="hd-reset-display" class="stat-value">24 Jam</div></div></div>
      </div>
      <div style="padding:10px 12px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.25); border-radius:10px; font-size:11px; color:var(--info); display:flex; gap:6px; align-items:flex-start;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-top:1px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span><strong>Quota sama</strong> dengan semua fitur — setiap generate HD = -1 quota. Jika gagal, kuota otomatis dikembalikan.</span>
      </div>
      <div class="card" style="border-color:rgba(34,211,238,0.3); display:flex; flex-direction:column; gap:12px;">
        <div class="section-head" style="color:#67e8f9;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Foto</div>
        <label id="hd-dropzone" for="hd-file-input" ondragover="event.preventDefault()" ondrop="handleHdDrop(event)" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:16px 12px; border:2px dashed rgba(34,211,238,0.4); border-radius:12px; background:var(--bg-0); cursor:pointer; text-align:center;">
          <div id="hd-dropzone-empty" style="display:flex; flex-direction:column; align-items:center; gap:6px;">
            <div style="font-size:30px;">🖼️</div>
            <div style="font-weight:700; font-size:12.5px;">Tap untuk upload foto</div>
            <div style="font-size:10.5px; color:var(--text-2);">JPG, PNG, WEBP • Maks 8MB</div>
          </div>
          <div id="hd-preview-wrap" class="hide" style="width:100%;">
            <img id="hd-preview-img" alt="Preview" style="max-width:100%; max-height:260px; border-radius:8px; display:block; margin:0 auto;">
            <div id="hd-file-info" class="mono" style="font-size:10.5px; color:var(--text-1); margin-top:8px; word-break:break-all;"></div>
            <div style="font-size:10px; color:var(--text-2); margin-top:2px;">Tap untuk ganti foto</div>
          </div>
        </label>
        <input type="file" id="hd-file-input" accept="image/png,image/jpeg,image/webp" onchange="handleHdFileSelect(event)" style="display:none;">
        <div style="display:flex; gap:8px;">
          <button id="btn-generate-hd" onclick="handleGenerateHd()" class="btn btn-hd" style="flex:1;" disabled><span id="hd-btn-text">Generate HD</span></button>
          <button onclick="clearHdPhoto()" class="btn btn-ghost">Reset</button>
        </div>
      </div>
      <div id="hd-loading" class="hide card" style="border-color:rgba(34,211,238,0.3);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:rgba(34,211,238,0.12); display:flex; align-items:center; justify-content:center;">
            <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          </div>
          <div><div style="font-weight:700; font-size:12px;">Memproses...</div><div id="hd-status-text" style="font-size:10.5px; color:var(--text-2);">Menyiapkan</div></div>
        </div>
        <div class="prog"><div id="hd-progress-fill" class="prog-fill" style="background:#06b6d4;"></div></div>
        <p id="hd-log-text" class="mono" style="font-size:10px; color:var(--text-2); margin-top:8px; text-align:center;">Initializing...</p>
      </div>
      <div id="hd-result-container" class="hide card" style="border-color:rgba(34,211,238,0.3); display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="section-head" style="margin:0; color:#67e8f9;">Sebelum &amp; Sesudah</div>
          <span id="hd-dims-info" class="mono" style="font-size:9.5px; color:var(--text-2);"></span>
        </div>
        <div class="hd-compare" id="hd-compare">
          <img id="hd-after-img" alt="Sesudah HD">
          <div class="hd-before-layer" id="hd-before-layer"><img id="hd-before-img" alt="Sebelum HD"></div>
          <span class="hd-tag" style="left:8px;">Sebelum</span>
          <span class="hd-tag" style="right:8px;">Sesudah HD</span>
          <div class="hd-slider-line" id="hd-slider-line"><div class="hd-slider-knob">&#8596;</div></div>
          <input type="range" min="0" max="100" value="50" id="hd-range" class="hd-range" oninput="updateHdSlider(this.value)">
        </div>
        <div style="font-size:10px; color:var(--text-2); text-align:center;">Geser untuk membandingkan sebelum dan sesudah</div>
        <div style="display:flex; gap:8px;">
          <button onclick="downloadHdResult()" class="btn btn-hd" style="flex:1;">Download HD</button>
          <button onclick="clearHdPhoto()" class="btn btn-ghost">Foto Baru</button>
        </div>
      </div>
    </div>

    <div id="section-apk" class="hide" style="display:flex; flex-direction:column; gap:10px;">
      <div class="card" style="padding:11px 13px; display:flex; align-items:center; justify-content:space-between; border-color:rgba(52,211,153,0.3);">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,#10b981,#059669); display:flex; align-items:center; justify-content:center; font-weight:900; color:white; font-size:11px;">APK</div>
          <div><div style="font-weight:700; font-size:13px;">APK Builder</div><div style="font-size:10.5px; color:#6ee7b7;">Ubah website jadi aplikasi Android</div></div>
        </div>
        <span class="badge badge-ok"><span class="online-dot"></span>Ready</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="stat" style="border-color:rgba(52,211,153,0.3);"><div><div class="stat-label">Kuota</div><div id="apk-quota-display" class="stat-value">0</div></div></div>
        <div class="stat" style="border-color:rgba(52,211,153,0.3);"><div><div class="stat-label">Status</div><div id="apk-state-display" class="stat-value">Siap</div></div></div>
      </div>
      <div style="padding:10px 12px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.25); border-radius:10px; font-size:11px; color:var(--info); display:flex; gap:6px; align-items:flex-start;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-top:1px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span><strong>Quota sama</strong> dengan semua fitur — setiap build APK = -1 quota. Jika build gagal, kuota otomatis dikembalikan.</span>
      </div>
      <div class="card" style="border-color:rgba(52,211,153,0.3); display:flex; flex-direction:column; gap:11px;">
        <div class="section-head" style="color:#6ee7b7; margin-bottom:0;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>Konfigurasi Aplikasi</div>
        <div>
          <label class="field-label" for="apk-url">URL Website</label>
          <input type="text" id="apk-url" class="inp mono" placeholder="https://websiteku.com" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url">
        </div>
        <div>
          <label class="field-label" for="apk-appname">Nama Aplikasi</label>
          <input type="text" id="apk-appname" class="inp" placeholder="Aplikasiku" maxlength="50" autocomplete="off">
        </div>
        <div>
          <label class="field-label" for="apk-package">Package Name</label>
          <input type="text" id="apk-package" class="inp mono" placeholder="com.contoh.appku (kosong = otomatis)" maxlength="100" autocomplete="off" autocapitalize="off" spellcheck="false">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div>
            <label class="field-label" for="apk-vname">Version Name</label>
            <input type="text" id="apk-vname" class="inp mono" placeholder="1.0.0" value="1.0.0" maxlength="20" autocomplete="off">
          </div>
          <div>
            <label class="field-label" for="apk-vcode">Version Code</label>
            <input type="number" id="apk-vcode" class="inp mono" placeholder="1" value="1" min="1" step="1" inputmode="numeric">
          </div>
        </div>
        <div>
          <label class="field-label">Logo Aplikasi (opsional)</label>
          <div class="apk-icon-row">
            <div class="apk-icon-box" id="apk-icon-box"><span id="apk-icon-placeholder">🖼️</span><img id="apk-icon-preview" class="hide" alt="Logo"></div>
            <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;">
              <input type="file" id="apk-icon-input" accept="image/png,image/jpeg,image/webp" onchange="handleApkIconSelect(event)" style="display:none;">
              <div style="display:flex; gap:6px;">
                <button type="button" onclick="document.getElementById('apk-icon-input').click()" class="btn btn-ghost btn-xs">Pilih Foto</button>
                <button type="button" id="apk-icon-remove" onclick="clearApkIcon()" class="btn btn-ghost btn-xs hide">Hapus</button>
              </div>
              <div id="apk-icon-info" style="font-size:10px; color:var(--text-2); word-break:break-word;">PNG/JPG/WEBP, otomatis dipotong persegi 512x512</div>
            </div>
          </div>
        </div>
        <div>
          <label class="field-label">Minta Perizinan Otomatis</label>
          <div style="font-size:10.5px; color:var(--text-2); margin-bottom:7px;">Aktifkan izin yang ingin langsung diminta APK saat pertama kali dibuka.</div>
          <div class="apk-perm-list" id="apk-perm-list">
            <button type="button" class="apk-perm" data-perm="notifications" onclick="toggleApkPerm('notifications')"><span>🔔 Notifikasi<span class="apk-perm-sub">Kirim pemberitahuan ke pengguna</span></span><span class="apk-switch"></span></button>
            <button type="button" class="apk-perm" data-perm="camera" onclick="toggleApkPerm('camera')"><span>📷 Kamera<span class="apk-perm-sub">Ambil foto / video dari website</span></span><span class="apk-switch"></span></button>
            <button type="button" class="apk-perm" data-perm="microphone" onclick="toggleApkPerm('microphone')"><span>🎤 Mikrofon<span class="apk-perm-sub">Rekam suara / panggilan</span></span><span class="apk-switch"></span></button>
            <button type="button" class="apk-perm" data-perm="location" onclick="toggleApkPerm('location')"><span>📍 Lokasi<span class="apk-perm-sub">Akses lokasi perangkat</span></span><span class="apk-switch"></span></button>
            <button type="button" class="apk-perm" data-perm="storage" onclick="toggleApkPerm('storage')"><span>📁 Penyimpanan / Media<span class="apk-perm-sub">Baca foto, video, dan file</span></span><span class="apk-switch"></span></button>
            <button type="button" class="apk-perm" data-perm="contacts" onclick="toggleApkPerm('contacts')"><span>👤 Kontak<span class="apk-perm-sub">Baca daftar kontak</span></span><span class="apk-switch"></span></button>
            <button type="button" class="apk-perm" data-perm="bluetooth" onclick="toggleApkPerm('bluetooth')"><span>📶 Bluetooth<span class="apk-perm-sub">Hubungkan ke perangkat sekitar</span></span><span class="apk-switch"></span></button>
          </div>
          <div style="display:flex; gap:6px; margin-top:7px; align-items:center;">
            <button type="button" onclick="setAllApkPerms(true)" class="btn btn-ghost btn-xs">Aktifkan Semua</button>
            <button type="button" onclick="setAllApkPerms(false)" class="btn btn-ghost btn-xs">Matikan Semua</button>
            <span id="apk-perm-count" style="font-size:10px; color:var(--text-2); margin-left:auto;">0 dipilih</span>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button id="btn-build-apk" onclick="handleBuildApk()" class="btn btn-apk" style="flex:1;"><span id="apk-btn-text">Build APK</span></button>
          <button onclick="resetApkForm()" class="btn btn-ghost">Reset</button>
        </div>
      </div>
      <div id="apk-loading" class="hide card" style="border-color:rgba(52,211,153,0.3);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
          <div style="width:34px; height:34px; border-radius:9px; background:rgba(52,211,153,0.12); display:flex; align-items:center; justify-content:center;">
            <svg id="apk-spinner" class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          </div>
          <div><div style="font-weight:700; font-size:12px;">Membuild APK...</div><div id="apk-status-text" style="font-size:10.5px; color:var(--text-2);">Menyiapkan</div></div>
        </div>
        <div class="prog"><div id="apk-progress-fill" class="prog-fill" style="background:#10b981;"></div></div>
        <p id="apk-log-text" class="mono" style="font-size:10px; color:var(--text-2); margin-top:8px; text-align:center;">Initializing...</p>
        <p id="apk-elapsed" class="mono" style="font-size:10px; color:var(--text-2); margin-top:2px; text-align:center;">Waktu: 0:00</p>
      </div>
      <div id="apk-result-container" class="hide card" style="border-color:rgba(52,211,153,0.3); display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#10b981,#059669); display:flex; align-items:center; justify-content:center; font-size:18px;">📦</div>
          <div style="min-width:0; flex:1;">
            <div id="apk-result-name" style="font-weight:700; font-size:13px; word-break:break-word;">Aplikasi</div>
            <div id="apk-result-meta" class="mono" style="font-size:10px; color:var(--text-2); word-break:break-all;"></div>
          </div>
          <span class="badge badge-ok">✓ Siap</span>
        </div>
        <div style="display:flex; gap:8px;">
          <button onclick="downloadLastApk()" class="btn btn-apk" style="flex:1;">Download APK</button>
          <button onclick="copyApkLink()" class="btn btn-ghost" style="width:auto;">Salin Link</button>
        </div>
        <button onclick="hideApkResult()" class="btn btn-ghost btn-xs" style="align-self:center;">Build Baru</button>
      </div>
      <div class="card" style="border-color:rgba(52,211,153,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#6ee7b7; letter-spacing:0.06em;">Riwayat Build</div>
          <button onclick="loadApkHistory()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="apk-history-list" style="display:flex; flex-direction:column; gap:7px; max-height:300px; overflow-y:auto;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada build</p>
        </div>
      </div>
    </div>

    <div id="section-vipshop" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0; color:var(--warn);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>Beli VIP</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div style="padding:13px; background:linear-gradient(135deg,var(--warn-soft),var(--accent-soft)); border:1px solid rgba(251,191,36,0.3); border-radius:11px;">
        <div style="font-size:12px; font-weight:800; color:var(--warn); margin-bottom:9px;">✦ Keuntungan VIP</div>
        <div style="display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--text-1);">
          <div>✦ Generate AM premium terus menerus</div>
          <div>✦ Generate Netflix tanpa batas</div>
          <div>✦ Kuota unlimited</div>
          <div>✦ Badge VIP eksklusif</div>
        </div>
      </div>
      <div>
        <div class="section-head" style="color:var(--warn);">Pilih Layanan</div>
        <div id="vip-shop-list" style="display:flex; flex-direction:column; gap:9px;"></div>
      </div>
      <div id="vip-purchase-form" class="hide" style="display:flex; flex-direction:column; gap:12px; padding-top:12px; border-top:1px solid var(--line);">
        <input type="hidden" id="selected-vip-id" value="">
        <input type="hidden" id="selected-vip-price" value="">
        <input type="hidden" id="selected-vip-days" value="">
        <input type="hidden" id="selected-vip-name" value="">
        <div style="padding:11px; background:var(--warn-soft); border:1px solid rgba(251,191,36,0.25); border-radius:9px;">
          <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; color:var(--warn); letter-spacing:0.06em; margin-bottom:3px;">Layanan</div>
          <div id="selected-vip-display" style="font-weight:700; font-size:12.5px;">-</div>
        </div>
        <div style="padding:11px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.25); border-radius:9px;">
          <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; color:var(--info); letter-spacing:0.06em; margin-bottom:3px;">Total</div>
          <div id="selected-vip-price-display" class="mono" style="font-weight:800; font-size:16px; color:var(--info);">Rp 0</div>
        </div>
        <div id="pay-method-chooser" style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--text-2); letter-spacing:0.06em;">Pilih Metode Pembayaran</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button onclick="choosePayMethod('qr')" id="pay-method-btn-qr" class="btn btn-ghost btn-sm">📲 QR (Otomatis)</button>
            <button onclick="choosePayMethod('dana')" id="pay-method-btn-dana" class="btn btn-ghost btn-sm">💳 Nomor DANA</button>
          </div>
        </div>
        <div id="qris-section" class="hide" style="display:flex; flex-direction:column; gap:10px; padding:12px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:11px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--ok); letter-spacing:0.06em;">Bayar dengan QR (Otomatis)</div>
            <span id="qris-status-badge" class="badge badge-warn">Menunggu</span>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700;">Nominal sesuai produk</div>
            <div id="qris-amount-display" class="mono" style="font-size:18px; font-weight:800; color:var(--info);">Rp 0</div>
          </div>
          <a id="qris-checkout-link" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-warn hide" style="text-align:center; text-decoration:none;">🔗 Buka Halaman Pembayaran QR</a>
          <div id="qris-result-text" style="text-align:center; font-size:11px; color:var(--text-1); line-height:1.5;">-</div>
          <div id="qris-expiry-text" style="text-align:center; font-size:10.5px; color:var(--warn);"></div>
          <div style="text-align:center; font-size:9.5px; color:var(--text-2);">Invoice: <span id="qris-invoice-id" class="mono">-</span></div>
          <button onclick="reloadQrisPayment()" id="btn-qris-reload" class="btn btn-ghost btn-xs">↻ Buat Link Baru</button>
        </div>
        <div id="dana-method-wrap" class="hide" style="display:flex; flex-direction:column; gap:12px;">
        <div class="dana-card">
          <div class="dana-chip">DANA</div>
          <div style="font-size:10px; color:#60c4ff; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:3px;">Transfer ke</div>
          <div class="dana-number" id="dana-number-display">-</div>
          <div style="font-size:11px; color:var(--text-1); margin-bottom:9px;" id="dana-owner-display">a.n. -</div>
          <button onclick="copyDanaNumber()" class="dana-copy">📋 Copy Nomor</button>
          <div style="margin-top:12px; text-align:left; background:rgba(0,0,0,0.3); border-radius:8px; padding:10px;">
            <div class="dana-step"><div class="dana-step-num">1</div><span>Buka aplikasi <strong style="color:#60c4ff;">DANA</strong></span></div>
            <div class="dana-step"><div class="dana-step-num">2</div><span>Pilih menu <strong style="color:#60c4ff;">Kirim/Transfer</strong></span></div>
            <div class="dana-step"><div class="dana-step-num">3</div><span>Masukkan nomor & jumlah</span></div>
            <div class="dana-step"><div class="dana-step-num">4</div><span>Konfirmasi & simpan bukti</span></div>
            <div class="dana-step" style="margin-bottom:0;"><div class="dana-step-num">5</div><span>Upload bukti di bawah</span></div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px;">
          <div style="padding:9px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:7px;"><div style="font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700;">ID Top Up</div><div id="topup-id-display" class="mono" style="font-size:11px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">-</div></div>
          <div style="padding:9px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:7px;"><div style="font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700;">Status</div><div id="topup-status-display" style="margin-top:2px;"><span class="badge badge-warn">Menunggu</span></div></div>
        </div>
        <button onclick="handleCreatePayment()" id="btn-create-payment" class="btn btn-info">💳 Buat Pesanan & Bayar</button>
        <div id="payment-proof-section" class="hide" style="display:flex; flex-direction:column; gap:12px; padding-top:12px; border-top:1px solid var(--line);">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--ok); letter-spacing:0.06em;">Upload Bukti</div>
          <div class="dropzone" onclick="document.getElementById('payment-proof-file').click()">
            <input type="file" id="payment-proof-file" accept="image/*" class="hide" onchange="handlePaymentProofSelect(event)">
            <div id="proof-file-info" style="font-size:12px; font-weight:600;">Klik untuk upload</div>
            <div style="font-size:10.5px; color:var(--text-2); margin-top:3px;">JPG, PNG (max 5MB)</div>
          </div>
          <button onclick="handleUploadProof()" id="btn-upload-proof" class="btn btn-ok" disabled>Kirim Bukti</button>
        </div>
        <div id="transaction-status-box" class="hide" style="padding:11px; background:var(--bg-2); border:1px solid var(--line-2); border-radius:9px;">
          <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; color:var(--text-2); letter-spacing:0.06em; margin-bottom:5px;">Status</div>
          <div id="transaction-status-content"></div>
        </div>
        </div>
      </div>
      <div style="padding-top:12px; border-top:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--warn); letter-spacing:0.06em;">Riwayat</div>
          <button onclick="loadUserTransactions()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="user-transactions-list" style="display:flex; flex-direction:column; gap:7px; max-height:220px; overflow-y:auto;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Memuat...</p>
        </div>
      </div>
    </div>

    <div id="section-chat" class="hide card" style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat Global</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button id="chat-poll-btn" onclick="toggleChatPollForm()" class="btn btn-ghost btn-xs hide">📊 Buat Polling</button>
          <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
        </div>
      </div>
      <div id="chat-poll-form" class="poll-form hide">
        <div style="font-size:12px; font-weight:700; color:var(--text-1);">📊 Polling Baru (Admin)</div>
        <input type="text" id="chat-poll-question" class="inp" maxlength="200" placeholder="Pertanyaan polling...">
        <input type="text" class="inp chat-poll-opt" maxlength="100" placeholder="Pilihan 1 (wajib)">
        <input type="text" class="inp chat-poll-opt" maxlength="100" placeholder="Pilihan 2 (wajib)">
        <input type="text" class="inp chat-poll-opt" maxlength="100" placeholder="Pilihan 3 (opsional)">
        <input type="text" class="inp chat-poll-opt" maxlength="100" placeholder="Pilihan 4 (opsional)">
        <input type="text" class="inp chat-poll-opt" maxlength="100" placeholder="Pilihan 5 (opsional)">
        <input type="text" class="inp chat-poll-opt" maxlength="100" placeholder="Pilihan 6 (opsional)">
        <div style="display:flex; gap:8px;">
          <button onclick="submitChatPoll()" class="btn btn-xs">Kirim Polling</button>
          <button onclick="toggleChatPollForm()" class="btn btn-ghost btn-xs">Batal</button>
        </div>
      </div>
      <div class="chat-wrap">
        <div id="chat-messages" class="chat-stream"><p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Memuat...</p></div>
        <div class="chat-input-bar">
          <input type="text" id="chat-input" placeholder="Tulis pesan..." maxlength="500" class="inp" autocomplete="off" onkeydown="if(event.key==='Enter')sendChatMessage()">
          <button onclick="sendChatMessage()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:var(--text-2);">
        <span id="chat-online-count">👥 0 user online</span>
        <button onclick="loadGlobalChat()" class="btn btn-ghost btn-xs">Refresh</button>
      </div>
    </div>

    <div id="section-profile" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0;">Profil Akun</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div class="stat"><div><div class="stat-label">Username</div><div id="profile-uname" class="mono" style="font-size:13px; font-weight:700; margin-top:2px;">-</div></div></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="stat"><div><div class="stat-label">Tipe</div><div id="profile-role" style="font-size:12px; font-weight:700; color:var(--accent); margin-top:2px;">Standard</div></div></div>
          <div class="stat"><div><div class="stat-label">Kuota</div><div id="profile-quota" class="mono" style="font-size:12px; font-weight:700; color:var(--info); margin-top:2px;">0</div></div></div>
        </div>
      </div>
      <div class="divider"></div>
      <div>
        <div class="section-head">Ganti Username</div>
        <div style="display:flex; gap:7px;">
          <input type="text" id="new-username-input" placeholder="username_baru" class="inp" style="flex:1;">
          <button onclick="triggerUpdateUsername()" class="btn btn-sm">Simpan</button>
        </div>
      </div>
      <div>
        <div class="section-head" style="color:var(--err);">Ganti Password</div>
        <div style="display:flex; flex-direction:column; gap:7px;">
          <input type="password" id="old-password-input" placeholder="Password lama" class="inp">
          <input type="password" id="new-password-input" placeholder="Password baru" class="inp">
          <input type="password" id="confirm-password-input" placeholder="Konfirmasi" class="inp">
          <button onclick="handleChangePassword()" class="btn">Ubah Password</button>
        </div>
      </div>
    </div>

    <div id="section-admin" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0; color:var(--warn);">Admin Panel</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div style="padding:11px; background:linear-gradient(135deg,var(--warn-soft),var(--accent-soft)); border:1px solid rgba(251,191,36,0.3); border-radius:9px;">
        <div style="font-size:11.5px; font-weight:800; color:var(--warn);">👑 Master Control Panel</div>
      </div>
      <div>
        <div class="section-head" style="color:var(--warn);">Status Server</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px;">
          <button onclick="changeServerState('online')" class="btn btn-ok btn-sm" style="width:100%;">● Online</button>
          <button onclick="changeServerState('offline')" class="btn btn-err btn-sm" style="width:100%;">● Offline</button>
        </div>
      </div>
      <div>
        <div class="section-head" style="color:var(--warn);">Upload Video</div>
        <div id="file-drop-zone" class="dropzone">
          <input type="file" id="admin-video-file" accept="video/*" class="hide">
          <div style="font-size:12px; font-weight:600;">Klik atau drop video</div>
          <div style="font-size:10.5px; color:var(--text-2); margin-top:3px;">MP4, WebM, MOV • max 200MB</div>
          <div id="file-info" class="mono hide" style="font-size:10px; color:var(--accent); margin-top:6px;"></div>
        </div>
        <div id="upload-progress-container" class="hide" style="margin-top:10px;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-1); margin-bottom:6px;">
            <span id="upload-status-text">Uploading...</span>
            <span id="upload-percent" class="mono" style="color:var(--accent); font-weight:700;">0%</span>
          </div>
          <div class="prog"><div id="upload-progress-fill" class="prog-fill"></div></div>
          <p id="upload-speed" class="mono" style="font-size:10px; color:var(--text-2); margin-top:6px; text-align:center;"></p>
        </div>
        <button onclick="handleUploadVideo()" id="btn-upload-video" class="btn" style="margin-top:10px;" disabled><span id="btn-upload-text">Upload Video</span></button>
      </div>
      <div>
        <div class="section-head" style="color:var(--warn);">Kelola VIP</div>
        <input type="text" id="vip-target-user" placeholder="Username target" class="inp" style="margin-bottom:7px;">
        <div style="display:flex; gap:7px;">
          <input type="number" id="vip-duration-days" placeholder="Hari" class="inp" style="flex:1;">
          <button onclick="handleSetVip()" class="btn btn-sm">Set VIP</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin:9px 0 6px;">
          <div style="font-size:10px; color:var(--warn); font-weight:700; text-transform:uppercase;">VIP Aktif</div>
          <button onclick="loadAdminVipList()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="admin-vip-list" style="display:flex; flex-direction:column; gap:6px; max-height:130px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Memuat...</p>
        </div>
      </div>
      <div style="padding:11px; background:linear-gradient(135deg,var(--accent-soft),var(--info-soft)); border:1px solid rgba(139,124,246,0.3); border-radius:9px;">
        <div class="section-head" style="color:var(--accent); margin-top:0;">Buat Akun VIP</div>
        <div style="display:flex; flex-direction:column; gap:7px;">
          <input type="text" id="vip-create-username" placeholder="Username VIP" class="inp">
          <input type="text" id="vip-create-password" placeholder="Password VIP" class="inp mono">
          <input type="number" id="vip-create-days" placeholder="Hari aktif" class="inp">
          <button onclick="handleCreateVipAccount()" class="btn btn-sm" style="background:var(--accent);">Buat Akun VIP</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin:9px 0 6px;">
          <div style="font-size:10px; color:var(--accent); font-weight:700; text-transform:uppercase;">Akun VIP Dibuat</div>
          <button onclick="loadVipAccounts()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="vip-accounts-list" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Memuat...</p>
        </div>
      </div>
      <div style="padding:11px; background:linear-gradient(135deg,var(--info-soft),var(--accent-soft)); border:1px solid rgba(96,165,250,0.3); border-radius:9px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;">
          <div class="section-head" style="color:var(--info); margin:0;">Semua Orderan</div>
          <button onclick="loadAdminOrders()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:7px;">
          <button onclick="setAdminOrderFilter('all')" data-afilter="all" class="admin-order-filter btn btn-xs" style="background:var(--info); color:white;">Semua</button>
          <button onclick="setAdminOrderFilter('am')" data-afilter="am" class="admin-order-filter btn btn-ghost btn-xs">AM</button>
          <button onclick="setAdminOrderFilter('netflix')" data-afilter="netflix" class="admin-order-filter btn btn-ghost btn-xs">NFLX</button>
          <button onclick="setAdminOrderFilter('hd')" data-afilter="hd" class="admin-order-filter btn btn-ghost btn-xs">HD</button>
          <button onclick="setAdminOrderFilter('apk')" data-afilter="apk" class="admin-order-filter btn btn-ghost btn-xs">APK</button>
        </div>
        <input type="text" id="admin-order-search" oninput="renderAdminOrders()" placeholder="Cari..." class="inp mono" style="margin-bottom:7px;">
        <div id="admin-orders-list" style="display:flex; flex-direction:column; gap:6px; max-height:250px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Klik Refresh...</p>
        </div>
      </div>
      <div style="padding:11px; background:linear-gradient(135deg,var(--warn-soft),var(--accent-soft)); border:1px solid rgba(251,191,36,0.3); border-radius:9px;">
        <div class="section-head" style="color:var(--warn); margin-top:0;">Kelola Layanan VIP</div>
        <input type="hidden" id="vip-shop-edit-id" value="">
        <div style="display:flex; flex-direction:column; gap:7px;">
          <input type="text" id="vip-shop-name" placeholder="Nama layanan" class="inp">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px;">
            <input type="number" id="vip-shop-price" placeholder="Harga (Rp)" class="inp">
            <input type="number" id="vip-shop-days" placeholder="Hari" class="inp">
          </div>
          <div style="display:flex; gap:7px;">
            <button onclick="handleSaveVipShop()" id="vip-shop-submit-btn" class="btn btn-sm" style="flex:1; background:var(--warn); color:#3a2800;">Tambah Layanan</button>
            <button onclick="resetVipShopForm()" id="vip-shop-cancel-btn" class="btn btn-ghost btn-sm hide">Batal</button>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin:9px 0 6px;">
          <div style="font-size:10px; color:var(--warn); font-weight:700; text-transform:uppercase;">Layanan VIP</div>
          <button onclick="loadAdminVipShop()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="admin-vip-shop-list" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Memuat...</p>
        </div>
      </div>
      <div style="padding:11px; background:linear-gradient(135deg,var(--info-soft),var(--accent-soft)); border:1px solid rgba(96,165,250,0.3); border-radius:9px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;">
          <div class="section-head" style="color:var(--info); margin:0;">Konfirmasi Pembayaran</div>
          <button onclick="loadAdminTransactions()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="admin-transactions-list" style="display:flex; flex-direction:column; gap:6px; max-height:250px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Memuat...</p>
        </div>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;">
          <div class="section-head" style="color:var(--warn); margin:0;">Daftar User</div>
          <button onclick="loadAllUsers()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <input type="text" id="user-search-input" oninput="filterUserList()" placeholder="Cari username/email..." class="inp" style="margin-bottom:7px;">
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:7px;">
          <button onclick="setUserFilter('all')" data-filter="all" class="user-filter-btn btn btn-xs" style="background:var(--accent); color:white;">Semua</button>
          <button onclick="setUserFilter('admin')" data-filter="admin" class="user-filter-btn btn btn-ghost btn-xs">Admin</button>
          <button onclick="setUserFilter('vip')" data-filter="vip" class="user-filter-btn btn btn-ghost btn-xs">VIP</button>
          <button onclick="setUserFilter('regular')" data-filter="regular" class="user-filter-btn btn btn-ghost btn-xs">Reguler</button>
          <button onclick="setUserFilter('reset')" data-filter="reset" class="user-filter-btn btn btn-ghost btn-xs">Reset Due</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-bottom:7px; text-align:center;">
          <div style="padding:5px; background:var(--accent-soft); border:1px solid rgba(139,124,246,0.2); border-radius:6px;"><div style="font-size:8px; color:var(--accent); font-weight:700; text-transform:uppercase;">Total</div><div id="stat-total" class="mono" style="font-size:11px; font-weight:800;">-</div></div>
          <div style="padding:5px; background:var(--warn-soft); border:1px solid rgba(251,191,36,0.2); border-radius:6px;"><div style="font-size:8px; color:var(--warn); font-weight:700; text-transform:uppercase;">Admin</div><div id="stat-admins" class="mono" style="font-size:11px; font-weight:800; color:var(--warn);">-</div></div>
          <div style="padding:5px; background:var(--accent-soft); border:1px solid rgba(139,124,246,0.2); border-radius:6px;"><div style="font-size:8px; color:var(--accent); font-weight:700; text-transform:uppercase;">VIP</div><div id="stat-vips" class="mono" style="font-size:11px; font-weight:800; color:var(--accent);">-</div></div>
          <div style="padding:5px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.2); border-radius:6px;"><div style="font-size:8px; color:var(--info); font-weight:700; text-transform:uppercase;">Reset</div><div id="stat-reset" class="mono" style="font-size:11px; font-weight:800; color:var(--info);">-</div></div>
        </div>
        <div id="all-users-list" style="display:flex; flex-direction:column; gap:6px; max-height:250px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Klik Refresh...</p>
        </div>
      </div>
      <div>
        <div class="section-head" style="color:var(--warn);">Generate Redeem</div>
        <input type="text" id="gen-code" placeholder="NAMA-KODE" class="inp mono" style="margin-bottom:7px; text-transform:uppercase; font-weight:700;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-bottom:7px;">
          <input type="number" id="gen-quota-per-user" placeholder="Kuota/user" class="inp" min="1">
          <input type="number" id="gen-max-claims" placeholder="Max klaim" class="inp" min="1">
        </div>
        <button onclick="handleCreateRedeem()" class="btn btn-sm" style="width:100%;">Generate Kode</button>
        <div style="display:flex; justify-content:space-between; align-items:center; margin:9px 0 6px;">
          <div style="font-size:10px; color:var(--warn); font-weight:700; text-transform:uppercase;">Kode Aktif</div>
          <button onclick="loadAdminRedeems()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="admin-redeem-list" style="display:flex; flex-direction:column; gap:6px; max-height:130px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Memuat...</p>
        </div>
      </div>
      <div style="padding-top:12px; border-top:1px solid var(--line);">
        <div class="section-head" style="color:var(--warn);">Pengumuman</div>
        <input type="hidden" id="info-edit-id" value="">
        <input type="text" id="info-title" placeholder="Judul" class="inp" style="margin-bottom:7px;">
        <textarea id="info-content" placeholder="Isi pesan..." class="inp" style="height:80px; resize:none; margin-bottom:7px;"></textarea>
        <div style="display:flex; gap:7px;">
          <button id="info-submit-btn" onclick="handleSaveAnnouncement()" class="btn btn-sm" style="flex:1;">Publikasikan</button>
          <button id="info-cancel-btn" onclick="resetInfoForm()" class="btn btn-ghost btn-sm hide">Batal</button>
        </div>
        <div id="admin-info-list" style="display:flex; flex-direction:column; gap:6px; max-height:130px; overflow-y:auto; font-size:11px; margin-top:9px;"></div>
      </div>
      <div style="padding-top:12px; border-top:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;">
          <div class="section-head" style="color:var(--ok); margin:0;">Request Fitur</div>
          <button onclick="loadAdminFeatureRequests()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="admin-feature-requests-list" style="display:flex; flex-direction:column; gap:7px; max-height:250px; overflow-y:auto; font-size:11px;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Memuat...</p>
        </div>
      </div>
    </div>

    <div id="section-announcement" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0; color:var(--info);">Pengumuman</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div id="user-announcement-container" style="display:flex; flex-direction:column; gap:9px; max-height:400px; overflow-y:auto;">
        <p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Memuat...</p>
      </div>
    </div>

    <div id="section-request" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0; color:var(--ok);">Request Fitur</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <p style="font-size:12px; color:var(--text-1); margin:0;">Punya ide fitur baru? Kirim ke admin!</p>
      <div style="display:flex; flex-direction:column; gap:9px;">
        <input type="text" id="feature-request-title" placeholder="Nama fitur" class="inp">
        <textarea id="feature-request-desc" placeholder="Jelaskan fitur..." class="inp" style="height:100px; resize:none;"></textarea>
        <button onclick="handleSubmitFeatureRequest()" class="btn btn-ok">Kirim Request</button>
      </div>
      <div style="padding-top:12px; border-top:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-size:10px; color:var(--ok); font-weight:700; text-transform:uppercase;">Request Kamu</div>
          <button onclick="loadUserFeatureRequests()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="user-feature-requests-list" style="display:flex; flex-direction:column; gap:7px; max-height:250px; overflow-y:auto;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Memuat...</p>
        </div>
      </div>
    </div>
  </div>

  <div style="text-align:center; font-size:10px; color:var(--text-2); padding:10px 0; letter-spacing:0.08em; text-transform:uppercase; font-weight:600;">AM PREMIUM  • BANGGUS</div>
</div>

<script>
(function () {
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = '';
    try {
      url = typeof input === 'string' ? input : ((input && input.url) || '');
      if (url.indexOf('/api/') === 0) {
        var token = localStorage.getItem('authToken');
        if (token) {
          init = init || {};
          var h = new Headers(init.headers || {});
          if (!h.has('Authorization')) h.set('Authorization', 'Bearer ' + token);
          init.headers = h;
        }
      }
    } catch (e) {}
    var p = _fetch(input, init);
    if (url.indexOf('/api/') === 0) {
      p.then(function (r) {
        if (r.status === 401 && localStorage.getItem('authToken')) {
          r.clone().json().then(function (j) {
            if (j && j.needLogin) {
              localStorage.removeItem('authToken');
              localStorage.removeItem('savedUsername');
              if (typeof showToast === 'function') showToast('Sesi berakhir, silakan login ulang.', 'error', 3000);
              setTimeout(function () { location.reload(); }, 1500);
            }
          }).catch(function () {});
        }
      }).catch(function () {});
    }
    return p;
  };
})();
let DANA_ADMIN_NUMBER = '';
let DANA_ADMIN_NAME = '';
const BASE_QUOTA = 2;

async function loadPaymentInfo() {
  if (DANA_ADMIN_NUMBER) return;
  try {
    const r = await fetch('/api/payment-info');
    const d = await r.json();
    if (d && d.success) { DANA_ADMIN_NUMBER = d.danaNumber || ''; DANA_ADMIN_NAME = d.danaName || ''; }
  } catch (e) {}
}

let currentAuthMode = 'login';
let loggedInUsername = '';
let isAdminUser = false;
let isVipUser = false;
let selectedVideoFile = null;
let currentResultText = '';
let cachedUserList = [];
let currentUserFilter = 'all';
let quotaCountdownInterval = null;
let globalCountdownInterval = null;
let chatRefreshInterval = null;
let unreadChatCount = 0;
let lastChatMessageId = null;
let openReactPickerId = null;
const CHAT_REACT_MAP = { like:'👍', love:'❤️', haha:'😂', wow:'😮', sad:'😢', fire:'🔥' };
let currentView = 'generator';
let userQuotaData = { usedQuota: 0, bonusQuota: 0, totalQuota: BASE_QUOTA, nextResetTime: 0, lastResetTime: 0 };
let claimedRedeemCodes = {};
let selectedPaymentProofFile = null;
let currentTransactionId = null;
let cachedVipShopItems = [];
let selectedNetflixPlan = 'premium';
let netflixResults = [];
let myOrders = [];
let allOrders = [];
let currentAdminOrderFilter = 'all';
let serverOnline = true;
let onlineUsersCount = 0;
let onlineHeartbeatInterval = null;
let onlinePollInterval = null;
let isPageVisible = true;
let statusPollInterval = null;
let videoPollInterval = null;
let lastStatusFetch = 0;
let lastVideoFetch = 0;
let lastChatFetch = 0;
let lastEmailsFetch = 0;
let lastRedeemsFetch = 0;
let lastAnnouncementsFetch = 0;
let lastNetflixHistoryFetch = 0;
let lastMyOrdersFetch = 0;
let lastAdminOrdersFetch = 0;

// ====== NOTIFICATION STATE (BARU) ======
let notificationsEnabled = false;
let swRegistration = null;
let lastNotifAnnouncementId = null;
let lastNotifChatId = null;
let notifPollInterval = null;
let lastNotifStatus = 'online';
let currentNotifTitle = '';

const CACHE_DURATION = { status:30000, video:60000, chat:15000, emails:30000, redeems:60000, announcements:60000, netflixHistory:30000, myOrders:15000, adminOrders:15000, onlineUsers:15000 };
const memoryCache = {};

function getCached(key) {
  const entry = memoryCache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > entry.duration) { delete memoryCache[key]; return null; }
  return entry.data;
}
function setCache(key, data, duration) { memoryCache[key] = { data, time: Date.now(), duration }; }

// ====== NOTIFICATION FUNCTIONS (BARU) ======
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function updateNotifButton() {
  const btn = document.getElementById('notif-btn');
  const txt = document.getElementById('notif-text');
  if (!btn || !txt) return;
  if (!('Notification' in window)) { btn.classList.add('blocked'); txt.textContent = 'N/A'; btn.disabled = true; return; }
  if (Notification.permission === 'granted') {
    btn.classList.add('active'); btn.classList.remove('blocked'); txt.textContent = 'Notif ON';
  } else if (Notification.permission === 'denied') {
    btn.classList.add('blocked'); btn.classList.remove('active'); txt.textContent = 'Blocked';
  } else {
    btn.classList.remove('active'); btn.classList.remove('blocked'); txt.textContent = 'Notif';
  }
}

async function toggleNotifications() {
  if (!('Notification' in window)) return showToast('Browser tidak mendukung notifikasi.', 'error');
  if (Notification.permission === 'denied') return showToast('Notifikasi diblokir. Izinkan lewat setelan browser.', 'error', 5000);
  if (Notification.permission === 'granted') {
    // Toggle off (hanya state lokal, permission tetap granted)
    notificationsEnabled = !notificationsEnabled;
    localStorage.setItem('notifEnabled', notificationsEnabled ? '1' : '0');
    if (notificationsEnabled) { showToast('Notifikasi diaktifkan kembali.', 'success'); startNotifPolling(); }
    else { showToast('Notifikasi dinonaktifkan sementara.', 'info'); stopNotifPolling(); }
    updateNotifButton();
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      notificationsEnabled = true;
      localStorage.setItem('notifEnabled', '1');
      await registerServiceWorker();
      await registerNotificationToServer();
      startNotifPolling();
      showToast('🔔 Notifikasi browser aktif!', 'success');
      // Notifikasi perkenalan
      showBrowserNotification('🔔 Notifikasi Aktif', 'Kamu akan menerima pemberitahuan pengumuman, chat, dan update server.');
    } else {
      showToast('Izin notifikasi ditolak.', 'error');
    }
  } catch (e) { showToast('Gagal mengaktifkan notifikasi.', 'error'); }
  updateNotifButton();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (swRegistration) return swRegistration;
  try {
    // Service Worker via Blob (tanpa file terpisah)
    const swCode = \`
      self.addEventListener('notificationclick', function(event) {
        event.notification.close();
        event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
              var client = clientList[i];
              if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
          })
        );
      });
      self.addEventListener('push', function(event) {
        var data = { title: 'AM PREMIUM', body: 'Notifikasi baru' };
        try { if (event.data) data = event.data.json(); } catch(e) {}
        event.waitUntil(self.registration.showNotification(data.title, {
          body: data.body, icon: data.icon || '', badge: data.badge || '',
          tag: data.tag || 'am-premium', data: data.url || '/', vibrate: [100,50,100]
        }));
      });
    \`;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    swRegistration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    return swRegistration;
  } catch (e) { console.warn('SW register failed:', e); return null; }
}

async function registerNotificationToServer() {
  if (!loggedInUsername || !notificationsEnabled) return;
  try {
    await fetch('/api/notifications/register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: loggedInUsername, enableAnnouncements: true, enableChat: true, enableStatus: true })
    });
  } catch(e) {}
}

async function showBrowserNotification(title, body, options = {}) {
  if (!notificationsEnabled || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && !options.force) return; // jangan ganggu saat tab aktif
  try {
    const reg = swRegistration || await registerServiceWorker();
    const notifOptions = {
      body: body, icon: '', badge: '', tag: options.tag || 'am-premium',
      data: { url: options.url || '/' }, vibrate: [100, 50, 100],
      requireInteraction: !!options.requireInteraction
    };
    if (reg) await reg.showNotification(title, notifOptions);
    else new Notification(title, notifOptions);
    currentNotifTitle = title;
  } catch(e) { try { new Notification(title, { body: body }); } catch(_) {} }
}

async function startNotifPolling() {
  if (notifPollInterval) clearInterval(notifPollInterval);
  if (!notificationsEnabled) return;
  await checkNotifUpdates();
  notifPollInterval = setInterval(() => { if (isPageVisible !== undefined) checkNotifUpdates(); }, 25000);
}
function stopNotifPolling() { if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; } }

async function checkNotifUpdates() {
  if (!notificationsEnabled || Notification.permission !== 'granted') return;
  try {
    // 1) Cek pengumuman baru
    const annRes = await fetch('/api/announcements');
    const annData = await annRes.json();
    if (annData.success && annData.announcements) {
      const entries = Object.entries(annData.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
      if (entries.length > 0) {
        const latest = entries[0];
        const latestId = latest[0];
        if (lastNotifAnnouncementId && latestId !== lastNotifAnnouncementId) {
          showBrowserNotification('📢 Pengumuman Baru: ' + latest[1].title, latest[1].content.substring(0, 180), { tag: 'ann-' + latestId, requireInteraction: true });
        }
        lastNotifAnnouncementId = latestId;
      }
    }
    // 2) Cek chat global baru (dari user lain)
    if (loggedInUsername) {
      const chatRes = await fetch('/api/chat/messages');
      const chatData = await chatRes.json();
      if (chatData.success && chatData.messages) {
        const entries = Object.entries(chatData.messages).sort((a,b) => a[1].timestamp - b[1].timestamp);
        if (entries.length > 0) {
          const latest = entries[entries.length - 1];
          const latestId = latest[0];
          if (lastNotifChatId && latestId !== lastNotifChatId && latest[1].username !== loggedInUsername) {
            showBrowserNotification('💬 ' + latest[1].username, latest[1].message.substring(0, 160), { tag: 'chat-' + latestId });
            unreadChatCount++; updateChatBadge();
          }
          lastNotifChatId = latestId;
        }
      }
    }
    // 3) Cek perubahan status server
    const stRes = await fetch('/api/status');
    const stData = await stRes.json();
    if (stData.status !== lastNotifStatus) {
      if (lastNotifStatus === 'online' && stData.status === 'offline') showBrowserNotification('⚠️ Server Offline', 'Server sedang offline. Generator dinonaktifkan.', { tag: 'status', force: true });
      else if (lastNotifStatus === 'offline' && stData.status === 'online') showBrowserNotification('✅ Server Online', 'Server sudah online kembali!', { tag: 'status', force: true });
      lastNotifStatus = stData.status;
    }
  } catch(e) {}
}

// ====== END NOTIFICATION FUNCTIONS ======

document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
  if (isPageVisible) {
    if (loggedInUsername) sendOnlineHeartbeat();
    if (currentView === 'generator') fetchServerStatus(true);
    if (currentView === 'chat') loadGlobalChat(true);
    if (currentView === 'vipshop') loadUserTransactions();
    if (currentView === 'netflix') loadNetflixHistory(true);
    if (currentView === 'orders') loadMyOrders(true);
  }
});

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + message + '</span>';
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, duration);
}

async function sendOnlineHeartbeat() {
  if (!loggedInUsername) return;
  try {
    const res = await fetch('/api/online/heartbeat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername }) });
    const data = await res.json();
    if (data.success) updateOnlineCount(data.count);
  } catch(e) {}
}

async function fetchOnlineCount() {
  try {
    const res = await fetch('/api/online/count');
    const data = await res.json();
    if (data.success) updateOnlineCount(data.count);
  } catch(e) {}
}

function updateOnlineCount(count) {
  onlineUsersCount = count;
  const topPill = document.getElementById('online-pill-top');
  const topCount = document.getElementById('online-count-top');
  if (topPill && topCount) {
    topCount.textContent = count;
    if (count > 0) topPill.classList.remove('hide');
    else topPill.classList.add('hide');
  }
  const chatCount = document.getElementById('chat-online-count');
  if (chatCount) chatCount.textContent = '👥 ' + count + ' user online';
}

function startOnlineTracking() {
  if (onlineHeartbeatInterval) clearInterval(onlineHeartbeatInterval);
  if (onlinePollInterval) clearInterval(onlinePollInterval);
  sendOnlineHeartbeat();
  onlineHeartbeatInterval = setInterval(() => { if (isPageVisible && loggedInUsername) sendOnlineHeartbeat(); }, 20000);
  onlinePollInterval = setInterval(() => { if (isPageVisible) fetchOnlineCount(); }, CACHE_DURATION.onlineUsers);
}

function stopOnlineTracking() {
  if (onlineHeartbeatInterval) { clearInterval(onlineHeartbeatInterval); onlineHeartbeatInterval = null; }
  if (onlinePollInterval) { clearInterval(onlinePollInterval); onlinePollInterval = null; }
}

async function markOffline() {
  if (!loggedInUsername) return;
  try { await fetch('/api/online/offline', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername }) }); } catch(e) {}
}

window.addEventListener('beforeunload', () => {
  if (loggedInUsername) navigator.sendBeacon('/api/online/offline', JSON.stringify({ username: loggedInUsername, token: localStorage.getItem('authToken') }));
});

function toggleMenu() {
  const drawer = document.getElementById('nav-drawer');
  const overlay = document.getElementById('drawer-overlay');
  drawer.classList.toggle('open');
  overlay.classList.toggle('hide');
}

function switchView(viewName) {
  currentView = viewName;
  document.body.classList.toggle('chat-wide', viewName === 'chat');
  document.querySelectorAll('[data-nav]').forEach(el => { el.classList.toggle('active', el.dataset.nav === viewName); });
  toggleMenu();
  ['terminal-view','section-profile','section-announcement','section-chat','section-admin','section-request','section-vipshop','section-netflix','section-hdfoto','section-apk','section-orders'].forEach(id => { document.getElementById(id).classList.add('hide'); });
  if (viewName === 'generator') document.getElementById('terminal-view').classList.remove('hide');
  else if (viewName === 'orders') { document.getElementById('section-orders').classList.remove('hide'); loadMyOrders(); }
  else if (viewName === 'netflix') { document.getElementById('section-netflix').classList.remove('hide'); loadNetflixHistory(); updateNetflixQuotaDisplay(); }
  else if (viewName === 'hdfoto') { document.getElementById('section-hdfoto').classList.remove('hide'); updateHdQuotaDisplay(); }
  else if (viewName === 'apk') { document.getElementById('section-apk').classList.remove('hide'); updateApkQuotaDisplay(); loadApkHistory(); }
  else if (viewName === 'vipshop') {
    document.getElementById('section-vipshop').classList.remove('hide');
    loadVipShopItems(); loadUserTransactions();
    loadPaymentInfo().then(function () {
      document.getElementById('dana-number-display').innerText = DANA_ADMIN_NUMBER;
      document.getElementById('dana-owner-display').innerText = 'a.n. ' + DANA_ADMIN_NAME;
    });
  }
  else if (viewName === 'profile') { document.getElementById('section-profile').classList.remove('hide'); loadVerifiedEmails(); }
  else if (viewName === 'announcement') { document.getElementById('section-announcement').classList.remove('hide'); loadUserAnnouncements(); }
  else if (viewName === 'request') { document.getElementById('section-request').classList.remove('hide'); loadUserFeatureRequests(); }
  else if (viewName === 'chat') { document.getElementById('section-chat').classList.remove('hide'); loadGlobalChat(true); unreadChatCount = 0; updateChatBadge(); }
  else if (viewName === 'admin') {
    if (!isAdminUser) return showToast('Akses ditolak!', 'error');
    document.getElementById('section-admin').classList.remove('hide');
    loadAdminRedeems(); loadAdminAnnouncements(); loadAdminVipList(); loadAllUsers(); loadVipAccounts(); loadAdminFeatureRequests(); loadAdminVipShop(); loadAdminTransactions(); loadAdminOrders();
  }
}

function copyDanaNumber() {
  navigator.clipboard.writeText(DANA_ADMIN_NUMBER).then(() => showToast('Nomor tersalin!', 'success')).catch(() => showToast('Gagal', 'error'));
}

function guardServerOnline(featureName) {
  if (serverOnline || isAdminUser) return true;
  showToast('Server offline — ' + featureName + ' tidak tersedia.', 'error', 4000);
  return false;
}

async function loadMyOrders(force = false) {
  if (!loggedInUsername) return;
  const now = Date.now();
  if (!force && now - lastMyOrdersFetch < CACHE_DURATION.myOrders) {
    const cached = getCached('myOrders');
    if (cached) { myOrders = cached; renderMyOrders(); return; }
  }
  const container = document.getElementById('my-orders-list');
  if (container) container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px;">Memuat...</p>';
  try {
    const res = await fetch('/api/orders/my?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.orders) { myOrders = data.orders; lastMyOrdersFetch = now; setCache('myOrders', myOrders, CACHE_DURATION.myOrders); renderMyOrders(); }
    else if (container) container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada orderan</p>';
  } catch(e) {
    if (container) container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:12px;">Gagal</p>';
  }
}

function renderMyOrders() {
  const container = document.getElementById('my-orders-list');
  if (!container) return;
  const search = (document.getElementById('order-search-input')?.value || '').toLowerCase().trim();
  let filtered = myOrders;
  if (search) filtered = myOrders.filter(o => (o.orderId||'').toLowerCase().includes(search) || (o.type||'').toLowerCase().includes(search) || (o.detail||'').toLowerCase().includes(search));
  document.getElementById('my-orders-total').innerText = myOrders.length;
  document.getElementById('my-orders-am').innerText = myOrders.filter(o => o.type === 'am').length;
  if (filtered.length === 0) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">' + (search ? 'Tidak cocok' : 'Belum ada') + '</p>'; return; }
  container.innerHTML = filtered.map(o => {
    const typeIcon = o.type === 'am' ? '🎨' : o.type === 'netflix' ? '🎬' : o.type === 'hd' ? '🖼️' : o.type === 'apk' ? '📦' : '📱';
    const typeLabel = o.type === 'am' ? 'Alight Motion' : o.type === 'netflix' ? 'Netflix' : o.type === 'hd' ? 'HD Foto' : o.type === 'apk' ? 'APK Build' : 'Unknown';
    const typeBadge = o.type === 'am' ? 'badge-accent' : o.type === 'netflix' ? 'badge-err' : o.type === 'hd' ? 'badge-ok' : o.type === 'apk' ? 'badge-warn' : 'badge-muted';
    const timeStr = new Date(o.timestamp).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return '<div class="hist-item">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">' +
        '<div class="hist-item-order-id">' + escapeHtml(o.orderId) + '</div>' +
        '<span class="badge ' + typeBadge + '">' + typeIcon + ' ' + typeLabel + '</span>' +
      '</div>' +
      '<div style="padding:8px 10px; background:var(--bg-0); border-radius:7px; margin-bottom:7px;"><div style="font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700; margin-bottom:2px;">Detail</div><div class="mono" style="font-size:11px; word-break:break-all;">' + escapeHtml(o.detail || '-') + '</div></div>' +
      (o.result ? '<div style="padding:8px 10px; background:var(--info-soft); border-radius:7px; margin-bottom:7px;"><div style="font-size:9px; color:var(--info); text-transform:uppercase; font-weight:700; margin-bottom:2px;">Hasil</div><div class="mono" style="font-size:10px; word-break:break-all;">' + escapeHtml(o.result.substring(0, 200)) + (o.result.length > 200 ? '...' : '') + '</div></div>' : '') +
      '<div style="display:flex; justify-content:space-between; align-items:center; font-size:9px; color:var(--text-2); padding-top:6px; border-top:1px solid var(--line);"><span>🕐 ' + timeStr + '</span><span class="badge badge-ok" style="font-size:9px;">✓ Sukses</span></div>' +
    '</div>';
  }).join('');
}

async function loadAdminOrders(force = false) {
  if (!isAdminUser) return;
  const now = Date.now();
  if (!force && now - lastAdminOrdersFetch < CACHE_DURATION.adminOrders) {
    const cached = getCached('adminOrders');
    if (cached) { allOrders = cached; renderAdminOrders(); return; }
  }
  const container = document.getElementById('admin-orders-list');
  if (container) container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Memuat...</p>';
  try {
    const res = await fetch('/api/admin/orders?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.orders) { allOrders = data.orders; lastAdminOrdersFetch = now; setCache('adminOrders', allOrders, CACHE_DURATION.adminOrders); renderAdminOrders(); }
    else if (container) container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Belum ada</p>';
  } catch(e) {
    if (container) container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>';
  }
}

function setAdminOrderFilter(filter) {
  currentAdminOrderFilter = filter;
  document.querySelectorAll('.admin-order-filter').forEach(btn => {
    const isActive = btn.dataset.afilter === filter;
    btn.style.background = isActive ? 'var(--info)' : '';
    btn.style.color = isActive ? 'white' : '';
  });
  renderAdminOrders();
}

function renderAdminOrders() {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  const search = (document.getElementById('admin-order-search')?.value || '').toLowerCase().trim();
  let filtered = allOrders;
  if (currentAdminOrderFilter !== 'all') filtered = filtered.filter(o => o.type === currentAdminOrderFilter);
  if (search) filtered = filtered.filter(o => (o.orderId||'').toLowerCase().includes(search) || (o.username||'').toLowerCase().includes(search) || (o.detail||'').toLowerCase().includes(search));
  if (filtered.length === 0) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Tidak ada</p>'; return; }
  container.innerHTML = filtered.slice(0, 100).map(o => {
    const typeIcon = o.type === 'am' ? '🎨' : o.type === 'netflix' ? '🎬' : o.type === 'hd' ? '🖼️' : o.type === 'apk' ? '📦' : '📱';
    const timeStr = new Date(o.timestamp).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    return '<div style="padding:8px 10px; background:var(--bg-0); border:1px solid var(--line-2); border-radius:7px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">' +
        '<div style="flex:1; min-width:0;"><div class="mono" style="font-size:10px; font-weight:700; color:var(--info);">' + escapeHtml(o.orderId) + '</div><div style="font-size:9px; color:var(--text-2);">oleh <strong style="color:var(--text-0);">' + escapeHtml(o.username) + '</strong></div></div>' +
        '<span style="font-size:10px;">' + typeIcon + '</span>' +
      '</div>' +
      '<div class="mono" style="font-size:10px; color:var(--text-1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(o.detail || '-') + '</div>' +
      '<div style="font-size:8.5px; color:var(--text-2); margin-top:3px;">' + timeStr + '</div>' +
    '</div>';
  }).join('');
}

// ====== HD FOTO ======
let hdSelectedDataUrl = '';
let hdSelectedFileName = '';
let hdResultDataUrl = '';
let hdResultMime = 'image/png';
let hdProgressTimer = null;
const HD_MAX_FILE_BYTES = 8 * 1024 * 1024;
const HD_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function updateHdQuotaDisplay() {
  const el = document.getElementById('hd-quota-display');
  if (el) {
    if (isAdminUser || isVipUser) { el.innerText = '∞'; el.style.color = '#67e8f9'; }
    else { const remain = Math.max(0, userQuotaData.totalQuota - userQuotaData.usedQuota); el.innerText = remain; el.style.color = remain > 0 ? 'white' : 'var(--err)'; }
  }
  const resetEl = document.getElementById('hd-reset-display');
  if (resetEl) resetEl.innerText = (isAdminUser || isVipUser) ? '∞' : '24 Jam';
}

function updateHdSlider(val) {
  const v = Math.max(0, Math.min(100, parseFloat(val) || 0));
  const layer = document.getElementById('hd-before-layer');
  const line = document.getElementById('hd-slider-line');
  if (layer) layer.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)';
  if (line) line.style.left = v + '%';
}

function updateHdDims() {
  const b = document.getElementById('hd-before-img');
  const a = document.getElementById('hd-after-img');
  const info = document.getElementById('hd-dims-info');
  if (!b || !a || !info) return;
  if (b.naturalWidth && a.naturalWidth) info.innerText = b.naturalWidth + 'x' + b.naturalHeight + ' → ' + a.naturalWidth + 'x' + a.naturalHeight;
}

function processHdFile(file) {
  if (!file) return;
  if (HD_ALLOWED_TYPES.indexOf(file.type) === -1) { showToast('Format harus JPG, PNG, atau WEBP', 'error'); return; }
  if (file.size > HD_MAX_FILE_BYTES) { showToast('Ukuran foto maksimal 8MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = function() {
    hdSelectedDataUrl = String(reader.result || '');
    hdSelectedFileName = file.name || 'foto';
    hdResultDataUrl = '';
    document.getElementById('hd-preview-img').src = hdSelectedDataUrl;
    document.getElementById('hd-preview-wrap').classList.remove('hide');
    document.getElementById('hd-dropzone-empty').classList.add('hide');
    document.getElementById('hd-file-info').innerText = hdSelectedFileName + ' • ' + Math.round(file.size / 1024) + ' KB';
    document.getElementById('hd-result-container').classList.add('hide');
    document.getElementById('btn-generate-hd').disabled = false;
  };
  reader.onerror = function() { showToast('Gagal membaca foto', 'error'); };
  reader.readAsDataURL(file);
}

function handleHdFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  processHdFile(file);
  e.target.value = '';
}

function handleHdDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  processHdFile(file);
}

function clearHdPhoto() {
  hdSelectedDataUrl = ''; hdSelectedFileName = ''; hdResultDataUrl = '';
  const prev = document.getElementById('hd-preview-img'); if (prev) prev.removeAttribute('src');
  document.getElementById('hd-preview-wrap').classList.add('hide');
  document.getElementById('hd-dropzone-empty').classList.remove('hide');
  document.getElementById('hd-file-info').innerText = '';
  document.getElementById('hd-result-container').classList.add('hide');
  document.getElementById('hd-loading').classList.add('hide');
  document.getElementById('btn-generate-hd').disabled = true;
}

function downloadHdResult() {
  if (!hdResultDataUrl) { showToast('Belum ada hasil', 'error'); return; }
  const ext = hdResultMime.indexOf('jpeg') !== -1 ? 'jpg' : (hdResultMime.indexOf('webp') !== -1 ? 'webp' : 'png');
  const a = document.createElement('a');
  a.href = hdResultDataUrl;
  a.download = 'hd-foto-' + Date.now() + '.' + ext;
  document.body.appendChild(a); a.click(); a.remove();
}

async function handleGenerateHd() {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  if (!guardServerOnline('HD Foto')) return;
  if (!hdSelectedDataUrl) return showToast('Upload foto dulu!', 'error');
  const btn = document.getElementById('btn-generate-hd');
  const btnText = document.getElementById('hd-btn-text');
  const loadingEl = document.getElementById('hd-loading');
  const statusText = document.getElementById('hd-status-text');
  const logText = document.getElementById('hd-log-text');
  const progressFill = document.getElementById('hd-progress-fill');
  btn.disabled = true; btnText.innerText = 'Memproses...';
  loadingEl.classList.remove('hide'); progressFill.style.width = '5%';
  statusText.innerText = 'Menyiapkan'; logText.innerText = 'Initializing...';
  document.getElementById('hd-result-container').classList.add('hide');
  let pct = 10;
  if (hdProgressTimer) clearInterval(hdProgressTimer);
  hdProgressTimer = setInterval(function() { pct = Math.min(90, pct + 3); progressFill.style.width = pct + '%'; }, 1200);
  try {
    const quotaRes = await fetch('/api/hd/check-quota?username=' + encodeURIComponent(loggedInUsername));
    const quotaData = await quotaRes.json();
    if (!quotaData.success) throw new Error(quotaData.message || 'Gagal cek');
    if (!quotaData.allowed) throw new Error(quotaData.message || 'Quota habis!');
    statusText.innerText = 'Meng-HD-kan foto...'; logText.innerText = 'Uploading & upscaling...';
    const genRes = await fetch('/api/hd/upscale', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, image: hdSelectedDataUrl, fileName: hdSelectedFileName }) });
    const genData = await genRes.json();
    if (genData.success && genData.after) {
      progressFill.style.width = '100%'; statusText.innerText = '✅ Berhasil!'; logText.innerText = 'Success';
      hdResultDataUrl = genData.after;
      hdResultMime = genData.contentType || 'image/png';
      const beforeImg = document.getElementById('hd-before-img');
      const afterImg = document.getElementById('hd-after-img');
      beforeImg.onload = updateHdDims; afterImg.onload = updateHdDims;
      beforeImg.src = hdSelectedDataUrl; afterImg.src = hdResultDataUrl;
      document.getElementById('hd-range').value = 50; updateHdSlider(50);
      document.getElementById('hd-result-container').classList.remove('hide');
      if (genData.quotaInfo) { userQuotaData.usedQuota = genData.quotaInfo.usedQuota || userQuotaData.usedQuota; updateQuotaDisplay(genData.quotaInfo); updateHdQuotaDisplay(); }
      if (genData.orderId) showToast('✅ Order ID: ' + genData.orderId, 'order', 5000);
      else showToast('Foto HD berhasil!', 'success');
      setTimeout(() => loadingEl.classList.add('hide'), 1500);
    } else {
      if (genData.refilled) showToast(genData.message || 'Gagal! Kuota dikembalikan.', 'error', 4000);
      else showToast(genData.message || 'Gagal', 'error');
      if (genData.quotaInfo) { updateQuotaDisplay(genData.quotaInfo); updateHdQuotaDisplay(); }
      else loadVerifiedEmails(true);
      throw new Error(genData.message || 'Gagal');
    }
  } catch (err) {
    statusText.innerText = '❌ Gagal'; logText.innerText = err.message;
    if (!err.message.includes('dikembalikan')) showToast(err.message, 'error');
    setTimeout(() => loadingEl.classList.add('hide'), 3000);
  } finally {
    if (hdProgressTimer) { clearInterval(hdProgressTimer); hdProgressTimer = null; }
    btn.disabled = !hdSelectedDataUrl; btnText.innerText = 'Generate HD';
  }
}

// ====== APK BUILDER ======
let apkPollTimer = null;
let apkElapsedTimer = null;
let apkActiveBuildId = '';
let apkActiveUser = '';
let apkBuildStartedAt = 0;
let apkPollErrors = 0;
let apkServerProgress = null;
let apkLastResult = null;
let apkHistory = [];
const APK_STATUS_LABEL = { queued: 'Mengantri', pending: 'Mengantri', waiting: 'Mengantri', building: 'Sedang build', processing: 'Memproses', compiling: 'Compile', signing: 'Menandatangani', ready: 'Selesai', failed: 'Gagal' };

function apkStatusLabel(s) {
  s = String(s || '').toLowerCase();
  return APK_STATUS_LABEL[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Memproses');
}

function updateApkQuotaDisplay() {
  const el = document.getElementById('apk-quota-display');
  if (el) {
    if (isAdminUser || isVipUser) { el.innerText = '∞'; el.style.color = '#6ee7b7'; }
    else { const remain = Math.max(0, userQuotaData.totalQuota - userQuotaData.usedQuota); el.innerText = remain; el.style.color = remain > 0 ? 'white' : 'var(--err)'; }
  }
}

function applyApkQuotaInfo(q) {
  if (!q) return;
  userQuotaData.usedQuota = q.usedQuota || 0;
  if (q.totalQuota) userQuotaData.totalQuota = q.totalQuota;
  updateQuotaDisplay(q);
  updateApkQuotaDisplay();
  if (typeof updateHdQuotaDisplay === 'function') updateHdQuotaDisplay();
}

function setApkBusy(busy) {
  const btn = document.getElementById('btn-build-apk');
  const txt = document.getElementById('apk-btn-text');
  const st = document.getElementById('apk-state-display');
  if (btn) btn.disabled = !!busy;
  if (txt) txt.innerText = busy ? 'Membuild...' : 'Build APK';
  if (st) { st.innerText = busy ? 'Build...' : 'Siap'; st.style.color = busy ? '#6ee7b7' : 'white'; }
}

function fmtApkElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function apkTick() {
  const sec = Math.max(0, Math.floor((Date.now() - apkBuildStartedAt) / 1000));
  let pct;
  if (typeof apkServerProgress === 'number' && apkServerProgress >= 0 && apkServerProgress <= 100) pct = Math.max(5, Math.min(95, apkServerProgress));
  else pct = Math.min(92, 5 + sec * 0.8);
  const fill = document.getElementById('apk-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const t = document.getElementById('apk-elapsed');
  if (t) t.innerText = 'Waktu: ' + fmtApkElapsed(sec);
}

function showApkLoading(statusText, logText) {
  document.getElementById('apk-loading').classList.remove('hide');
  document.getElementById('apk-status-text').innerText = statusText || 'Menyiapkan';
  document.getElementById('apk-log-text').innerText = logText || 'Initializing...';
  const sp = document.getElementById('apk-spinner');
  if (sp) sp.style.display = '';
}

function stopApkPolling() {
  if (apkPollTimer) { clearTimeout(apkPollTimer); apkPollTimer = null; }
  if (apkElapsedTimer) { clearInterval(apkElapsedTimer); apkElapsedTimer = null; }
  apkActiveBuildId = '';
  apkActiveUser = '';
  apkPollErrors = 0;
  apkServerProgress = null;
}

function startApkPolling(buildId, startedAt) {
  stopApkPolling();
  apkActiveBuildId = String(buildId);
  apkActiveUser = loggedInUsername;
  apkBuildStartedAt = startedAt || Date.now();
  apkPollErrors = 0;
  apkServerProgress = null;
  setApkBusy(true);
  showApkLoading('Antrian build', 'Build ID: ' + buildId);
  document.getElementById('apk-result-container').classList.add('hide');
  apkTick();
  apkElapsedTimer = setInterval(apkTick, 1000);
  apkPollTimer = setTimeout(apkPollOnce, 1500);
}

function finishApkLoading(statusText, logText, hideAfter) {
  document.getElementById('apk-status-text').innerText = statusText;
  document.getElementById('apk-log-text').innerText = logText || '';
  const sp = document.getElementById('apk-spinner');
  if (sp) sp.style.display = 'none';
  setTimeout(function () {
    if (!apkActiveBuildId) document.getElementById('apk-loading').classList.add('hide');
  }, hideAfter || 3000);
}

async function apkPollOnce() {
  const myId = apkActiveBuildId;
  if (!myId) return;
  if (!loggedInUsername || loggedInUsername !== apkActiveUser) { stopApkPolling(); setApkBusy(false); document.getElementById('apk-loading').classList.add('hide'); return; }
  try {
    const res = await fetch('/api/apk/status?username=' + encodeURIComponent(loggedInUsername) + '&build_id=' + encodeURIComponent(myId));
    const data = await res.json();
    if (myId !== apkActiveBuildId) return;
    if (!data.success) {
      if (data.notFound) { onApkFailed({ message: 'Build tidak ditemukan' }); return; }
      throw new Error(data.message || 'Gagal cek status');
    }
    apkPollErrors = 0;
    apkServerProgress = (typeof data.progress === 'number') ? data.progress : null;
    if (data.status === 'ready') { onApkReady(data); return; }
    if (data.status === 'failed') { onApkFailed(data); return; }
    document.getElementById('apk-status-text').innerText = apkStatusLabel(data.remoteStatus || data.status);
    document.getElementById('apk-log-text').innerText = 'Status: ' + (data.remoteStatus || data.status || '-');
  } catch (err) {
    if (myId !== apkActiveBuildId) return;
    apkPollErrors++;
    if (apkPollErrors >= 10) {
      stopApkPolling(); setApkBusy(false);
      finishApkLoading('⚠️ Koneksi terputus', 'Cek hasilnya di Riwayat Build', 6000);
      showToast('Koneksi terputus. Cek Riwayat Build nanti.', 'error', 4000);
      return;
    }
  }
  if (myId === apkActiveBuildId) apkPollTimer = setTimeout(apkPollOnce, 2000);
}

function onApkReady(data) {
  stopApkPolling();
  setApkBusy(false);
  document.getElementById('apk-progress-fill').style.width = '100%';
  finishApkLoading('✅ Build selesai!', 'Success', 2500);
  const b = data.build || {};
  apkLastResult = b;
  document.getElementById('apk-result-name').innerText = b.appName || 'Aplikasi';
  document.getElementById('apk-result-meta').innerText = (b.packageName || '') + ' • v' + (b.versionName || '') + ' (' + (b.versionCode || '') + ')';
  document.getElementById('apk-result-container').classList.remove('hide');
  applyApkQuotaInfo(data.quotaInfo);
  if (data.orderId) showToast('✅ Order ID: ' + escapeHtml(data.orderId), 'order', 5000);
  else showToast('APK berhasil dibuild!', 'success');
  loadApkHistory();
}

function onApkFailed(data) {
  stopApkPolling();
  setApkBusy(false);
  const msg = (data && data.message) ? data.message : 'Build gagal';
  finishApkLoading('❌ Build gagal', msg, 5000);
  if (data && data.refilled) showToast('Build gagal! Kuota dikembalikan.', 'error', 4000);
  else showToast(escapeHtml(msg), 'error', 4000);
  applyApkQuotaInfo(data && data.quotaInfo);
  loadApkHistory();
}

let apkIconDataUrl = '';
let apkSelectedPerms = [];
const APK_ICON_SIZE = 512;
const APK_ICON_MAX_FILE = 5 * 1024 * 1024;

function renderApkPerms() {
  document.querySelectorAll('#apk-perm-list .apk-perm').forEach(function (btn) {
    const on = apkSelectedPerms.indexOf(btn.getAttribute('data-perm')) !== -1;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const c = document.getElementById('apk-perm-count');
  if (c) c.innerText = apkSelectedPerms.length + ' dipilih';
}

function toggleApkPerm(key) {
  const i = apkSelectedPerms.indexOf(key);
  if (i === -1) apkSelectedPerms.push(key); else apkSelectedPerms.splice(i, 1);
  renderApkPerms();
}

function setAllApkPerms(on) {
  apkSelectedPerms = on ? Array.prototype.map.call(document.querySelectorAll('#apk-perm-list .apk-perm'), function (b) { return b.getAttribute('data-perm'); }) : [];
  renderApkPerms();
}

function clearApkIcon() {
  apkIconDataUrl = '';
  const img = document.getElementById('apk-icon-preview');
  if (img) { img.src = ''; img.classList.add('hide'); }
  const ph = document.getElementById('apk-icon-placeholder');
  if (ph) ph.classList.remove('hide');
  const rm = document.getElementById('apk-icon-remove');
  if (rm) rm.classList.add('hide');
  const info = document.getElementById('apk-icon-info');
  if (info) info.innerText = 'PNG/JPG/WEBP, otomatis dipotong persegi 512x512';
}

function handleApkIconSelect(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (['image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) === -1) return showToast('Logo harus PNG, JPG, atau WEBP', 'error');
  if (file.size > APK_ICON_MAX_FILE) return showToast('Ukuran logo maksimal 5MB', 'error');
  const reader = new FileReader();
  reader.onerror = function () { showToast('Gagal membaca foto', 'error'); };
  reader.onload = function () {
    const img = new Image();
    img.onerror = function () { showToast('File bukan gambar yang valid', 'error'); };
    img.onload = function () {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) return showToast('Gambar tidak valid', 'error');
        const sx = Math.floor((img.naturalWidth - side) / 2);
        const sy = Math.floor((img.naturalHeight - side) / 2);
        const canvas = document.createElement('canvas');
        canvas.width = APK_ICON_SIZE; canvas.height = APK_ICON_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, side, side, 0, 0, APK_ICON_SIZE, APK_ICON_SIZE);
        apkIconDataUrl = canvas.toDataURL('image/png');
        const prev = document.getElementById('apk-icon-preview');
        prev.src = apkIconDataUrl; prev.classList.remove('hide');
        document.getElementById('apk-icon-placeholder').classList.add('hide');
        document.getElementById('apk-icon-remove').classList.remove('hide');
        document.getElementById('apk-icon-info').innerText = (file.name || 'logo') + ' • ' + APK_ICON_SIZE + 'x' + APK_ICON_SIZE;
      } catch (err) { showToast('Gagal memproses logo', 'error'); }
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}

async function handleBuildApk() {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  if (!guardServerOnline('Build APK')) return;
  if (apkActiveBuildId) return showToast('Masih ada build yang berjalan', 'error');
  let siteUrl = document.getElementById('apk-url').value.trim();
  const appName = document.getElementById('apk-appname').value.trim();
  const packageName = document.getElementById('apk-package').value.trim();
  const versionName = document.getElementById('apk-vname').value.trim() || '1.0.0';
  const versionCode = parseInt(document.getElementById('apk-vcode').value, 10) || 1;
  if (!siteUrl) return showToast('Isi URL website dulu!', 'error');
  if (!/^https?:/i.test(siteUrl)) siteUrl = 'https://' + siteUrl;
  if (!appName) return showToast('Isi nama aplikasi dulu!', 'error');
  setApkBusy(true);
  showApkLoading('Mengirim permintaan', 'Menghubungi server build...');
  document.getElementById('apk-result-container').classList.add('hide');
  document.getElementById('apk-progress-fill').style.width = '5%';
  try {
    const res = await fetch('/api/apk/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUsername, url: siteUrl, appName: appName, packageName: packageName, versionName: versionName, versionCode: versionCode, icon: apkIconDataUrl, permissions: apkSelectedPerms }) });
    const data = await res.json();
    if (!data.success) {
      applyApkQuotaInfo(data.quotaInfo);
      if (data.refilled) showToast(escapeHtml(data.message || 'Gagal! Kuota dikembalikan.'), 'error', 4000);
      else showToast(escapeHtml(data.message || 'Gagal'), 'error', 4000);
      finishApkLoading('❌ Gagal', data.message || 'Gagal', 4000);
      setApkBusy(false);
      return;
    }
    applyApkQuotaInfo(data.quotaInfo);
    showToast('Build dimulai! Mohon tunggu...', 'info', 3000);
    startApkPolling(data.buildId, Date.now());
    loadApkHistory();
  } catch (err) {
    finishApkLoading('❌ Gagal', err.message, 4000);
    showToast(escapeHtml(err.message), 'error');
    setApkBusy(false);
  }
}

function resetApkForm() {
  if (apkActiveBuildId) return showToast('Build sedang berjalan', 'error');
  document.getElementById('apk-url').value = '';
  document.getElementById('apk-appname').value = '';
  document.getElementById('apk-package').value = '';
  document.getElementById('apk-vname').value = '1.0.0';
  document.getElementById('apk-vcode').value = '1';
  clearApkIcon();
  apkSelectedPerms = [];
  renderApkPerms();
  document.getElementById('apk-result-container').classList.add('hide');
  document.getElementById('apk-loading').classList.add('hide');
}

function hideApkResult() {
  document.getElementById('apk-result-container').classList.add('hide');
}

function apkClientFileName(b) {
  const n = String((b && b.appName) || 'app').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'app';
  const v = String((b && b.versionName) || '1.0.0').replace(/[^A-Za-z0-9._-]+/g, '_');
  return n + '-' + v + '.apk';
}

async function downloadApk(b) {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  if (!b || !b.buildId) return showToast('Belum ada APK', 'error');
  showToast('Mengunduh APK...', 'info', 2500);
  try {
    const res = await fetch('/api/apk/download?username=' + encodeURIComponent(loggedInUsername) + '&build_id=' + encodeURIComponent(b.buildId));
    if (!res.ok) {
      let msg = 'Gagal mengunduh APK';
      try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = apkClientFileName(b);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(objUrl); }, 60000);
    showToast('APK berhasil diunduh!', 'success');
  } catch (err) {
    if (b.downloadUrl) { showToast('Mencoba link langsung...', 'info', 3000); window.open(b.downloadUrl, '_blank'); }
    else showToast(escapeHtml(err.message), 'error', 4000);
  }
}

function downloadLastApk() { return downloadApk(apkLastResult); }

function downloadApkByIndex(i) { return downloadApk(apkHistory[i]); }

function copyApkLink() {
  const link = apkLastResult && apkLastResult.downloadUrl;
  if (!link) return showToast('Belum ada link', 'error');
  navigator.clipboard.writeText(link).then(function () { showToast('Link tersalin!', 'success'); }).catch(function () { showToast('Gagal menyalin', 'error'); });
}

async function loadApkHistory() {
  if (!loggedInUsername) return;
  const container = document.getElementById('apk-history-list');
  try {
    const res = await fetch('/api/apk/history?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success) { apkHistory = data.builds || []; renderApkHistory(); }
  } catch (e) {
    if (container && apkHistory.length === 0) container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal memuat riwayat</p>';
  }
}

function renderApkHistory() {
  const container = document.getElementById('apk-history-list');
  if (!container) return;
  if (apkHistory.length === 0) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada build</p>'; return; }
  container.innerHTML = apkHistory.map(function (b, i) {
    const timeStr = new Date(b.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const badge = b.status === 'ready' ? '<span class="badge badge-ok">✓ Siap</span>' : (b.status === 'failed' ? '<span class="badge badge-err">✕ Gagal</span>' : '<span class="badge badge-warn">⏳ Build</span>');
    const action = b.status === 'ready' ? '<button onclick="downloadApkByIndex(' + i + ')" class="btn btn-apk btn-xs" style="margin-top:7px;">Download APK</button>' : '';
    const errLine = (b.status === 'failed' && b.error) ? '<div style="font-size:10px; color:var(--err); margin-top:5px; word-break:break-word;">' + escapeHtml(b.error) + (b.refunded ? ' (kuota dikembalikan)' : '') + '</div>' : '';
    return '<div class="hist-item" style="padding:10px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
        '<div style="min-width:0; flex:1;"><div style="font-weight:700; font-size:12px; word-break:break-word;">' + escapeHtml(b.appName || '-') + '</div>' +
        '<div class="mono" style="font-size:10px; color:var(--text-2); word-break:break-all;">' + escapeHtml(b.packageName || '') + ' • v' + escapeHtml(b.versionName || '') + '</div></div>' +
        badge +
      '</div>' + errLine + action +
      ((b.hasIcon || (b.permissions && b.permissions.length)) ? '<div style="font-size:9px; color:var(--text-2); margin-top:6px;">' + (b.hasIcon ? '🖼️ Logo kustom' : '') + (b.hasIcon && b.permissions && b.permissions.length ? ' • ' : '') + (b.permissions && b.permissions.length ? '🔐 ' + b.permissions.length + ' izin' : '') + '</div>' : '') +
      '<div style="font-size:9px; color:var(--text-2); margin-top:6px;">🕐 ' + timeStr + '</div>' +
    '</div>';
  }).join('');
  if (!apkActiveBuildId) {
    const running = apkHistory.find(function (b) { return b.status === 'building'; });
    if (running) startApkPolling(running.buildId, running.timestamp);
  }
}

function selectNetflixPlan(plan) {
  selectedNetflixPlan = plan;
  document.querySelectorAll('.opt-row[data-plan]').forEach(el => { el.classList.toggle('selected', el.dataset.plan === plan); });
}

function updateNetflixQuotaDisplay() {
  const el = document.getElementById('netflix-quota-display');
  if (el) {
    if (isAdminUser || isVipUser) { el.innerText = '∞'; el.style.color = 'var(--err)'; }
    else { const remain = Math.max(0, userQuotaData.totalQuota - userQuotaData.usedQuota); el.innerText = remain; el.style.color = remain > 0 ? 'white' : 'var(--err)'; }
  }
  const resetEl = document.getElementById('netflix-reset-display');
  if (resetEl) resetEl.innerText = (isAdminUser || isVipUser) ? '∞' : '24 Jam';
}

async function handleGenerateNetflix() {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  if (!guardServerOnline('Netflix')) return;
  const useProxy = document.getElementById('netflix-use-proxy').checked;
  const btn = document.getElementById('btn-generate-netflix');
  const btnText = document.getElementById('netflix-btn-text');
  const loadingEl = document.getElementById('netflix-loading');
  const statusText = document.getElementById('netflix-status-text');
  const logText = document.getElementById('netflix-log-text');
  const progressFill = document.getElementById('netflix-progress-fill');
  btn.disabled = true; btnText.innerText = 'Memproses...';
  loadingEl.classList.remove('hide'); progressFill.style.width = '0%';
  statusText.innerText = 'Menyiapkan'; logText.innerText = 'Initializing...';
  try {
    const quotaRes = await fetch('/api/netflix/check-quota?username=' + encodeURIComponent(loggedInUsername));
    const quotaData = await quotaRes.json();
    if (!quotaData.success) throw new Error(quotaData.message || 'Gagal cek');
    if (!quotaData.allowed) throw new Error(quotaData.message || 'Quota habis!');
    statusText.innerText = 'Menggenerate...'; logText.innerText = 'Connecting...'; progressFill.style.width = '30%';
    const genRes = await fetch('/api/netflix/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, plan: selectedNetflixPlan, useProxy }) });
    const genData = await genRes.json();
    progressFill.style.width = '80%';
    if (genData.success && genData.result) {
      progressFill.style.width = '100%'; statusText.innerText = '✅ Berhasil!'; logText.innerText = 'Success';
      addNetflixResult(genData.result);
      if (genData.quotaInfo) { userQuotaData.usedQuota = genData.quotaInfo.usedQuota || userQuotaData.usedQuota; updateQuotaDisplay(genData.quotaInfo); updateNetflixQuotaDisplay(); }
      if (genData.orderId) showToast('✅ Order ID: ' + genData.orderId, 'order', 5000);
      else showToast('Token berhasil!', 'netflix');
      loadNetflixHistory(true);
      setTimeout(() => loadingEl.classList.add('hide'), 2000);
    } else {
      if (genData.refilled) showToast(genData.message || 'Gagal! Kuota dikembalikan.', 'error', 4000);
      else showToast(genData.message || 'Gagal', 'error');
      if (genData.quotaInfo) { updateQuotaDisplay(genData.quotaInfo); updateNetflixQuotaDisplay(); }
      else loadVerifiedEmails(true);
      throw new Error(genData.message || 'Gagal');
    }
  } catch (err) {
    statusText.innerText = '❌ Gagal'; logText.innerText = err.message;
    if (!err.message.includes('dikembalikan')) showToast(err.message, 'error');
    setTimeout(() => loadingEl.classList.add('hide'), 3000);
  } finally { btn.disabled = false; btnText.innerText = 'Generate Token'; }
}

function addNetflixResult(result) { netflixResults.unshift(result); renderNetflixResults(); document.getElementById('netflix-results-container').classList.remove('hide'); }

function renderNetflixResults() {
  const container = document.getElementById('netflix-results-list');
  if (!container) return;
  if (netflixResults.length === 0) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Belum ada</p>'; return; }
  const NC = {US:'UNITED STATES',GB:'UNITED KINGDOM',DE:'GERMANY',FR:'FRANCE',JP:'JAPAN',KR:'SOUTH KOREA',IN:'INDIA',BR:'BRAZIL',CA:'CANADA',AU:'AUSTRALIA',ID:'INDONESIA',MY:'MALAYSIA',PH:'PHILIPPINES',SG:'SINGAPORE',TH:'THAILAND'};
  container.innerHTML = netflixResults.map((r, i) => {
    const countryName = NC[r.country] || r.country || 'Unknown';
    return '<div class="hist-item" style="border-color:rgba(229,9,20,0.25);"><div style="display:flex; justify-content:space-between; margin-bottom:7px;"><span style="font-size:11.5px; font-weight:700; color:var(--err);">#' + (netflixResults.length - i) + ' • ' + escapeHtml((r.plan || selectedNetflixPlan).toUpperCase()) + '</span><span class="badge badge-err" style="font-size:9px;">' + escapeHtml(countryName) + '</span></div><div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:7px;"><div><div style="font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700;">Quality</div><div style="font-size:11px; font-weight:600;">' + escapeHtml(r.quality || 'HD') + '</div></div><div><div style="font-size:9px; color:var(--text-2); text-transform:uppercase; font-weight:700;">Expires</div><div style="font-size:11px; font-weight:600;">' + (r.expires ? new Date(r.expires).toLocaleDateString('id-ID') : '—') + '</div></div></div><div class="link-line" style="margin-bottom:6px;" onclick="copyNetflixLink(\\'' + escapeHtml(r.url).replace(/'/g, "\\\\'") + '\\')">' + escapeHtml(r.url) + '</div><button onclick="copyNetflixLink(\\'' + escapeHtml(r.url).replace(/'/g, "\\\\'") + '\\')" class="btn btn-netflix btn-sm" style="width:100%;">Copy Link</button></div>';
  }).join('');
}

function copyNetflixLink(url) { navigator.clipboard.writeText(url).then(() => showToast('Tersalin!', 'netflix')).catch(() => showToast('Gagal', 'error')); }
function clearNetflixResults() { netflixResults = []; renderNetflixResults(); document.getElementById('netflix-results-container').classList.add('hide'); }

async function loadNetflixHistory(force = false) {
  if (!loggedInUsername) return;
  const now = Date.now();
  if (!force && now - lastNetflixHistoryFetch < CACHE_DURATION.netflixHistory) { const cached = getCached('netflixHistory'); if (cached) { renderNetflixHistory(cached); return; } }
  const container = document.getElementById('netflix-history-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Memuat...</p>';
  try {
    const res = await fetch('/api/netflix/history?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    lastNetflixHistoryFetch = now; setCache('netflixHistory', data, CACHE_DURATION.netflixHistory); renderNetflixHistory(data);
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>'; }
}

function renderNetflixHistory(data) {
  const container = document.getElementById('netflix-history-list');
  if (!container) return;
  if (data.success && data.results && data.results.length > 0) {
    const NC = {US:'UNITED STATES',GB:'UNITED KINGDOM',DE:'GERMANY',FR:'FRANCE',JP:'JAPAN',KR:'SOUTH KOREA',IN:'INDIA',BR:'BRAZIL',CA:'CANADA',AU:'AUSTRALIA',ID:'INDONESIA',MY:'MALAYSIA',PH:'PHILIPPINES',SG:'SINGAPORE',TH:'THAILAND'};
    container.innerHTML = data.results.map(r => {
      const countryName = NC[r.country] || r.country || 'Unknown';
      return '<div class="hist-item" style="border-color:rgba(229,9,20,0.2);"><div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span style="font-size:11px; font-weight:700; color:var(--err);">' + escapeHtml(r.plan || 'premium').toUpperCase() + '</span><span style="font-size:9px; color:var(--text-2);">' + new Date(r.timestamp).toLocaleDateString('id-ID') + '</span></div><div style="font-size:10px; color:var(--text-2);">' + escapeHtml(countryName) + ' • ' + escapeHtml(r.quality || 'HD') + '</div><div class="link-line" style="margin-top:6px; font-size:10px;" onclick="copyNetflixLink(\\'' + escapeHtml(r.url).replace(/'/g, "\\\\'") + '\\')">' + escapeHtml(r.url) + '</div></div>';
    }).join('');
  } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada</p>';
}

async function fetchServerStatus(force = false) {
  if (!isPageVisible && !force) return;
  const now = Date.now();
  if (!force && now - lastStatusFetch < CACHE_DURATION.status) { const cached = getCached('serverStatus'); if (cached) { updateStatusUI(cached); serverOnline = (cached === 'online'); return; } }
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    updateStatusUI(data.status); serverOnline = (data.status === 'online'); lastStatusFetch = now;
    setCache('serverStatus', data.status, CACHE_DURATION.status);
  } catch(e) {}
}

async function fetchFeaturedVideo(force = false) {
  if (!isPageVisible && !force) return;
  const now = Date.now();
  if (!force && now - lastVideoFetch < CACHE_DURATION.video) { const cached = getCached('featuredVideo'); if (cached) { const v = document.getElementById('main-display-video'); if (v && v.src !== cached) v.src = cached; return; } }
  try {
    const res = await fetch('/api/video');
    const data = await res.json();
    if (data.success && data.videoUrl) { const v = document.getElementById('main-display-video'); if (v && v.src !== data.videoUrl) v.src = data.videoUrl; lastVideoFetch = now; setCache('featuredVideo', data.videoUrl, CACHE_DURATION.video); }
  } catch(e) {}
}

function updateStatusUI(status) {
  const ind = document.getElementById('server-status-indicator');
  const dot = document.getElementById('server-dot');
  const txt = document.getElementById('server-status-text');
  const banner = document.getElementById('offline-banner');
  if (!ind) return;
  if (status === 'online') { ind.className = 'badge badge-ok'; dot.className = 'online-dot'; txt.innerText = 'Online'; banner.classList.add('hide'); }
  else { ind.className = 'badge badge-err'; dot.style.background = 'var(--err)'; dot.style.boxShadow = 'none'; dot.style.animation = 'none'; txt.innerText = 'Offline'; if (!isAdminUser) banner.classList.remove('hide'); }
}

function startPolling() {
  if (statusPollInterval) clearInterval(statusPollInterval);
  statusPollInterval = setInterval(() => { if (isPageVisible) fetchServerStatus(); }, CACHE_DURATION.status);
  if (videoPollInterval) clearInterval(videoPollInterval);
  videoPollInterval = setInterval(() => { if (isPageVisible) fetchFeaturedVideo(); }, CACHE_DURATION.video);
}

fetchServerStatus();
fetchFeaturedVideo();
startPolling();
fetchOnlineCount();
updateNotifButton();
// Cek apakah notif sudah pernah diaktifkan sebelumnya
if (localStorage.getItem('notifEnabled') === '1' && 'Notification' in window && Notification.permission === 'granted') {
  notificationsEnabled = true;
  registerServiceWorker().then(() => { if (loggedInUsername) registerNotificationToServer(); startNotifPolling(); });
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-reg-btn');
  const ind = document.getElementById('tab-indicator');
  const emailField = document.getElementById('email-field-container');
  const btnText = document.getElementById('auth-btn-text');
  const formContainer = document.getElementById('auth-form-container');
  formContainer.style.animation = 'none';
  formContainer.offsetHeight;
  formContainer.style.animation = 'fadeInScale 0.3s ease-out forwards';
  if (mode === 'login') {
    ind.style.transform = 'translateX(0%)'; loginBtn.style.color = 'white'; regBtn.style.color = 'var(--text-1)';
    emailField.classList.add('hide'); btnText.innerText = 'Masuk';
    const fl = document.getElementById('forgot-link-wrap'); if (fl) fl.classList.remove('hide');
  } else {
    ind.style.transform = 'translateX(100%)'; regBtn.style.color = 'white'; loginBtn.style.color = 'var(--text-1)';
    emailField.classList.remove('hide'); btnText.innerText = 'Daftar';
    const fl2 = document.getElementById('forgot-link-wrap'); if (fl2) fl2.classList.add('hide');
    toggleForgotPanel(false);
  }
}

function toggleForgotPanel(show) {
  var p = document.getElementById('forgot-panel');
  var f = document.getElementById('auth-form-container');
  var s = document.getElementById('auth-submit-btn');
  var l = document.getElementById('forgot-link-wrap');
  if (!p) return;
  if (show) { p.classList.remove('hide'); f.classList.add('hide'); s.classList.add('hide'); l.classList.add('hide'); }
  else { p.classList.add('hide'); f.classList.remove('hide'); s.classList.remove('hide'); if (currentAuthMode === 'login') l.classList.remove('hide'); document.getElementById('forgot-step2').classList.add('hide'); }
}
async function sendResetCode() {
  var username = document.getElementById('forgot-username').value.trim();
  if (!username) return showToast('Isi username dulu!', 'error');
  var btn = document.getElementById('forgot-send-btn'); btn.disabled = true;
  try {
    var res = await fetch('/api/auth/forgot', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: username }) });
    var data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error', 5000);
    if (data.success) document.getElementById('forgot-step2').classList.remove('hide');
  } catch (e) { showToast('Kesalahan koneksi', 'error'); }
  finally { btn.disabled = false; }
}
async function submitResetPassword() {
  var username = document.getElementById('forgot-username').value.trim();
  var code = document.getElementById('forgot-code').value.trim();
  var newPassword = document.getElementById('forgot-newpass').value;
  if (!username || !code || !newPassword) return showToast('Semua field wajib!', 'error');
  var btn = document.getElementById('forgot-submit-btn'); btn.disabled = true;
  try {
    var res = await fetch('/api/auth/reset', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: username, code: code, newPassword: newPassword }) });
    var data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error', 5000);
    if (data.success) { document.getElementById('forgot-code').value = ''; document.getElementById('forgot-newpass').value = ''; toggleForgotPanel(false); }
  } catch (e) { showToast('Kesalahan koneksi', 'error'); }
  finally { btn.disabled = false; }
}

async function handleAuthAction() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const formContainer = document.getElementById('auth-form-container');
  if (!username || !password) {
    formContainer.classList.add('shake-error');
    setTimeout(() => formContainer.classList.remove('shake-error'), 500);
    return showToast('Username dan password wajib!', 'error');
  }
  let deviceToken = localStorage.getItem('am_device_token');
  if (currentAuthMode === 'register' && deviceToken) {
    formContainer.classList.add('shake-error');
    setTimeout(() => formContainer.classList.remove('shake-error'), 500);
    return showToast('Perangkat sudah terdaftar!', 'error');
  }
  const btn = document.getElementById('auth-submit-btn');
  const originalText = document.getElementById('auth-btn-text').innerText;
  btn.classList.add('btn-loading');
  btn.disabled = true;
  document.getElementById('auth-btn-text').innerText = '';
  try {
    const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mode: currentAuthMode, username, password, deviceToken, email: (document.getElementById('auth-email') || {}).value || '' }) });
    const data = await res.json();
    if (data.success) {
      if (currentAuthMode === 'register' && data.deviceToken) localStorage.setItem('am_device_token', data.deviceToken);
      if (data.token) { localStorage.setItem('authToken', data.token); localStorage.setItem('savedUsername', data.username); }
      showToast(data.message, 'success');
      document.getElementById('auth-view').style.transition = 'opacity 0.3s';
      document.getElementById('auth-view').style.opacity = '0';
      setTimeout(() => {
        applySession(data);
        document.getElementById('auth-view').style.opacity = '1';
      }, 300);
    } else {
      formContainer.classList.add('shake-error');
      setTimeout(() => formContainer.classList.remove('shake-error'), 500);
      showToast(data.message, 'error');
    }
  } catch (err) { 
    formContainer.classList.add('shake-error');
    setTimeout(() => formContainer.classList.remove('shake-error'), 500);
    showToast('Kesalahan koneksi', 'error'); 
  }
  finally { 
    btn.classList.remove('btn-loading');
    document.getElementById('auth-btn-text').innerText = originalText; 
    btn.disabled = false; 
  }
}

function applySession(data) {
  loggedInUsername = data.username;
  isAdminUser = data.isAdmin;
  isVipUser = data.isVip || false;
  document.getElementById('auth-view').classList.add('hide');
  document.getElementById('terminal-view').classList.remove('hide');
  document.getElementById('menu-btn').classList.remove('hide');
  document.getElementById('logged-username').innerText = data.username;
  document.getElementById('user-avatar').innerText = data.username.charAt(0).toUpperCase();
  document.getElementById('drawer-avatar').innerText = data.username.charAt(0).toUpperCase();
  document.getElementById('drawer-username').innerText = data.username;
  document.getElementById('drawer-role').innerText = data.isAdmin ? 'Admin' : (data.isVip ? 'VIP Member' : 'User');
  document.getElementById('drawer-logout-btn').classList.remove('hide');
  document.getElementById('profile-uname').innerText = data.username;
  document.getElementById('profile-role').innerText = data.isAdmin ? 'Admin' : (data.isVip ? 'VIP Member' : 'Standard');
  document.getElementById('profile-quota').innerText = data.isAdmin || data.isVip ? 'Unlimited' : (BASE_QUOTA + (data.bonusQuota || 0) - data.usedQuota);
  updateQuotaDisplay(data);
  checkVipStatus(data);
  loadUserAnnouncements();
  loadVerifiedEmails();
  loadActiveRedeems();
  updateStatusUI(data.serverStatus);
  fetchFeaturedVideo(true);
  updateNetflixQuotaDisplay();
  startOnlineTracking();
  loadPaymentInfo();
  // Register notifikasi ke server jika sudah aktif
  if (notificationsEnabled) registerNotificationToServer();
  if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  loadGlobalChat();
  chatRefreshInterval = setInterval(() => { if (!isPageVisible) return; if (currentView !== 'chat') checkNewChatMessages(); else loadGlobalChat(); }, CACHE_DURATION.chat);
  const roleBadge = document.getElementById('role-badge');
  if (data.isAdmin) { roleBadge.className = 'badge badge-warn'; roleBadge.innerText = '👑 Admin'; document.getElementById('nav-admin-btn').classList.remove('hide'); }
  else if (data.isVip) { roleBadge.className = 'badge badge-accent'; roleBadge.innerText = '⭐ VIP'; }
  else { roleBadge.className = 'badge badge-muted'; roleBadge.innerText = 'User'; }
}

async function checkSavedSession() {
  const token = localStorage.getItem('authToken');
  const savedUname = localStorage.getItem('savedUsername');
  if (!token || !savedUname) return;
  try {
    const res = await fetch('/api/auth/session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: savedUname, token }) });
    const data = await res.json();
    if (data.success) applySession(data);
  } catch (e) {}
}
checkSavedSession();

async function handleRedeemCodeMain() {
  const code = document.getElementById('redeem-code-input-main').value.trim().toUpperCase();
  if (!code) return showToast('Masukkan kode!', 'error');
  try {
    const res = await fetch('/api/redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, code }) });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('redeem-code-input-main').value = '';
      updateQuotaDisplay(data); updateNetflixQuotaDisplay();
      loadVerifiedEmails(true); loadActiveRedeems(true);
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

async function loadActiveRedeems(force = false) {
  const now = Date.now();
  if (!force && now - lastRedeemsFetch < CACHE_DURATION.redeems) { const cached = getCached('activeRedeems'); if (cached) { renderActiveRedeems(cached); return; } }
  try {
    const [resActive, resClaimed] = await Promise.all([
      fetch('/api/redeems/active'),
      loggedInUsername ? fetch('/api/redeems/claimed?username=' + encodeURIComponent(loggedInUsername)) : Promise.resolve({ json: () => ({ claimedCodes: [] }) })
    ]);
    const dataActive = await resActive.json();
    const dataClaimed = await resClaimed.json();
    claimedRedeemCodes = dataClaimed.claimedCodes || {};
    lastRedeemsFetch = now; setCache('activeRedeems', { dataActive, claimedRedeemCodes }, CACHE_DURATION.redeems);
    renderActiveRedeems({ dataActive, claimedRedeemCodes });
  } catch(e) {}
}

function renderActiveRedeems(payload) {
  const { dataActive, claimedRedeemCodes } = payload;
  const container = document.getElementById('active-redeem-list');
  if (!container) return;
  if (dataActive.success && Object.keys(dataActive.redeems).length > 0) {
    container.innerHTML = Object.entries(dataActive.redeems).map(([code, val]) => {
      const remainingClaims = val.maxClaims - val.claimedCount;
      const quotaPerUser = val.quotaPerUser || 1;
      const hasClaimed = claimedRedeemCodes[code] === true;
      if (remainingClaims <= 0) return '';
      const buttonHtml = hasClaimed ? '<span class="badge badge-ok">✓ Sudah</span>' : '<button onclick="quickClaimRedeem(\\'' + escapeHtml(code) + '\\')" class="btn btn-info btn-xs">Klaim</button>';
      return '<div style="padding:9px 11px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.25); border-radius:8px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="flex:1; min-width:0;"><div class="mono" style="font-size:11.5px; font-weight:700; color:var(--info);">' + escapeHtml(code) + '</div><div style="font-size:9.5px; color:var(--text-2);">' + quotaPerUser + ' kuota • ' + remainingClaims + '/' + val.maxClaims + ' sisa</div></div>' + buttonHtml + '</div><div class="prog" style="height:4px;"><div class="prog-fill" style="width:' + Math.round((val.claimedCount / val.maxClaims) * 100) + '%; background:var(--info);"></div></div></div>';
    }).filter(Boolean).join('') || '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Tidak ada</p>';
  } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Tidak ada kode aktif</p>';
}

function quickClaimRedeem(code) {
  document.getElementById('redeem-code-input-main').value = code;
  showToast('Kode siap diklaim', 'info');
  document.getElementById('redeem-code-input-main').focus();
}

async function loadVipShopItems() {
  const container = document.getElementById('vip-shop-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px;">Memuat...</p>';
  try {
    const res = await fetch('/api/vip-shop');
    const data = await res.json();
    if (data.success && data.items && Object.keys(data.items).length > 0) {
      const items = Object.entries(data.items).filter(([_,v]) => v.active !== false).sort((a,b) => (a[1].order||0) - (b[1].order||0));
      cachedVipShopItems = items;
      container.innerHTML = items.map(([id, item]) => {
        const priceFormatted = 'Rp ' + Number(item.price).toLocaleString('id-ID');
        return '<div class="shop-item" onclick="selectVipItem(\\'' + escapeHtml(id) + '\\')"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;"><div style="display:flex; align-items:center; gap:10px;"><div style="width:34px; height:34px; border-radius:9px; background:var(--warn-soft); display:flex; align-items:center; justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><div><div style="font-weight:700; font-size:13px;">' + escapeHtml(item.name) + '</div><div style="font-size:10.5px; color:var(--warn);">⭐ ' + item.days + ' hari</div></div></div><div class="mono" style="font-size:14px; font-weight:800; color:var(--warn);">' + priceFormatted + '</div></div><button class="btn btn-warn btn-sm" style="width:100%;">Pilih & Bayar</button></div>';
      }).join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada</p>';
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:12px;">Gagal</p>'; }
}

function selectVipItem(itemId) {
  const item = cachedVipShopItems.find(([id]) => id === itemId);
  if (!item) return showToast('Tidak ditemukan', 'error');
  const [id, data] = item;
  document.getElementById('selected-vip-id').value = id;
  document.getElementById('selected-vip-price').value = data.price;
  document.getElementById('selected-vip-days').value = data.days;
  document.getElementById('selected-vip-name').value = data.name;
  document.getElementById('selected-vip-display').innerText = data.name + ' (' + data.days + ' hari)';
  document.getElementById('selected-vip-price-display').innerText = 'Rp ' + Number(data.price).toLocaleString('id-ID');
  document.getElementById('dana-number-display').innerText = DANA_ADMIN_NUMBER;
  document.getElementById('dana-owner-display').innerText = 'a.n. ' + DANA_ADMIN_NAME;
  document.getElementById('vip-purchase-form').classList.remove('hide');
  document.getElementById('payment-proof-section').classList.add('hide');
  document.getElementById('transaction-status-box').classList.add('hide');
  document.getElementById('topup-id-display').innerText = '-';
  document.getElementById('topup-status-display').innerHTML = '<span class="badge badge-warn">Menunggu</span>';
  document.getElementById('vip-purchase-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Dipilih: ' + data.name, 'info');
}

async function handleCreatePayment() {
  const vipId = document.getElementById('selected-vip-id').value;
  const vipName = document.getElementById('selected-vip-name').value;
  const vipPrice = document.getElementById('selected-vip-price').value;
  const vipDays = document.getElementById('selected-vip-days').value;
  if (!vipId) return showToast('Pilih layanan dulu!', 'error');
  const btn = document.getElementById('btn-create-payment');
  btn.disabled = true; btn.innerText = 'Memproses...';
  try {
    const res = await fetch('/api/transaction/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, vipId, vipName, vipPrice: parseInt(vipPrice), vipDays: parseInt(vipDays) }) });
    const data = await res.json();
    if (data.success) {
      currentTransactionId = data.transactionId;
      document.getElementById('topup-id-display').innerText = data.transactionId;
      document.getElementById('topup-status-display').innerHTML = '<span class="badge badge-warn">Menunggu</span>';
      document.getElementById('payment-proof-section').classList.remove('hide');
      showToast('Pesanan dibuat! Transfer via DANA & upload bukti.', 'success');
      loadUserTransactions();
    } else showToast(data.message || 'Gagal', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '💳 Buat Pesanan & Bayar'; }
}

function handlePaymentProofSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('Harus gambar!', 'error');
  if (file.size > 5 * 1024 * 1024) return showToast('Max 5MB', 'error');
  selectedPaymentProofFile = file;
  document.getElementById('proof-file-info').innerText = '📎 ' + file.name + ' (' + (file.size/1024).toFixed(0) + ' KB)';
  document.getElementById('btn-upload-proof').disabled = false;
  showToast('Siap upload', 'info');
}

async function handleUploadProof() {
  if (!currentTransactionId) return showToast('Buat pesanan dulu!', 'error');
  if (!selectedPaymentProofFile) return showToast('Pilih bukti!', 'error');
  const btn = document.getElementById('btn-upload-proof');
  btn.disabled = true; btn.innerText = 'Mengirim...';
  try {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      const res = await fetch('/api/transaction/upload-proof', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, transactionId: currentTransactionId, proofImage: base64, fileName: selectedPaymentProofFile.name }) });
      const data = await res.json();
      if (data.success) {
        showToast('Bukti terkirim!', 'success');
        document.getElementById('payment-proof-section').classList.add('hide');
        document.getElementById('transaction-status-box').classList.remove('hide');
        document.getElementById('transaction-status-content').innerHTML = '<div style="display:flex; align-items:center; gap:7px;"><span class="badge badge-info">Diproses</span><span style="font-size:11px; color:var(--text-1);">Menunggu verifikasi</span></div>';
        selectedPaymentProofFile = null;
        document.getElementById('payment-proof-file').value = '';
        document.getElementById('proof-file-info').innerText = 'Klik untuk upload';
        loadUserTransactions();
      } else showToast(data.message || 'Gagal', 'error');
      btn.disabled = false; btn.innerText = 'Kirim Bukti';
    };
    reader.readAsDataURL(selectedPaymentProofFile);
  } catch(e) { showToast('Gagal', 'error'); btn.disabled = false; btn.innerText = 'Kirim Bukti'; }
}

async function loadUserTransactions() {
  if (!loggedInUsername) return;
  const container = document.getElementById('user-transactions-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Memuat...</p>';
  try {
    const res = await fetch('/api/transaction/my?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.transactions && data.transactions.length > 0) {
      container.innerHTML = data.transactions.map(t => {
        const statusBadge = t.status === 'success' ? 'badge-ok' : t.status === 'failed' ? 'badge-err' : t.status === 'process' ? 'badge-info' : 'badge-warn';
        const statusText = t.status === 'success' ? '✓ Sukses' : t.status === 'failed' ? '✗ Gagal' : t.status === 'process' ? '⚙ Diproses' : '⏳ Menunggu';
        const priceFormatted = 'Rp ' + Number(t.vipPrice).toLocaleString('id-ID');
        return '<div class="hist-item"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="flex:1; min-width:0;"><div style="font-size:11.5px; font-weight:700;">' + escapeHtml(t.vipName) + '</div><div class="mono" style="font-size:9px; color:var(--text-2);">' + escapeHtml(t.transactionId) + '</div></div><span class="badge ' + statusBadge + '">' + statusText + '</span></div><div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; margin-top:5px;"><span style="color:var(--warn); font-weight:700;">' + priceFormatted + '</span><span style="color:var(--text-2);">' + new Date(t.createdAt).toLocaleDateString('id-ID') + '</span></div>' + (t.adminNote ? '<div style="font-size:10px; color:var(--warn); margin-top:5px; padding:5px 7px; background:var(--warn-soft); border-radius:5px;">💬 ' + escapeHtml(t.adminNote) + '</div>' : '') + '</div>';
      }).join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada</p>';
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>'; }
}

// ====== PEMBAYARAN QR OTOMATIS (CLIENT) ======
let qrisTrxId = null;
let qrisVipId = null;
let qrisPollTimer = null;
let qrisExpiryTimer = null;
let qrisCheckBusy = false;
let qrisReqSeq = 0;

function setQrisBadge(type) {
  var el = document.getElementById('qris-status-badge');
  if (!el) return;
  if (type === 'paid') { el.className = 'badge badge-ok'; el.innerText = '✓ Lunas'; }
  else if (type === 'failed') { el.className = 'badge badge-err'; el.innerText = '✗ Kedaluwarsa'; }
  else { el.className = 'badge badge-warn'; el.innerText = 'Menunggu'; }
}

function setQrisMessage(text, color) {
  var el = document.getElementById('qris-result-text');
  if (!el) return;
  el.style.color = color || 'var(--text-1)';
  el.innerText = text;
}

function stopQrisTimers() {
  if (qrisPollTimer) { clearInterval(qrisPollTimer); qrisPollTimer = null; }
  if (qrisExpiryTimer) { clearInterval(qrisExpiryTimer); qrisExpiryTimer = null; }
}

function startQrisCountdown(expiresAt) {
  if (qrisExpiryTimer) { clearInterval(qrisExpiryTimer); qrisExpiryTimer = null; }
  var el = document.getElementById('qris-expiry-text');
  if (!el) return;
  if (!expiresAt) { el.innerText = ''; return; }
  var tick = function() {
    var left = expiresAt - Date.now();
    if (left <= 0) {
      el.innerText = 'Link kedaluwarsa. Tekan Buat Link Baru.';
      if (qrisExpiryTimer) { clearInterval(qrisExpiryTimer); qrisExpiryTimer = null; }
      return;
    }
    var m = Math.floor(left / 60000);
    var s = Math.floor((left % 60000) / 1000);
    el.innerText = 'Berlaku ' + m + ':' + (s < 10 ? '0' : '') + s;
  };
  tick();
  qrisExpiryTimer = setInterval(tick, 1000);
}

function highlightPayMethod(method) {
  var qrBtn = document.getElementById('pay-method-btn-qr');
  var danaBtn = document.getElementById('pay-method-btn-dana');
  if (qrBtn) qrBtn.style.outline = method === 'qr' ? '2px solid var(--ok)' : 'none';
  if (danaBtn) danaBtn.style.outline = method === 'dana' ? '2px solid var(--info)' : 'none';
}

function resetPayMethod() {
  stopQrisTimers();
  qrisReqSeq++;
  qrisTrxId = null;
  var qrSec = document.getElementById('qris-section');
  var danaWrap = document.getElementById('dana-method-wrap');
  if (qrSec) qrSec.classList.add('hide');
  if (danaWrap) danaWrap.classList.add('hide');
  highlightPayMethod(null);
}

function choosePayMethod(method) {
  var vipId = document.getElementById('selected-vip-id').value;
  if (!vipId) return showToast('Pilih layanan dulu!', 'error');
  var qrSec = document.getElementById('qris-section');
  var danaWrap = document.getElementById('dana-method-wrap');
  highlightPayMethod(method);
  if (method === 'qr') {
    danaWrap.classList.add('hide');
    qrSec.classList.remove('hide');
    startQrisPayment(vipId);
  } else {
    stopQrisTimers();
    qrisReqSeq++;
    qrisTrxId = null;
    qrSec.classList.add('hide');
    danaWrap.classList.remove('hide');
  }
}

async function startQrisPayment(vipId) {
  if (!loggedInUsername || !vipId) return;
  qrisVipId = vipId;
  var mySeq = ++qrisReqSeq;
  stopQrisTimers();
  qrisTrxId = null;
  setQrisBadge('pending');
  var link = document.getElementById('qris-checkout-link');
  link.classList.add('hide');
  setQrisMessage('Membuat link pembayaran...', 'var(--text-1)');
  document.getElementById('qris-expiry-text').innerText = '';
  document.getElementById('qris-invoice-id').innerText = '-';
  try {
    var res = await fetch('/api/qris/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUsername, vipId: vipId }) });
    var data = await res.json();
    if (mySeq !== qrisReqSeq) return;
    if (!data.success) {
      setQrisMessage(data.message || 'Gagal membuat link pembayaran', 'var(--err)');
      showToast(data.message || 'Gagal membuat link pembayaran', 'error');
      return;
    }
    qrisTrxId = data.transactionId;
    document.getElementById('qris-amount-display').innerText = 'Rp ' + Number(data.amount).toLocaleString('id-ID');
    document.getElementById('qris-invoice-id').innerText = data.invoiceId || '-';
    if (data.checkoutUrl) { link.href = data.checkoutUrl; link.classList.remove('hide'); }
    setQrisMessage('Klik tombol di atas untuk membayar lewat QR. Setelah pembayaran terdeteksi, akun otomatis menjadi VIP, tidak perlu konfirmasi lagi.', 'var(--text-1)');
    startQrisCountdown(data.expiresAt);
    qrisPollTimer = setInterval(checkQrisStatus, 6000);
    showToast('Link pembayaran siap.', 'success');
    loadUserTransactions();
  } catch (e) {
    if (mySeq !== qrisReqSeq) return;
    setQrisMessage('Kesalahan koneksi', 'var(--err)');
    showToast('Kesalahan koneksi', 'error');
  }
}

function reloadQrisPayment() {
  if (!qrisVipId) return showToast('Pilih produk VIP dulu!', 'error');
  startQrisPayment(qrisVipId);
}

function applyVipSessionUpdate(s) {
  if (!s) return;
  isVipUser = !!s.isVip;
  var dr = document.getElementById('drawer-role'); if (dr) dr.innerText = 'VIP Member';
  var pr = document.getElementById('profile-role'); if (pr) pr.innerText = 'VIP Member';
  var pq = document.getElementById('profile-quota'); if (pq) pq.innerText = 'Unlimited';
  try { checkVipStatus(s); } catch (e) {}
  try { updateQuotaDisplay(s); } catch (e) {}
  try { updateNetflixQuotaDisplay(); } catch (e) {}
}

function onQrisPaid(data) {
  stopQrisTimers();
  qrisTrxId = null;
  setQrisBadge('paid');
  document.getElementById('qris-checkout-link').classList.add('hide');
  document.getElementById('qris-expiry-text').innerText = '';
  setQrisMessage('✅ Pembayaran terdeteksi! Akun kamu sekarang VIP.', 'var(--ok)');
  applyVipSessionUpdate(data.session);
  showToast(data.message || 'Pembayaran berhasil! Akun VIP aktif.', 'success', 5000);
  loadUserTransactions();
}

function onQrisFailed(data) {
  stopQrisTimers();
  qrisTrxId = null;
  setQrisBadge('failed');
  document.getElementById('qris-checkout-link').classList.add('hide');
  setQrisMessage(data.message || 'Link kedaluwarsa / dibatalkan. Tekan Buat Link Baru.', 'var(--err)');
  showToast(data.message || 'Link pembayaran kedaluwarsa', 'error');
  loadUserTransactions();
}

async function checkQrisStatus() {
  if (!qrisTrxId || qrisCheckBusy) return;
  var sec = document.getElementById('section-vipshop');
  if (sec && sec.classList.contains('hide')) return;
  qrisCheckBusy = true;
  var trxAtStart = qrisTrxId;
  try {
    var res = await fetch('/api/qris/status?username=' + encodeURIComponent(loggedInUsername) + '&transactionId=' + encodeURIComponent(trxAtStart));
    var data = await res.json();
    if (trxAtStart !== qrisTrxId) return;
    if (data.status === 'paid') onQrisPaid(data);
    else if (data.status === 'failed') onQrisFailed(data);
  } catch (e) {}
  finally { qrisCheckBusy = false; }
}

document.addEventListener('visibilitychange', function() { if (!document.hidden) checkQrisStatus(); });

// Pilih produk VIP -> tampil pilihan metode (QR / DANA). Fungsi lama tetap dipanggil apa adanya
var __origSelectVipItem = selectVipItem;
selectVipItem = function(itemId) {
  __origSelectVipItem(itemId);
  qrisVipId = itemId;
  resetPayMethod();
};

async function handleSubmitFeatureRequest() {
  const title = document.getElementById('feature-request-title').value.trim();
  const description = document.getElementById('feature-request-desc').value.trim();
  if (!title || !description) return showToast('Lengkapi!', 'error');
  if (title.length < 3) return showToast('Judul min 3!', 'error');
  if (description.length < 10) return showToast('Deskripsi min 10!', 'error');
  try {
    const res = await fetch('/api/feature-request/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, title, description }) });
    const data = await res.json();
    if (data.success) {
      showToast('Request terkirim!', 'success');
      document.getElementById('feature-request-title').value = '';
      document.getElementById('feature-request-desc').value = '';
      loadUserFeatureRequests();
    } else showToast(data.message || 'Gagal', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

async function loadUserFeatureRequests() {
  if (!loggedInUsername) return;
  const container = document.getElementById('user-feature-requests-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Memuat...</p>';
  try {
    const res = await fetch('/api/feature-request/my?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.requests && data.requests.length > 0) {
      container.innerHTML = data.requests.map(req => {
        const statusBadge = req.status === 'approved' ? 'badge-ok' : req.status === 'rejected' ? 'badge-err' : 'badge-warn';
        const statusText = req.status === 'approved' ? '✓ Disetujui' : req.status === 'rejected' ? '✗ Ditolak' : '⏳ Menunggu';
        return '<div class="hist-item" style="border-color:rgba(74,222,128,0.25);"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="font-size:11.5px; font-weight:700; color:var(--ok); flex:1; min-width:0;">' + escapeHtml(req.title) + '</div><span class="badge ' + statusBadge + '">' + statusText + '</span></div><div style="font-size:11px; color:var(--text-1); line-height:1.4;">' + escapeHtml(req.description) + '</div><div style="font-size:9px; color:var(--text-2); margin-top:5px;">' + new Date(req.timestamp).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</div>' + (req.adminNote ? '<div style="font-size:10px; color:var(--warn); margin-top:5px; padding:5px 7px; background:var(--warn-soft); border-radius:5px;">💬 ' + escapeHtml(req.adminNote) + '</div>' : '') + '</div>';
      }).join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada</p>';
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>'; }
}

async function loadAdminFeatureRequests() {
  if (!isAdminUser) return;
  const container = document.getElementById('admin-feature-requests-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Memuat...</p>';
  try {
    const res = await fetch('/api/admin/feature-requests?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.requests && data.requests.length > 0) {
      const pending = data.requests.filter(r => r.status === 'pending');
      const others = data.requests.filter(r => r.status !== 'pending');
      const sorted = [...pending, ...others];
      container.innerHTML = sorted.map(req => {
        const statusBadge = req.status === 'approved' ? 'badge-ok' : req.status === 'rejected' ? 'badge-err' : 'badge-warn';
        const statusText = req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : 'Menunggu';
        return '<div class="hist-item" style="border-color:rgba(74,222,128,0.2);"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="flex:1; min-width:0;"><div style="font-size:11.5px; font-weight:700; color:var(--ok);">' + escapeHtml(req.title) + '</div><div style="font-size:9px; color:var(--text-2);">Dari: ' + escapeHtml(req.username) + '</div></div><span class="badge ' + statusBadge + '">' + statusText + '</span></div><div style="font-size:10.5px; color:var(--text-1); margin-bottom:5px;">' + escapeHtml(req.description) + '</div>' + (req.adminNote ? '<div style="font-size:9px; color:var(--warn); margin-bottom:5px;">Catatan: ' + escapeHtml(req.adminNote) + '</div>' : '') + '<div style="display:flex; gap:4px; margin-top:5px; padding-top:5px; border-top:1px solid var(--line);"><input type="text" id="admin-note-' + req.id + '" placeholder="Catatan..." class="inp" style="flex:1; padding:5px 8px; font-size:10.5px;"><button onclick="updateFeatureRequestStatus(\\'' + req.id + '\\', \\'approved\\')" class="btn btn-ok btn-xs">✓</button><button onclick="updateFeatureRequestStatus(\\'' + req.id + '\\', \\'rejected\\')" class="btn btn-err btn-xs">✗</button><button onclick="deleteFeatureRequest(\\'' + req.id + '\\')" class="btn btn-ghost btn-xs">🗑</button></div></div>';
      }).join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada</p>';
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>'; }
}

async function updateFeatureRequestStatus(reqId, status) {
  const noteInput = document.getElementById('admin-note-' + reqId);
  const adminNote = noteInput ? noteInput.value.trim() : '';
  try {
    const res = await fetch('/api/admin/feature-request/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, requestId: reqId, status, adminNote }) });
    const data = await res.json();
    if (data.success) { showToast('Diupdate', 'success'); loadAdminFeatureRequests(); }
    else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

async function deleteFeatureRequest(reqId) {
  if (!confirm('Hapus request ini?')) return;
  try {
    const res = await fetch('/api/admin/feature-request/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, requestId: reqId }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); loadAdminFeatureRequests(); }
  } catch(e) {}
}

async function loadAdminVipShop() {
  if (!isAdminUser) return;
  const container = document.getElementById('admin-vip-shop-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px;">Memuat...</p>';
  try {
    const res = await fetch('/api/vip-shop');
    const data = await res.json();
    if (data.success && data.items && Object.keys(data.items).length > 0) {
      const items = Object.entries(data.items).sort((a,b) => (a[1].order||0) - (b[1].order||0));
      container.innerHTML = items.map(([id, item]) => '<div style="display:flex; justify-content:space-between; align-items:center; padding:7px 9px; background:var(--bg-0); border:1px solid var(--line-2); border-radius:6px;"><div style="flex:1; min-width:0;"><div style="font-size:11px; font-weight:700; color:var(--warn);">' + escapeHtml(item.name) + '</div><div style="font-size:9px; color:var(--text-2);">' + item.days + 'd • Rp ' + Number(item.price).toLocaleString('id-ID') + ' • ' + (item.active !== false ? '✅' : '❌') + '</div></div><div style="display:flex; gap:3px; flex-shrink:0;"><button onclick="editVipShopItem(\\'' + id + '\\', \\'' + encodeURIComponent(item.name) + '\\', ' + item.price + ', ' + item.days + ')" class="btn btn-ghost btn-xs">E</button><button onclick="toggleVipShopItem(\\'' + id + '\\', ' + (item.active !== false) + ')" class="btn btn-ghost btn-xs">' + (item.active !== false ? 'O' : 'X') + '</button><button onclick="deleteVipShopItem(\\'' + id + '\\')" class="btn btn-ghost btn-xs" style="color:var(--err);">×</button></div></div>').join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px;">Belum ada</p>';
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:6px;">Gagal</p>'; }
}

async function handleSaveVipShop() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  const editId = document.getElementById('vip-shop-edit-id').value;
  const name = document.getElementById('vip-shop-name').value.trim();
  const price = parseInt(document.getElementById('vip-shop-price').value);
  const days = parseInt(document.getElementById('vip-shop-days').value);
  if (!name || isNaN(price) || isNaN(days)) return showToast('Lengkapi!', 'error');
  if (price < 1000) return showToast('Min Rp 1.000', 'error');
  if (days < 1) return showToast('Min 1 hari', 'error');
  try {
    const res = await fetch('/api/admin/vip-shop/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, id: editId, name, price, days }) });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); resetVipShopForm(); loadAdminVipShop(); }
    else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

function editVipShopItem(id, encName, price, days) {
  document.getElementById('vip-shop-edit-id').value = id;
  document.getElementById('vip-shop-name').value = decodeURIComponent(encName);
  document.getElementById('vip-shop-price').value = price;
  document.getElementById('vip-shop-days').value = days;
  document.getElementById('vip-shop-submit-btn').innerText = 'Perbarui';
  document.getElementById('vip-shop-cancel-btn').classList.remove('hide');
}

function resetVipShopForm() {
  document.getElementById('vip-shop-edit-id').value = '';
  document.getElementById('vip-shop-name').value = '';
  document.getElementById('vip-shop-price').value = '';
  document.getElementById('vip-shop-days').value = '';
  document.getElementById('vip-shop-submit-btn').innerText = 'Tambah Layanan';
  document.getElementById('vip-shop-cancel-btn').classList.add('hide');
}

async function toggleVipShopItem(id, currentActive) {
  try {
    const res = await fetch('/api/admin/vip-shop/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, id, active: !currentActive }) });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadAdminVipShop(); }
  } catch(e) {}
}

async function deleteVipShopItem(id) {
  if (!confirm('Hapus layanan?')) return;
  try {
    const res = await fetch('/api/admin/vip-shop/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, id }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); loadAdminVipShop(); }
  } catch(e) {}
}

async function loadAdminTransactions() {
  if (!isAdminUser) return;
  const container = document.getElementById('admin-transactions-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">Memuat...</p>';
  try {
    const res = await fetch('/api/admin/transactions?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.transactions && data.transactions.length > 0) {
      const pending = data.transactions.filter(t => t.status === 'pending' || t.status === 'process');
      const others = data.transactions.filter(t => t.status !== 'pending' && t.status !== 'process');
      const sorted = [...pending, ...others];
      container.innerHTML = sorted.map(t => {
        const statusBadge = t.status === 'success' ? 'badge-ok' : t.status === 'failed' ? 'badge-err' : t.status === 'process' ? 'badge-info' : 'badge-warn';
        const statusText = t.status === 'success' ? '✓ Sukses' : t.status === 'failed' ? '✗ Gagal' : t.status === 'process' ? '⚙ Diproses' : '⏳ Menunggu';
        const priceFormatted = 'Rp ' + Number(t.vipPrice).toLocaleString('id-ID');
        return '<div class="hist-item"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="flex:1; min-width:0;"><div style="font-size:11px; font-weight:700;">' + escapeHtml(t.vipName) + ' <span style="font-size:9px; color:var(--text-2);">oleh ' + escapeHtml(t.username) + '</span></div><div class="mono" style="font-size:9px; color:var(--text-2);">' + escapeHtml(t.transactionId) + '</div></div><span class="badge ' + statusBadge + '">' + statusText + '</span></div><div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; margin-top:4px;"><span style="color:var(--warn); font-weight:700;">' + priceFormatted + '</span><span style="color:var(--text-2);">' + new Date(t.createdAt).toLocaleDateString('id-ID') + '</span></div>' + (t.proofImage ? '<img src="' + t.proofImage + '" alt="Bukti" style="max-width:100%; max-height:100px; border-radius:6px; margin-top:6px; cursor:pointer;" onclick="window.open(this.src)">' : '<div style="font-size:9px; color:var(--err); margin-top:4px;">Belum upload bukti</div>') + '<div style="display:flex; gap:4px; margin-top:6px; padding-top:6px; border-top:1px solid var(--line);">' + ((t.status === 'pending' || t.status === 'process') ? '<button onclick="confirmTransaction(\\'' + t.transactionId + '\\', \\'success\\')" class="btn btn-ok btn-xs" style="flex:1;">✓ Konfirmasi</button><button onclick="confirmTransaction(\\'' + t.transactionId + '\\', \\'failed\\')" class="btn btn-err btn-xs" style="flex:1;">✗ Tolak</button>' : '') + '<button onclick="deleteTransaction(\\'' + t.transactionId + '\\')" class="btn btn-ghost btn-xs">🗑</button></div></div>';
      }).join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Belum ada</p>';
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>'; }
}

async function confirmTransaction(transactionId, status) {
  const note = prompt('Catatan admin (opsional):') || '';
  try {
    const res = await fetch('/api/admin/transaction/confirm', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, transactionId, status, adminNote: note }) });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadAdminTransactions(); loadAllUsers(); }
    else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

async function deleteTransaction(transactionId) {
  if (!confirm('Hapus transaksi?')) return;
  try {
    const res = await fetch('/api/admin/transaction/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, transactionId }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); loadAdminTransactions(); }
  } catch(e) {}
}

async function handleChangePassword() {
  const oldPassword = document.getElementById('old-password-input').value;
  const newPassword = document.getElementById('new-password-input').value;
  const confirmPassword = document.getElementById('confirm-password-input').value;
  if (!oldPassword || !newPassword || !confirmPassword) return showToast('Semua field wajib!', 'error');
  if (newPassword.length < 4) return showToast('Min 4 karakter!', 'error');
  if (newPassword !== confirmPassword) return showToast('Konfirmasi tidak cocok!', 'error');
  try {
    const res = await fetch('/api/user/change-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, oldPassword, newPassword }) });
    const data = await res.json();
    if (data.success) {
      showToast('Password diubah!', 'success');
      document.getElementById('old-password-input').value = '';
      document.getElementById('new-password-input').value = '';
      document.getElementById('confirm-password-input').value = '';
    } else showToast(data.message || 'Gagal', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

async function triggerUpdateUsername() {
  const newUsername = document.getElementById('new-username-input').value.trim();
  if (!newUsername) return showToast('Masukkan username baru!', 'error');
  try {
    const response = await fetch('/api/user/username', { method:'PUT', headers:{'Content-Type':'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '')}, body: JSON.stringify({ currentUsername: loggedInUsername, newUsername }) });
    const result = await response.json();
    if (response.ok && result.success) {
      showToast('Username diubah!', 'success');
      loggedInUsername = result.newUsername;
      if (result.token) localStorage.setItem('authToken', result.token);
      localStorage.setItem('savedUsername', loggedInUsername);
      document.getElementById('logged-username').innerText = loggedInUsername;
      document.getElementById('profile-uname').innerText = loggedInUsername;
      document.getElementById('drawer-username').innerText = loggedInUsername;
      document.getElementById('new-username-input').value = '';
    } else showToast(result.message || 'Gagal', 'error');
  } catch (e) { showToast('Kesalahan jaringan', 'error'); }
}

async function loadVerifiedEmails(force = false) {
  if (!loggedInUsername) return;
  const now = Date.now();
  if (!force && now - lastEmailsFetch < CACHE_DURATION.emails) { const cached = getCached('verifiedEmails'); if (cached) { renderVerifiedEmails(cached); return; } }
  try {
    const res = await fetch('/api/user/my-emails?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (!data.success) return;
    lastEmailsFetch = now; setCache('verifiedEmails', data, CACHE_DURATION.emails); renderVerifiedEmails(data);
  } catch (e) {}
}

function renderVerifiedEmails(data) {
  updateQuotaStatusCard(data);
  handleCountdown(data);
  updateNetflixQuotaDisplay();
}

function updateQuotaStatusCard(data) {
  const total = data.totalQuota || BASE_QUOTA;
  const used = data.usedQuota || 0;
  userQuotaData = { usedQuota: used, bonusQuota: data.bonusQuota || 0, totalQuota: total, nextResetTime: data.nextResetTime || 0, lastResetTime: data.lastResetTime || 0 };
}

function handleCountdown(data) {
  const countdownCard = document.getElementById('reset-countdown-card');
  const resetBannerMain = document.getElementById('reset-banner-main');
  const total = data.totalQuota || BASE_QUOTA;
  const used = data.usedQuota || 0;
  const remain = Math.max(0, total - used);
  if (quotaCountdownInterval) { clearInterval(quotaCountdownInterval); quotaCountdownInterval = null; }
  if (globalCountdownInterval) { clearInterval(globalCountdownInterval); globalCountdownInterval = null; }
  if (countdownCard) countdownCard.classList.add('hide');
  if (resetBannerMain) resetBannerMain.classList.add('hide');
  updateResetTimerDisplay(data);
  const shouldShow = remain <= 0 && !data.isAdmin && !data.isVip && data.nextResetTime > 0;
  if (!shouldShow) return;
  if (countdownCard) countdownCard.classList.remove('hide');
  if (resetBannerMain) resetBannerMain.classList.remove('hide');
  userQuotaData = { usedQuota: used, bonusQuota: data.bonusQuota || 0, totalQuota: total, nextResetTime: data.nextResetTime, lastResetTime: data.lastResetTime };
  const nextResetDate = new Date(data.nextResetTime);
  const timeStr = nextResetDate.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const nextResetEl = document.getElementById('next-reset-time');
  if (nextResetEl) nextResetEl.innerText = timeStr;
  const totalDuration = data.nextResetTime - data.lastResetTime;
  function tick() {
    if (!isPageVisible) return;
    const now = Date.now();
    const msLeft = userQuotaData.nextResetTime - now;
    if (msLeft <= 0) {
      clearInterval(quotaCountdownInterval); quotaCountdownInterval = null;
      ['countdown-hours','countdown-minutes','countdown-seconds','cd-hours-main','cd-minutes-main','cd-seconds-main'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '00'; });
      showToast('🎉 Kuota direset!', 'success', 5000);
      setTimeout(() => { loadVerifiedEmails(true); checkSavedSession(); }, 2000);
      return;
    }
    const hh = String(Math.floor(msLeft / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((msLeft % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0');
    ['countdown-hours','cd-hours-main'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = hh; });
    ['countdown-minutes','cd-minutes-main'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = mm; });
    ['countdown-seconds','cd-seconds-main'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = ss; });
  }
  tick(); quotaCountdownInterval = setInterval(tick, 1000);
}

function updateResetTimerDisplay(data) {
  const total = data.totalQuota || BASE_QUOTA;
  const used = data.usedQuota || 0;
  const remain = Math.max(0, total - used);
  const el = document.getElementById('reset-timer-display');
  if (!el) return;
  if (data.isAdmin || data.isVip) { el.innerText = '∞'; el.style.color = 'var(--accent)'; return; }
  if (remain > 0) { el.innerText = '24 Jam'; el.style.color = 'white'; return; }
  if (globalCountdownInterval) clearInterval(globalCountdownInterval);
  function updateStatCard() {
    if (!isPageVisible) return;
    const now = Date.now();
    const msLeft = data.nextResetTime - now;
    if (msLeft <= 0) { clearInterval(globalCountdownInterval); globalCountdownInterval = null; el.innerText = 'Reset!'; return; }
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    el.innerText = h + 'j ' + m + 'm'; el.style.color = 'var(--err)';
  }
  updateStatCard(); globalCountdownInterval = setInterval(updateStatCard, 60000);
}

function initFileDrop() {
  const dropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('admin-video-file');
  if (!dropZone || !fileInput) return;
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileSelect(e.dataTransfer.files[0]); } });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
}

function handleFileSelect(file) {
  const info = document.getElementById('file-info');
  const btn = document.getElementById('btn-upload-video');
  if (!file.type.startsWith('video/')) return showToast('Harus video!', 'error');
  if (file.size > 200 * 1024 * 1024) return showToast('Max 200MB', 'error');
  selectedVideoFile = file;
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  info.innerText = '📁 ' + file.name + ' (' + sizeMB + ' MB)';
  info.classList.remove('hide'); btn.disabled = false;
  showToast('Video siap: ' + sizeMB + 'MB', 'info');
}

async function handleUploadVideo() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  if (!selectedVideoFile) return showToast('Pilih video!', 'error');
  const file = selectedVideoFile;
  const CHUNK_SIZE = 512 * 1024;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const progressContainer = document.getElementById('upload-progress-container');
  const progressFill = document.getElementById('upload-progress-fill');
  const percentText = document.getElementById('upload-percent');
  const statusText = document.getElementById('upload-status-text');
  const speedText = document.getElementById('upload-speed');
  const btn = document.getElementById('btn-upload-video');
  const btnText = document.getElementById('btn-upload-text');
  progressContainer.classList.remove('hide'); btn.disabled = true; btnText.innerText = 'Mengunggah...';
  const startTime = Date.now();
  let uploadedBytes = 0;
  try {
    statusText.innerText = 'Memulai...';
    const initRes = await fetch('/api/admin/upload-init', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, uploadId, filename: file.name, totalChunks, fileSize: file.size, fileType: file.type }) });
    const initData = await initRes.json();
    if (!initData.success) throw new Error(initData.message || 'Gagal init');
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkBase64 = await blobToBase64(chunk);
      statusText.innerText = 'Chunk ' + (i+1) + '/' + totalChunks;
      const chunkRes = await fetch('/api/admin/upload-chunk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, uploadId, chunkIndex: i, chunkData: chunkBase64 }) });
      const chunkData = await chunkRes.json();
      if (!chunkData.success) throw new Error(chunkData.message || 'Gagal chunk ' + i);
      uploadedBytes += chunk.size;
      const percent = Math.round((uploadedBytes / file.size) * 100);
      progressFill.style.width = percent + '%';
      percentText.innerText = percent + '%';
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = (uploadedBytes / 1024 / 1024) / elapsed;
      speedText.innerText = '⚡ ' + speed.toFixed(2) + ' MB/s • ' + (uploadedBytes/1024/1024).toFixed(2) + '/' + (file.size/1024/1024).toFixed(2) + ' MB';
    }
    statusText.innerText = 'Finalizing...';
    const finalRes = await fetch('/api/admin/upload-finalize', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, uploadId }) });
    const finalData = await finalRes.json();
    if (!finalData.success) throw new Error(finalData.message || 'Gagal finalize');
    progressFill.style.width = '100%'; percentText.innerText = '100%';
    statusText.innerText = '✓ Berhasil!'; speedText.innerText = 'Waktu: ' + ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    showToast('Video diperbarui!', 'success');
    selectedVideoFile = null;
    document.getElementById('admin-video-file').value = '';
    document.getElementById('file-info').classList.add('hide');
    fetchFeaturedVideo(true);
    setTimeout(() => { progressContainer.classList.add('hide'); progressFill.style.width = '0%'; }, 2500);
  } catch (err) {
    showToast('Upload gagal: ' + err.message, 'error');
    statusText.innerText = '✗ Gagal'; progressFill.style.background = 'var(--err)';
  } finally { btn.disabled = false; btnText.innerText = 'Upload Video'; }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function updateQuotaDisplay(data) {
  if (data.isAdmin || data.isVip) document.getElementById('quota-display').innerText = '∞';
  else { const total = data.totalQuota || BASE_QUOTA + (data.bonusQuota || 0); document.getElementById('quota-display').innerText = (data.usedQuota || 0) + '/' + total; }
}
function checkVipStatus(data) {
  const banner = document.getElementById('vip-status-banner');
  if (data.isVip && !data.isAdmin) { banner.classList.remove('hide'); document.getElementById('vip-expiry-text').innerText = 'Aktif hingga: ' + new Date(data.vipUntil).toLocaleString('id-ID'); }
  else banner.classList.add('hide');
}

async function changeServerState(newState) {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/admin/set-status', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: newState, username: loggedInUsername }) });
    const data = await res.json();
    if (data.success) { updateStatusUI(newState); serverOnline = (newState === 'online'); setCache('serverStatus', newState, CACHE_DURATION.status); showToast('Server: ' + newState.toUpperCase(), 'success'); }
  } catch(e) { showToast('Gagal', 'error'); }
}

async function handleSetVip() {
  if (!isAdminUser) return;
  const targetUser = document.getElementById('vip-target-user').value.trim();
  const days = parseInt(document.getElementById('vip-duration-days').value);
  if (!targetUser || isNaN(days)) return showToast('Lengkapi!', 'error');
  try {
    const res = await fetch('/api/admin/set-vip', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, targetUser, days }) });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); document.getElementById('vip-target-user').value = ''; document.getElementById('vip-duration-days').value = ''; loadAdminVipList(); loadAllUsers(); }
    else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

async function loadAdminVipList() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/admin/get-vip-list?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    const container = document.getElementById('admin-vip-list');
    if (data.success && Object.keys(data.vipUsers).length > 0) {
      container.innerHTML = Object.entries(data.vipUsers).map(([uname, val]) => '<div style="display:flex; justify-content:space-between; align-items:center; padding:7px 9px; background:var(--bg-0); border:1px solid rgba(251,191,36,0.2); border-radius:6px;"><div><span style="color:var(--warn); font-weight:700;">' + uname + '</span><span style="color:var(--text-2); display:block; font-size:9px;">Exp: ' + new Date(val.vipUntil).toLocaleDateString('id-ID') + '</span></div><button onclick="handleRemoveVip(\\'' + uname + '\\')" class="btn btn-ghost btn-xs" style="color:var(--err);">Hapus</button></div>').join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Tidak ada</p>';
  } catch(e) {}
}

async function handleRemoveVip(targetUser) {
  if (!confirm('Cabut VIP untuk ' + targetUser + '?')) return;
  try {
    const res = await fetch('/api/admin/remove-vip', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, targetUser }) });
    const data = await res.json();
    if (data.success) { showToast('Dicabut', 'success'); loadAdminVipList(); loadAllUsers(); }
  } catch(e) {}
}

async function handleCreateVipAccount() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  const vipUsername = document.getElementById('vip-create-username').value.trim().toLowerCase();
  const vipPassword = document.getElementById('vip-create-password').value.trim();
  const vipDays = parseInt(document.getElementById('vip-create-days').value);
  if (!vipUsername || !vipPassword || isNaN(vipDays)) return showToast('Lengkapi!', 'error');
  if (vipPassword.length < 4) return showToast('Pass min 4!', 'error');
  if (vipDays < 1) return showToast('Min 1 hari!', 'error');
  try {
    const res = await fetch('/api/admin/create-vip-account', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, vipUsername, vipPassword, vipDays }) });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('vip-create-username').value = '';
      document.getElementById('vip-create-password').value = '';
      document.getElementById('vip-create-days').value = '';
      loadVipAccounts(); loadAllUsers();
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

async function loadVipAccounts() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/admin/get-vip-accounts?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    const container = document.getElementById('vip-accounts-list');
    if (data.success && Object.keys(data.vipAccounts).length > 0) {
      const now = Date.now();
      container.innerHTML = Object.entries(data.vipAccounts).map(([uname, val]) => {
        const isActive = val.vipUntil > now;
        return '<div style="padding:9px 11px; background:linear-gradient(135deg,var(--warn-soft),var(--accent-soft)); border:1px solid rgba(251,191,36,0.3); border-radius:8px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="flex:1; min-width:0;"><div class="mono" style="font-size:11px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(uname) + '</div><div class="mono" style="font-size:10px; color:var(--text-2);">Pwd: ' + escapeHtml(val.password) + '</div></div><span class="badge ' + (isActive ? 'badge-ok' : 'badge-err') + '">' + (isActive ? 'AKTIF' : 'EXPIRED') + '</span></div><div style="display:flex; justify-content:space-between; align-items:center; font-size:10px;"><span style="color:var(--warn);">⭐ s/d ' + new Date(val.vipUntil).toLocaleDateString('id-ID') + '</span><div style="display:flex; gap:3px;"><button onclick="copyVipCredentials(\\'' + escapeHtml(uname) + '\\', \\'' + escapeHtml(val.password) + '\\')" class="btn btn-ghost btn-xs">📋</button><button onclick="deleteVipAccount(\\'' + escapeHtml(uname) + '\\')" class="btn btn-ghost btn-xs" style="color:var(--err);">🗑</button></div></div></div>';
      }).join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Belum ada</p>';
  } catch(e) {}
}

function copyVipCredentials(username, password) {
  const text = 'Username: ' + username + '\\nPassword: ' + password;
  navigator.clipboard.writeText(text).then(() => showToast('Tersalin!', 'success'));
}

async function deleteVipAccount(vipUsername) {
  if (!confirm('Hapus akun VIP ' + vipUsername + '?')) return;
  try {
    const res = await fetch('/api/admin/delete-vip-account', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, vipUsername }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); loadVipAccounts(); loadAllUsers(); }
    else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

async function loadAllUsers() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  const container = document.getElementById('all-users-list');
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">⏳ Memuat...</p>';
  try {
    const res = await fetch('/api/admin/get-all-users?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (!data.success) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal: ' + (data.message || 'Error') + '</p>'; return; }
    cachedUserList = data.users || [];
    document.getElementById('stat-total').innerText = data.stats.total;
    document.getElementById('stat-admins').innerText = data.stats.admins;
    document.getElementById('stat-vips').innerText = data.stats.vips;
    document.getElementById('stat-reset').innerText = data.stats.resetDue;
    renderUserList();
    showToast('Loaded ' + data.stats.total + ' user', 'success');
  } catch (e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Kesalahan koneksi</p>'; }
}

function setUserFilter(filter) {
  currentUserFilter = filter;
  document.querySelectorAll('.user-filter-btn').forEach(btn => {
    const isActive = btn.dataset.filter === filter;
    btn.style.background = isActive ? 'var(--accent)' : '';
    btn.style.color = isActive ? 'white' : '';
  });
  renderUserList();
}

function filterUserList() { renderUserList(); }

function renderUserList() {
  const container = document.getElementById('all-users-list');
  const search = (document.getElementById('user-search-input').value || '').toLowerCase().trim();
  let filtered = cachedUserList.filter(u => {
    if (currentUserFilter === 'admin' && !u.isAdmin) return false;
    if (currentUserFilter === 'vip' && !u.isVip) return false;
    if (currentUserFilter === 'regular' && (u.isAdmin || u.isVip)) return false;
    if (currentUserFilter === 'reset' && !u.isResetDue) return false;
    if (search) return u.username.toLowerCase().includes(search) || (u.email && u.email.toLowerCase().includes(search));
    return true;
  });
  if (filtered.length === 0) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Tidak ada</p>'; return; }
  const now = Date.now();
  container.innerHTML = filtered.map(u => {
    let badgeClass = 'badge-muted', badgeText = '👤 User', borderColor = 'var(--line-2)';
    if (u.isAdmin) { badgeClass = 'badge-warn'; badgeText = '👑 Admin'; borderColor = 'rgba(251,191,36,0.4)'; }
    else if (u.isVip) { badgeClass = 'badge-accent'; badgeText = '⭐ VIP'; borderColor = 'rgba(139,124,246,0.45)'; }
    let quotaText = '', quotaColor = 'var(--info)';
    if (u.isAdmin) { quotaText = '∞ Unlimited'; quotaColor = 'var(--warn)'; }
    else if (u.isVip) { quotaText = '⭐ Unlimited'; quotaColor = 'var(--accent)'; }
    else { quotaText = u.usedQuota + '/' + u.totalQuota + ' (+' + u.bonusQuota + ')'; quotaColor = u.usedQuota >= u.totalQuota ? 'var(--err)' : 'var(--info)'; }
    let resetText = '';
    if (u.isResetDue) resetText = '🔄 Reset Tersedia';
    else if (u.nextResetTime > now) { const msLeft = u.nextResetTime - now; resetText = '⏱ ' + Math.floor(msLeft / 3600000) + 'j ' + Math.floor((msLeft % 3600000) / 60000) + 'm'; }
    else resetText = '✓ Baru direset';
    let vipText = '';
    if (u.isVip && u.vipUntil) vipText = '⭐ VIP s/d ' + new Date(u.vipUntil).toLocaleDateString('id-ID');
    const safeUser = u.username.replace(/'/g, "\\\\'");
    return '<div style="padding:8px 10px; background:var(--bg-0); border:1px solid ' + borderColor + '; border-radius:7px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:5px;"><div style="flex:1; min-width:0;"><div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;"><span class="mono" style="font-weight:700; color:var(--text-0); font-size:11.5px;">' + escapeHtml(u.username) + '</span><span class="badge ' + badgeClass + '" style="font-size:9px;">' + badgeText + '</span></div><div style="font-size:9.5px; color:var(--text-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;">📧 ' + escapeHtml(u.email) + '</div></div></div><div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:9.5px;"><div style="padding:5px; background:var(--info-soft); border-radius:5px;"><div style="color:var(--text-2); font-size:8px; text-transform:uppercase; font-weight:700;">Kuota</div><div class="mono" style="color:' + quotaColor + '; font-weight:700;">' + quotaText + '</div></div><div style="padding:5px; background:var(--accent-soft); border-radius:5px;"><div style="color:var(--text-2); font-size:8px; text-transform:uppercase; font-weight:700;">Reset</div><div class="mono" style="color:var(--accent); font-weight:700;">' + resetText + '</div></div></div>' + (vipText ? '<div style="font-size:9.5px; color:var(--warn); margin-top:5px; font-weight:600;">' + vipText + '</div>' : '') + (u.activatedEmails && u.activatedEmails.length > 0 ? '<details style="margin-top:5px;"><summary style="font-size:9.5px; color:var(--info); cursor:pointer;">📨 ' + u.activatedEmails.length + ' email</summary><div style="margin-top:3px; padding-left:6px;">' + u.activatedEmails.slice(0, 10).map(e => '<div class="mono" style="font-size:9px; color:var(--text-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">• ' + escapeHtml(e) + '</div>').join('') + (u.activatedEmails.length > 10 ? '<div style="font-size:9px; color:var(--text-2); font-style:italic;">... +' + (u.activatedEmails.length - 10) + '</div>' : '') + '</div></details>' : '') + '<div style="display:flex; gap:4px; margin-top:6px; padding-top:6px; border-top:1px solid var(--line);"><button onclick="quickSetVip(\\'' + safeUser + '\\')" class="btn btn-ghost btn-xs" style="flex:1;">⭐ VIP</button><button onclick="copyUsername(\\'' + safeUser + '\\')" class="btn btn-ghost btn-xs" style="flex:1;">📋 Copy</button>' + (u.isAdmin && u.username === loggedInUsername ? '' : '<button onclick="deleteUserAccount(\\'' + safeUser + '\\', ' + (u.isAdmin ? 'true' : 'false') + ')" class="btn btn-ghost btn-xs" style="flex:1; color:var(--err);">🗑 Hapus</button>') + '</div></div>';
  }).join('');
}

async function deleteUserAccount(targetUsername, isTargetAdmin) {
  const confirmText = isTargetAdmin ? '⚠️ HAPUS ADMIN "' + targetUsername + '"?\\n\\nPermanen!' : 'Hapus akun "' + targetUsername + '"?';
  if (!confirm(confirmText)) return;
  if (isTargetAdmin) { const second = prompt('Ketik "HAPUS" untuk konfirmasi:'); if (second !== 'HAPUS') { showToast('Dibatalkan', 'info'); return; } }
  try {
    const res = await fetch('/api/admin/delete-user', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, targetUsername }) });
    const data = await res.json();
    if (data.success) { showToast('Akun dihapus!', 'success'); loadAllUsers(); }
    else showToast(data.message || 'Gagal', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

function quickSetVip(username) {
  document.getElementById('vip-target-user').value = username;
  document.getElementById('vip-duration-days').focus();
  showToast('Username siap: ' + username, 'info');
  document.getElementById('vip-target-user').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function copyUsername(username) { navigator.clipboard.writeText(username).then(() => showToast('Tersalin!', 'success')); }

function updateChatBadge() {
  const badge = document.getElementById('chat-unread-badge');
  if (unreadChatCount > 0) { badge.textContent = unreadChatCount > 99 ? '99+' : unreadChatCount; badge.classList.remove('hide'); }
  else badge.classList.add('hide');
}

async function checkNewChatMessages() {
  if (!loggedInUsername || !isPageVisible) return;
  const now = Date.now();
  if (now - lastChatFetch < CACHE_DURATION.chat) return;
  try {
    const res = await fetch('/api/chat/messages');
    const data = await res.json();
    if (data.success && data.messages) {
      const entries = Object.entries(data.messages).sort((a,b) => a[1].timestamp - b[1].timestamp);
      if (entries.length > 0) {
        const latestId = entries[entries.length - 1][0];
        if (lastChatMessageId && latestId !== lastChatMessageId && entries[entries.length-1][1].username !== loggedInUsername) { unreadChatCount++; updateChatBadge(); }
        lastChatMessageId = latestId; lastChatFetch = now;
      }
    }
  } catch(e) {}
}

async function loadGlobalChat(force = false) {
  if (!loggedInUsername || !isPageVisible) return;
  const now = Date.now();
  if (!force && now - lastChatFetch < CACHE_DURATION.chat) { const cached = getCached('globalChat'); if (cached) { renderGlobalChat(cached); return; } }
  const container = document.getElementById('chat-messages');
  try {
    const res = await fetch('/api/chat/messages');
    const data = await res.json();
    lastChatFetch = now; setCache('globalChat', data, CACHE_DURATION.chat); renderGlobalChat(data);
  } catch(e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:12px;">Gagal</p>'; }
}

function renderChatReactions(id, msg) {
  const me = String(loggedInUsername || '').toLowerCase();
  const reactions = msg.reactions || {};
  let chips = '';
  Object.keys(CHAT_REACT_MAP).forEach(k => {
    const users = reactions[k] ? Object.keys(reactions[k]) : [];
    if (users.length > 0) {
      const mine = users.indexOf(me) !== -1;
      chips += '<button class="react-chip' + (mine ? ' mine' : '') + '" data-id="' + id + '" data-k="' + k + '" onclick="reactChatMessage(this.dataset.id,this.dataset.k)">' + CHAT_REACT_MAP[k] + ' ' + users.length + '</button>';
    }
  });
  const addBtn = '<button class="react-chip react-add" data-id="' + id + '" onclick="toggleReactPicker(this.dataset.id)">😊 +</button>';
  let picker = '';
  if (openReactPickerId === id) {
    picker = '<div class="react-picker">' + Object.keys(CHAT_REACT_MAP).map(k => '<button class="react-pick" data-id="' + id + '" data-k="' + k + '" onclick="reactChatMessage(this.dataset.id,this.dataset.k)">' + CHAT_REACT_MAP[k] + '</button>').join('') + '</div>';
  }
  return '<div class="chat-reacts">' + chips + addBtn + '</div>' + picker;
}

function renderChatPoll(id, msg) {
  const me = String(loggedInUsername || '').toLowerCase();
  const poll = msg.poll || {};
  const opts = Array.isArray(poll.options) ? poll.options : Object.values(poll.options || {});
  const votes = msg.votes || {};
  const voters = Object.keys(votes);
  const total = voters.length;
  const counts = opts.map(() => 0);
  voters.forEach(u => { const v = votes[u]; if (typeof v === 'number' && counts[v] !== undefined) counts[v]++; });
  const myVote = votes[me];
  const closed = !!poll.closed;
  let html = '<div class="poll-title">📊 ' + escapeHtml(poll.question || '') + '</div>';
  html += '<div class="poll-meta">' + (closed ? '🔒 Polling sudah ditutup' : '🟢 Polling aktif - pilih satu jawaban (bisa diganti)') + '</div>';
  opts.forEach((opt, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const chosen = myVote === i;
    html += '<button class="poll-opt' + (chosen ? ' chosen' : '') + '"' + (closed ? ' disabled' : '') + ' data-id="' + id + '" data-i="' + i + '" onclick="voteChatPoll(this.dataset.id,Number(this.dataset.i))"><span class="poll-fill" style="width:' + pct + '%"></span><span class="poll-opt-text">' + (chosen ? '✅ ' : '') + escapeHtml(String(opt)) + '</span><span class="poll-opt-count">' + counts[i] + ' suara · ' + pct + '%</span></button>';
  });
  html += '<div class="poll-meta">' + total + ' suara' + (myVote === undefined ? '' : ' · kamu sudah memilih') + '</div>';
  if (isAdminUser) html += '<button class="poll-admin-btn" data-id="' + id + '" onclick="toggleChatPoll(this.dataset.id)">' + (closed ? '🔓 Buka polling lagi' : '🔒 Tutup polling') + '</button>';
  return html;
}

function renderGlobalChat(data) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const pollBtn = document.getElementById('chat-poll-btn');
  if (pollBtn) pollBtn.classList.toggle('hide', !isAdminUser);
  if (!data.success || !data.messages) { container.innerHTML = '<p style="font-size:12px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada</p>'; return; }
  const entries = Object.entries(data.messages).sort((a,b) => a[1].timestamp - b[1].timestamp);
  if (entries.length === 0) { container.innerHTML = '<p style="font-size:12px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada. Jadilah yang pertama!</p>'; return; }
  lastChatMessageId = entries[entries.length - 1][0];
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  const prevTop = container.scrollTop;
  container.innerHTML = entries.map(([id, msg]) => {
    const isPoll = msg.type === 'poll' && !!msg.poll;
    const isMe = msg.username === loggedInUsername;
    const isAdmin = msg.isAdmin;
    const isVip = msg.isVip;
    const bubbleClass = isPoll ? 'chat-msg-poll' : (isMe ? 'chat-msg-me' : 'chat-msg-them');
    const roleIcon = isAdmin ? '👑 ' : isVip ? '⭐ ' : '👤 ';
    const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const isToday = new Date(msg.timestamp).toDateString() === new Date().toDateString();
    const timeStr = isToday ? time : date + ' ' + time;
    const deleteBtn = isAdminUser ? ' <button data-id="' + id + '" onclick="deleteChatMessage(this.dataset.id)" style="background:none; border:none; font-size:12px; opacity:0.6; cursor:pointer; margin-left:2px;">🗑</button>' : '';
    const bodyHtml = isPoll ? renderChatPoll(id, msg) : '<div>' + escapeHtml(msg.message) + '</div>';
    return '<div class="chat-msg ' + bubbleClass + '"><div class="chat-msg-header">' + roleIcon + '<span>' + escapeHtml(msg.username) + '</span>' + (isAdmin ? ' · ADMIN' : '') + (isVip && !isAdmin ? ' · VIP' : '') + deleteBtn + '</div>' + bodyHtml + renderChatReactions(id, msg) + '<div class="chat-time">' + timeStr + '</div></div>';
  }).join('');
  if (wasAtBottom || prevTop === 0) container.scrollTop = container.scrollHeight;
  else container.scrollTop = prevTop;
  updateOnlineCount(onlineUsersCount);
}

async function sendChatMessage() {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  try {
    const res = await fetch('/api/chat/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, message }) });
    const data = await res.json();
    if (data.success) { lastChatFetch = 0; await loadGlobalChat(true); }
    else { showToast(data.message || 'Gagal', 'error'); input.value = message; }
  } catch(e) { showToast('Kesalahan koneksi', 'error'); input.value = message; }
}

async function deleteChatMessage(messageId) {
  if (!isAdminUser) return;
  if (!confirm('Hapus pesan?')) return;
  try {
    const res = await fetch('/api/chat/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, messageId }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); lastChatFetch = 0; loadGlobalChat(true); }
  } catch(e) {}
}

function toggleReactPicker(id) {
  openReactPickerId = (openReactPickerId === id) ? null : id;
  const cached = getCached('globalChat');
  if (cached) renderGlobalChat(cached); else loadGlobalChat(true);
}

async function reactChatMessage(messageId, reaction) {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  openReactPickerId = null;
  try {
    const res = await fetch('/api/chat/react', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, messageId, reaction }) });
    const data = await res.json();
    if (data.success) { lastChatFetch = 0; await loadGlobalChat(true); }
    else showToast(data.message || 'Gagal memberi reaksi', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

function toggleChatPollForm() {
  if (!isAdminUser) return;
  const f = document.getElementById('chat-poll-form');
  if (f) f.classList.toggle('hide');
}

async function submitChatPoll() {
  if (!isAdminUser) return showToast('Hanya admin yang bisa membuat polling!', 'error');
  const question = document.getElementById('chat-poll-question').value.trim();
  const options = Array.prototype.map.call(document.querySelectorAll('.chat-poll-opt'), el => el.value.trim()).filter(Boolean);
  if (!question) return showToast('Pertanyaan polling wajib diisi!', 'error');
  if (options.length < 2) return showToast('Minimal 2 pilihan jawaban!', 'error');
  try {
    const res = await fetch('/api/chat/poll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, question, options }) });
    const data = await res.json();
    if (data.success) {
      showToast('Polling terkirim!', 'success');
      document.getElementById('chat-poll-question').value = '';
      document.querySelectorAll('.chat-poll-opt').forEach(el => { el.value = ''; });
      document.getElementById('chat-poll-form').classList.add('hide');
      lastChatFetch = 0; await loadGlobalChat(true);
      const c = document.getElementById('chat-messages'); if (c) c.scrollTop = c.scrollHeight;
    } else showToast(data.message || 'Gagal mengirim polling', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

async function voteChatPoll(messageId, optionIndex) {
  if (!loggedInUsername) return showToast('Harus login!', 'error');
  try {
    const res = await fetch('/api/chat/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, messageId, optionIndex }) });
    const data = await res.json();
    if (data.success) { showToast('Jawabanmu tersimpan!', 'success'); lastChatFetch = 0; await loadGlobalChat(true); }
    else showToast(data.message || 'Gagal menyimpan jawaban', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

async function toggleChatPoll(messageId) {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/chat/poll-close', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ adminUsername: loggedInUsername, messageId }) });
    const data = await res.json();
    if (data.success) { showToast(data.message || 'Berhasil', 'success'); lastChatFetch = 0; await loadGlobalChat(true); }
    else showToast(data.message || 'Gagal', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

async function loadUserAnnouncements(force = false) {
  const now = Date.now();
  if (!force && now - lastAnnouncementsFetch < CACHE_DURATION.announcements) { const cached = getCached('userAnnouncements'); if (cached) { renderUserAnnouncements(cached); return; } }
  try {
    const res = await fetch('/api/announcements');
    const data = await res.json();
    lastAnnouncementsFetch = now; setCache('userAnnouncements', data, CACHE_DURATION.announcements); renderUserAnnouncements(data);
  } catch(e) {}
}

function renderUserAnnouncements(data) {
  const container = document.getElementById('user-announcement-container');
  if (!container) return;
  if (data.success && Object.keys(data.announcements).length > 0) {
    const entries = Object.entries(data.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
    container.innerHTML = entries.map(([id, val]) => '<div style="padding:11px 13px; background:var(--accent-soft); border:1px solid rgba(139,124,246,0.2); border-radius:9px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div style="font-size:11.5px; font-weight:700; color:var(--accent);">' + escapeHtml(val.title) + '</div><div class="mono" style="font-size:9px; color:var(--text-2);">' + new Date(val.timestamp).toLocaleDateString('id-ID') + '</div></div><div style="font-size:11px; color:var(--text-1); line-height:1.5; white-space:pre-line;">' + escapeHtml(val.content) + '</div></div>').join('');
  } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada</p>';
}

async function loadAdminAnnouncements() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/announcements');
    const data = await res.json();
    const container = document.getElementById('admin-info-list');
    if (data.success && Object.keys(data.announcements).length > 0) {
      const entries = Object.entries(data.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
      container.innerHTML = entries.map(([id, val]) => '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:var(--bg-0); border:1px solid rgba(251,191,36,0.2); border-radius:6px;"><div style="flex:1; min-width:0;"><span style="color:var(--warn); font-weight:700; font-size:10.5px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(val.title) + '</span></div><div style="display:flex; gap:2px; flex-shrink:0;"><button onclick="editAnnouncement(\\'' + id + '\\', \\'' + encodeURIComponent(val.title) + '\\', \\'' + encodeURIComponent(val.content) + '\\')" class="btn btn-ghost btn-xs">E</button><button onclick="deleteAnnouncement(\\'' + id + '\\')" class="btn btn-ghost btn-xs" style="color:var(--err);">×</button></div></div>').join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Belum ada</p>';
  } catch(e) {}
}

async function handleSaveAnnouncement() {
  if (!isAdminUser) return;
  const id = document.getElementById('info-edit-id').value;
  const title = document.getElementById('info-title').value.trim();
  const content = document.getElementById('info-content').value.trim();
  if (!title || !content) return showToast('Lengkapi!', 'error');
  const endpoint = id ? '/api/admin/update-announcement' : '/api/admin/create-announcement';
  try {
    const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, id, title, content }) });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      resetInfoForm(); loadAdminAnnouncements();
      lastAnnouncementsFetch = 0; loadUserAnnouncements(true);
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal', 'error'); }
}

function editAnnouncement(id, encTitle, encContent) {
  document.getElementById('info-edit-id').value = id;
  document.getElementById('info-title').value = decodeURIComponent(encTitle);
  document.getElementById('info-content').value = decodeURIComponent(encContent);
  document.getElementById('info-submit-btn').innerText = 'Perbarui';
  document.getElementById('info-cancel-btn').classList.remove('hide');
}

function resetInfoForm() {
  document.getElementById('info-edit-id').value = '';
  document.getElementById('info-title').value = '';
  document.getElementById('info-content').value = '';
  document.getElementById('info-submit-btn').innerText = 'Publikasikan';
  document.getElementById('info-cancel-btn').classList.add('hide');
}

async function deleteAnnouncement(id) {
  if (!confirm('Hapus informasi ini?')) return;
  try {
    const res = await fetch('/api/admin/delete-announcement', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, id }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); loadAdminAnnouncements(); lastAnnouncementsFetch = 0; loadUserAnnouncements(true); }
  } catch(e) {}
}

async function handleCreateRedeem() {
  if (!isAdminUser) return;
  const code = document.getElementById('gen-code').value.trim().toUpperCase();
  const quotaPerUser = parseInt(document.getElementById('gen-quota-per-user').value);
  const maxClaims = parseInt(document.getElementById('gen-max-claims').value);
  if (!code || isNaN(quotaPerUser) || isNaN(maxClaims)) return showToast('Lengkapi!', 'error');
  if (quotaPerUser < 1) return showToast('Min 1!', 'error');
  if (maxClaims < 1) return showToast('Min 1!', 'error');
  try {
    const res = await fetch('/api/admin/create-redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, code, quotaPerUser, maxClaims }) });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('gen-code').value = '';
      document.getElementById('gen-quota-per-user').value = '';
      document.getElementById('gen-max-claims').value = '';
      loadAdminRedeems(); lastRedeemsFetch = 0; loadActiveRedeems(true);
    } else showToast(data.message, 'error');
  } catch(e) {}
}

async function loadAdminRedeems() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/admin/get-redeems?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    const container = document.getElementById('admin-redeem-list');
    if (data.success && Object.keys(data.redeems).length > 0) {
      container.innerHTML = Object.entries(data.redeems).map(([code, val]) => '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:var(--bg-0); border:1px solid rgba(251,191,36,0.2); border-radius:6px;"><div><span class="mono" style="color:var(--warn); font-weight:700; font-size:10.5px;">' + code + '</span><span style="color:var(--text-2); display:block; font-size:9px;">' + (val.quotaPerUser || 1) + '/user • ' + val.claimedCount + '/' + val.maxClaims + '</span></div><button onclick="handleDeleteRedeem(\\'' + code + '\\')" class="btn btn-ghost btn-xs" style="color:var(--err);">×</button></div>').join('');
    } else container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:6px; font-style:italic;">Belum ada</p>';
  } catch(e) {}
}

async function handleDeleteRedeem(code) {
  if (!confirm('Hapus kode ' + code + '?')) return;
  try {
    const res = await fetch('/api/admin/delete-redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, code }) });
    const data = await res.json();
    if (data.success) { showToast('Dihapus', 'success'); loadAdminRedeems(); lastRedeemsFetch = 0; loadActiveRedeems(true); }
  } catch(e) {}
}

async function handleSendEmail() {
  const email = document.getElementById('target-email').value.trim();
  if (!email) return showToast('Masukkan email!', 'error');
  if (!guardServerOnline('Alight Motion')) return;
  const btn = document.getElementById('btn-send');
  const sendText = document.getElementById('send-text');
  btn.disabled = true; sendText.innerText = 'Mengirim...';
  const resultBox = document.getElementById('result-box');
  const resultText = document.getElementById('result-text');
  resultBox.classList.remove('hide'); resultText.innerText = '⏳ Memproses...';
  try {
    const res = await fetch('/api/magiclink', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: loggedInUsername, email }) });
    const data = await res.json();
    if (data.success) {
      sendText.innerText = 'Kirim Magic Link';
      currentResultText = JSON.stringify(data.result, null, 2);
      resultText.innerText = currentResultText;
      if (data.orderId) showToast('✅ Order ID: ' + data.orderId, 'order', 5000);
      else showToast('Magic link terkirim!', 'success');
      if (!isAdminUser && data.quotaInfo) updateQuotaDisplay(data.quotaInfo);
      loadVerifiedEmails(true);
    } else {
      sendText.innerText = 'Kirim Magic Link';
      currentResultText = 'Error: ' + data.message;
      resultText.innerText = currentResultText;
      if (data.refilled) showToast(data.message || 'Gagal! Kuota dikembalikan.', 'error', 4000);
      else showToast(data.message, 'error');
      if (data.quotaInfo) updateQuotaDisplay(data.quotaInfo);
      loadVerifiedEmails(true);
    }
  } catch (err) {
    sendText.innerText = 'Kirim Magic Link';
    currentResultText = 'Error: ' + err.message;
    resultText.innerText = currentResultText;
    showToast('Gagal kirim', 'error');
  } finally { btn.disabled = false; }
}

async function handleActivate() {
  const email = document.getElementById('target-email').value;
  const magicUrl = document.getElementById('magic-url').value;
  if (!email || !magicUrl) return showToast('Email & URL wajib!', 'error');
  if (!guardServerOnline('Alight Motion Verifikasi')) return;
  const resultBox = document.getElementById('result-box');
  const resultText = document.getElementById('result-text');
  resultBox.classList.remove('hide'); resultText.innerText = '⏳ Memverifikasi...';
  try {
    const res = await fetch('/api/verif', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, url: magicUrl, username: loggedInUsername }) });
    const data = await res.json();
    currentResultText = JSON.stringify(data, null, 2);
    resultText.innerText = currentResultText;
    if (data.success || !data.error) showToast('Verifikasi selesai!', 'success');
    else showToast(data.error || 'Gagal', 'error');
  } catch (err) {
    currentResultText = 'Error: ' + err.message;
    resultText.innerText = currentResultText;
    showToast('Gagal verifikasi', 'error');
  }
}

function copyResult() {
  if (!currentResultText) return;
  navigator.clipboard.writeText(currentResultText).then(() => showToast('Tersalin!', 'success'));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

async function handleLogout() {
  await markOffline();
  stopOnlineTracking();
  stopNotifPolling();
  if (quotaCountdownInterval) clearInterval(quotaCountdownInterval);
  if (globalCountdownInterval) clearInterval(globalCountdownInterval);
  if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  if (statusPollInterval) clearInterval(statusPollInterval);
  if (videoPollInterval) clearInterval(videoPollInterval);
  localStorage.removeItem('authToken');
  localStorage.removeItem('savedUsername');
  sessionStorage.clear();
  location.reload();
}

initFileDrop();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const drawer = document.getElementById('nav-drawer');
    if (drawer.classList.contains('open')) toggleMenu();
  }
});
</script>
</body>
</html>`;

// ==========================================
// SERVER
// ==========================================
const PORT = Number(process.env.PORT) || 3001;

function jsonResponse(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  if (typeof req._rawBody === 'string') return Promise.resolve(req._rawBody);
  const limit = req._maxBody || 50 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      size += chunk.length;
      if (size > limit) { done = true; reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

// ====== GERBANG AUTENTIKASI ======
// Semua endpoint /api (kecuali login/daftar/lupa password & data publik) wajib membawa token bertanda tangan.
// Identitas (username / adminUsername / currentUsername) wajib sama dengan pemilik token,
// sehingga tidak ada yang bisa menyamar sebagai user lain atau admin.
const PUBLIC_GET = new Set(['/', '/api/status', '/api/video', '/api/announcements', '/api/vip-shop', '/api/redeems/active', '/api/online/count']);
const PUBLIC_POST = new Set(['/api/auth', '/api/auth/forgot', '/api/auth/reset', '/api/auth/session']);

async function authGate(req, res, parsedUrl) {
  const p = parsedUrl.pathname;
  const m = req.method;
  if (m === 'GET' && PUBLIC_GET.has(p)) return true;
  if (m === 'POST' && PUBLIC_POST.has(p)) { req._maxBody = 100 * 1024; return true; }

  const hasBody = m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
  const authH = String(req.headers['authorization'] || '');
  let user = authH.startsWith('Bearer ') ? verifyToken(authH.slice(7).trim()) : null;
  let rawBody;

  // navigator.sendBeacon tidak bisa mengirim header, jadi token dibaca dari body khusus endpoint ini
  if (!user && p === '/api/online/offline' && hasBody) {
    req._maxBody = 10 * 1024;
    rawBody = await readBody(req);
    req._rawBody = rawBody;
    try { user = verifyToken(JSON.parse(rawBody).token); } catch (e) { }
  }

  if (!user) {
    jsonResponse(res, 401, { success: false, needLogin: true, message: 'Sesi tidak valid atau sudah berakhir. Silakan login ulang.' });
    return false;
  }

  if (hasBody && rawBody === undefined) {
    rawBody = await readBody(req);
    req._rawBody = rawBody;
  }

  let parsed = null;
  if (rawBody) { try { parsed = JSON.parse(rawBody); } catch (e) { parsed = null; } }

  const claims = [parsedUrl.searchParams.get('username')];
  if (parsed && typeof parsed === 'object') {
    for (const k of ['username', 'adminUsername', 'currentUsername']) {
      if (parsed[k] !== undefined) claims.push(parsed[k]);
    }
  }
  for (const c of claims) {
    if (c === null || c === undefined) continue;
    if (typeof c !== 'string' || c.toLowerCase() !== user) {
      jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      return false;
    }
  }

  if (parsed && typeof parsed === 'object' && parsed.uploadId !== undefined && !/^[A-Za-z0-9_-]{1,80}$/.test(String(parsed.uploadId))) {
    jsonResponse(res, 400, { success: false, message: 'ID upload tidak valid' });
    return false;
  }

  req.authUser = user;
  return true;
}

// ====== LUPA PASSWORD (KODE VIA EMAIL) ======
// Set di environment: MAIL_USER=emailkamu@gmail.com  MAIL_PASS=<App Password 16 digit Gmail>
const MAIL_USER = process.env.MAIL_USER || '';
const MAIL_PASS = process.env.MAIL_PASS || '';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'AM Premium';
let mailer = null;
try {
  if (MAIL_USER && MAIL_PASS) {
    mailer = require('nodemailer').createTransport({ service: 'gmail', auth: { user: MAIL_USER, pass: MAIL_PASS } });
  } else {
    console.warn('[RESET] MAIL_USER / MAIL_PASS belum diisi, fitur lupa password nonaktif.');
  }
} catch (e) { console.warn('[RESET] nodemailer belum terpasang. Jalankan: npm i nodemailer'); }

const RESET_CODE_TTL = 10 * 60 * 1000;   // kode berlaku 10 menit
const RESET_COOLDOWN = 60 * 1000;        // minta kode lagi minimal 60 detik
const RESET_MAX_ATTEMPTS = 5;            // maksimal salah input kode
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function hashResetCode(code) { return crypto.createHash('sha256').update(String(code)).digest('hex'); }
async function sendResetEmail(to, username, code) {
  if (!mailer) throw new Error('Layanan email belum dikonfigurasi');
  await mailer.sendMail({
    from: '"' + MAIL_FROM_NAME + '" <' + MAIL_USER + '>',
    to,
    subject: 'Kode reset password: ' + code,
    text: 'Halo ' + username + ',\n\nKode reset password kamu: ' + code + '\nBerlaku 10 menit. Jangan bagikan kode ini ke siapa pun.\n\nAbaikan email ini jika kamu tidak memintanya.'
  });
}

const server = http.createServer(async (req, res) => {
  let parsedUrl;
  try { parsedUrl = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  let currentServerStatus = 'online';
  try { currentServerStatus = await getServerStatusFromDb(); } catch (e) { console.error('[STATUS]', e.message); }

  try {
    if (!(await authGate(req, res, parsedUrl))) return;

    if (parsedUrl.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Content-Length': Buffer.byteLength(htmlTemplate)
      });
      res.end(htmlTemplate);

    } else if (parsedUrl.pathname === '/api/status') {
      jsonResponse(res, 200, { status: currentServerStatus });

    } else if (parsedUrl.pathname === '/api/payment-info' && req.method === 'GET') {
      jsonResponse(res, 200, { success: true, danaNumber: DANA_ADMIN_NUMBER, danaName: DANA_ADMIN_NAME });

    } else if (parsedUrl.pathname === '/api/video') {
      const videoUrl = await getVideoFromDb();
      jsonResponse(res, 200, { success: true, videoUrl });

    } else if (parsedUrl.pathname === '/api/announcements') {
      const announcements = await getAllAnnouncementsFromDb();
      jsonResponse(res, 200, { success: true, announcements });

    } else if (parsedUrl.pathname === '/api/vip-shop' && req.method === 'GET') {
      const items = await getVipShopFromDb();
      jsonResponse(res, 200, { success: true, items });

    } else if (parsedUrl.pathname === '/api/notifications/register' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { username, enableAnnouncements, enableChat, enableStatus } = JSON.parse(body);
        if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
        const cleanUser = username.toLowerCase();
        const userObj = await getUserFromDb(cleanUser);
        if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
        await saveNotificationSubscriberToDb(cleanUser, {
          username: cleanUser,
          enableAnnouncements: !!enableAnnouncements,
          enableChat: !!enableChat,
          enableStatus: !!enableStatus,
          registeredAt: Date.now(),
          lastActive: Date.now()
        });
        jsonResponse(res, 200, { success: true, message: 'Notifikasi terdaftar' });
      } catch (e) {
        jsonResponse(res, 500, { success: false, message: e.message });
      }

    } else if (parsedUrl.pathname === '/api/notifications/unregister' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { username } = JSON.parse(body);
        if (!username) return jsonResponse(res, 400, { success: false });
        await removeNotificationSubscriberFromDb(username.toLowerCase());
        jsonResponse(res, 200, { success: true, message: 'Notifikasi dibatalkan' });
      } catch (e) {
        jsonResponse(res, 500, { success: false, message: e.message });
      }

    } else if (parsedUrl.pathname === '/api/online/heartbeat' && req.method === 'POST') {
      const body = await readBody(req);
      const { username } = JSON.parse(body);
      if (!username) return jsonResponse(res, 400, { success: false });
      const cleanUser = username.toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false });
      await checkAndExpireBonusQuota(cleanUser);
      await saveOnlineUserToDb(cleanUser, {
        username: cleanUser,
        lastSeen: Date.now(),
        isAdmin: !!userObj.isAdmin,
        isVip: !!(userObj.vipUntil && userObj.vipUntil > Date.now())
      });
      const onlineUsers = await getOnlineUsersFromDb();
      const now = Date.now();
      let count = 0;
      for (const [u, d] of Object.entries(onlineUsers)) {
        if (now - (d.lastSeen || 0) <= ONLINE_TIMEOUT) count++;
      }
      jsonResponse(res, 200, { success: true, count });

    } else if (parsedUrl.pathname === '/api/online/offline' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { username } = JSON.parse(body);
        if (username) await removeOnlineUserFromDb(username.toLowerCase());
      } catch(e) {}
      jsonResponse(res, 200, { success: true });

    } else if (parsedUrl.pathname === '/api/online/count' && req.method === 'GET') {
      const onlineUsers = await getOnlineUsersFromDb();
      const now = Date.now();
      const active = [];
      for (const [u, d] of Object.entries(onlineUsers)) {
        if (now - (d.lastSeen || 0) <= ONLINE_TIMEOUT) active.push({ username: u, isAdmin: d.isAdmin, isVip: d.isVip, lastSeen: d.lastSeen });
        else await removeOnlineUserFromDb(u);
      }
      jsonResponse(res, 200, { success: true, count: active.length });

    } else if (parsedUrl.pathname === '/api/orders/my' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const cleanUser = username.toLowerCase();
      const allOrdersData = await getOrdersFromDb();
      const myOrdersList = Object.values(allOrdersData).filter(o => o.username === cleanUser).sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      jsonResponse(res, 200, { success: true, orders: myOrdersList });

    } else if (parsedUrl.pathname === '/api/admin/orders' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const allOrdersData = await getOrdersFromDb();
      const orders = Object.values(allOrdersData).sort((a, b) => b.timestamp - a.timestamp).slice(0, 500);
      jsonResponse(res, 200, { success: true, orders });

    } else if (parsedUrl.pathname === '/api/netflix/check-quota' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const cleanUser = username.toLowerCase();
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - (userObj.lastResetTime || now) >= twentyFourHours) { userObj.activatedEmails = []; userObj.lastResetTime = now; await saveUserToDb(cleanUser, userObj); }
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const usedQuota = userObj.activatedEmails ? userObj.activatedEmails.length : 0;
      const totalQuota = (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0);
      if (userObj.isAdmin || isVipActive) return jsonResponse(res, 200, { success: true, allowed: true, message: 'Unlimited', quotaInfo: { usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota } });
      if (usedQuota >= totalQuota) return jsonResponse(res, 200, { success: true, allowed: false, message: 'Quota habis!', quotaInfo: { usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota } });
      jsonResponse(res, 200, { success: true, allowed: true, message: 'Quota tersedia', quotaInfo: { usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota } });

    } else if (parsedUrl.pathname === '/api/netflix/generate' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, plan, useProxy } = JSON.parse(body);
      const cleanUser = username ? username.toLowerCase() : '';
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      if (currentServerStatus !== 'online' && !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Server offline!' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - (userObj.lastResetTime || now) >= twentyFourHours) { userObj.activatedEmails = []; userObj.lastResetTime = now; }
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const usedQuota = userObj.activatedEmails ? userObj.activatedEmails.length : 0;
      const totalQuota = (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0);
      if (!userObj.isAdmin && !isVipActive && usedQuota >= totalQuota) return jsonResponse(res, 403, { success: false, message: 'Quota habis!' });
      const quotaEntry = 'netflix_' + now + '_' + Math.random().toString(36).substring(2, 6);
      if (!userObj.isAdmin && !isVipActive) {
        if (!userObj.activatedEmails) userObj.activatedEmails = [];
        userObj.activatedEmails.push(quotaEntry);
        if (userObj.bonusQuota > 0) { userObj.lastBonusActivity = now; userObj.bonusGrantedAt = userObj.bonusGrantedAt || now; }
        await saveUserToDb(cleanUser, userObj);
      }
      const genResult = await generateNetflixToken(plan || 'premium', useProxy);
      if (!genResult.success) {
        let refilled = false;
        if (!userObj.isAdmin && !isVipActive) refilled = await refillQuotaIfNeeded(cleanUser, quotaEntry);
        const refreshedUser = await getUserFromDb(cleanUser);
        const refreshedUsed = refreshedUser.activatedEmails ? refreshedUser.activatedEmails.length : 0;
        return jsonResponse(res, 500, { success: false, refilled, message: refilled ? 'Generate gagal! Kuota dikembalikan.' : (genResult.error || 'Gagal'), quotaInfo: { usedQuota: refreshedUsed, bonusQuota: userObj.bonusQuota || 0, totalQuota, isAdmin: userObj.isAdmin, isVip: isVipActive } });
      }
      const orderId = generateOrderId('NFLX');
      await saveOrderToDb(orderId, { orderId, username: cleanUser, type: 'netflix', detail: (plan || 'premium').toUpperCase() + ' • ' + (genResult.quality || 'HD') + ' • ' + (genResult.country || 'US'), result: genResult.url, timestamp: now, quotaEntry });
      const historyId = 'nf_' + now + '_' + Math.random().toString(36).substring(2, 8);
      await saveNetflixResultToDb(historyId, { id: historyId, orderId, username: cleanUser, plan: genResult.plan, quality: genResult.quality, country: genResult.country, url: genResult.url, expires: genResult.expires, pool: genResult.pool, timestamp: now });
      jsonResponse(res, 200, { success: true, orderId, result: genResult, quotaInfo: { usedQuota: userObj.isAdmin || isVipActive ? usedQuota : usedQuota + 1, bonusQuota: userObj.bonusQuota || 0, totalQuota, isAdmin: userObj.isAdmin, isVip: isVipActive } });

    } else if (parsedUrl.pathname === '/api/netflix/history' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const cleanUser = username.toLowerCase();
      const allResults = await getNetflixResultsFromDb();
      const myResults = Object.values(allResults).filter(r => r.username === cleanUser).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
      jsonResponse(res, 200, { success: true, results: myResults });

    } else if (parsedUrl.pathname === '/api/hd/check-quota' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const cleanUser = username.toLowerCase();
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - (userObj.lastResetTime || now) >= twentyFourHours) { userObj.activatedEmails = []; userObj.lastResetTime = now; await saveUserToDb(cleanUser, userObj); }
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const usedQuota = userObj.activatedEmails ? userObj.activatedEmails.length : 0;
      const totalQuota = (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0);
      if (userObj.isAdmin || isVipActive) return jsonResponse(res, 200, { success: true, allowed: true, message: 'Unlimited', quotaInfo: { usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota } });
      if (usedQuota >= totalQuota) return jsonResponse(res, 200, { success: true, allowed: false, message: 'Quota habis!', quotaInfo: { usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota } });
      jsonResponse(res, 200, { success: true, allowed: true, message: 'Quota tersedia', quotaInfo: { usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota } });

    } else if (parsedUrl.pathname === '/api/hd/upscale' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, image } = JSON.parse(body);
      const cleanUser = username ? String(username).toLowerCase() : '';
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      if (currentServerStatus !== 'online' && !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Server offline!' });

      const imgMatch = typeof image === 'string' ? image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+\/=]+)$/i) : null;
      if (!imgMatch) return jsonResponse(res, 400, { success: false, message: 'Foto tidak valid! Gunakan JPG, PNG, atau WEBP.' });
      const imgMime = imgMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : imgMatch[1].toLowerCase();
      const imgBuffer = Buffer.from(imgMatch[2], 'base64');
      if (!imgBuffer.length) return jsonResponse(res, 400, { success: false, message: 'Foto kosong!' });
      if (imgBuffer.length > HD_MAX_BYTES) return jsonResponse(res, 400, { success: false, message: 'Ukuran foto terlalu besar (maks 10MB)!' });

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - (userObj.lastResetTime || now) >= twentyFourHours) { userObj.activatedEmails = []; userObj.lastResetTime = now; }
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const usedQuota = userObj.activatedEmails ? userObj.activatedEmails.length : 0;
      const totalQuota = (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0);
      if (!userObj.isAdmin && !isVipActive && usedQuota >= totalQuota) return jsonResponse(res, 403, { success: false, message: 'Quota habis!' });

      const quotaEntry = 'hd_' + now + '_' + Math.random().toString(36).substring(2, 6);
      if (!userObj.isAdmin && !isVipActive) {
        if (!userObj.activatedEmails) userObj.activatedEmails = [];
        userObj.activatedEmails.push(quotaEntry);
        if (userObj.bonusQuota > 0) { userObj.lastBonusActivity = now; userObj.bonusGrantedAt = userObj.bonusGrantedAt || now; }
        await saveUserToDb(cleanUser, userObj);
      }

      let upResult;
      try {
        const ext = imgMime === 'image/png' ? 'png' : imgMime === 'image/webp' ? 'webp' : 'jpg';
        upResult = await upscaleImage(imgBuffer, { contentType: imgMime, filename: 'image.' + ext });
      } catch (upErr) {
        let refilled = false;
        if (!userObj.isAdmin && !isVipActive) refilled = await refillQuotaIfNeeded(cleanUser, quotaEntry);
        const refreshedUser = await getUserFromDb(cleanUser);
        const refreshedUsed = refreshedUser && refreshedUser.activatedEmails ? refreshedUser.activatedEmails.length : 0;
        const errMsg = (upErr && upErr.message) ? upErr.message : String(upErr);
        return jsonResponse(res, 500, { success: false, refilled, message: refilled ? 'HD gagal: ' + errMsg + '. Kuota dikembalikan.' : 'HD gagal: ' + errMsg, quotaInfo: { usedQuota: refreshedUsed, bonusQuota: userObj.bonusQuota || 0, totalQuota, isAdmin: userObj.isAdmin, isVip: isVipActive } });
      }

      const orderId = generateOrderId('HD');
      await saveOrderToDb(orderId, { orderId, username: cleanUser, type: 'hd', detail: 'HD Foto • ' + Math.round(imgBuffer.length / 1024) + 'KB → ' + Math.round(upResult.buffer.length / 1024) + 'KB', result: 'Upscale berhasil', timestamp: now, quotaEntry });
      const afterDataUrl = 'data:' + upResult.contentType + ';base64,' + upResult.buffer.toString('base64');
      jsonResponse(res, 200, { success: true, orderId, before: image, after: afterDataUrl, contentType: upResult.contentType, quotaInfo: { usedQuota: userObj.isAdmin || isVipActive ? usedQuota : usedQuota + 1, bonusQuota: userObj.bonusQuota || 0, totalQuota, isAdmin: userObj.isAdmin, isVip: isVipActive } });

    } else if (parsedUrl.pathname === '/api/apk/build' && req.method === 'POST') {
      const body = await readBody(req);
      const input = JSON.parse(body);
      const cleanUser = input.username ? String(input.username).toLowerCase() : '';
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      if (currentServerStatus !== 'online' && !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Server offline!' });

      const norm = apkNormalizeInput(input);
      if (norm.error) return jsonResponse(res, 400, { success: false, message: norm.error });
      const spec = norm.value;

      if (apkStarting.has(cleanUser) || apkHasActiveJob(cleanUser)) return jsonResponse(res, 429, { success: false, message: 'Masih ada build yang berjalan. Tunggu sampai selesai!' });
      apkStarting.add(cleanUser);
      try {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (now - (userObj.lastResetTime || now) >= twentyFourHours) { userObj.activatedEmails = []; userObj.lastResetTime = now; }
        const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
        const usedQuota = userObj.activatedEmails ? userObj.activatedEmails.length : 0;
        const totalQuota = (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0);
        const charged = !userObj.isAdmin && !isVipActive;
        if (charged && usedQuota >= totalQuota) return jsonResponse(res, 403, { success: false, message: 'Quota habis!' });

        const quotaEntry = 'apk_' + now + '_' + Math.random().toString(36).substring(2, 6);
        if (charged) {
          if (!userObj.activatedEmails) userObj.activatedEmails = [];
          userObj.activatedEmails.push(quotaEntry);
          if (userObj.bonusQuota > 0) { userObj.lastBonusActivity = now; userObj.bonusGrantedAt = userObj.bonusGrantedAt || now; }
          await saveUserToDb(cleanUser, userObj);
        }

        let buildId;
        try {
          const buildPayload = { url: spec.url, appName: spec.appName, packageName: spec.packageName, versionName: spec.versionName, versionCode: spec.versionCode };
          if (spec.icon) buildPayload.iconPng = spec.icon;
          if (spec.permissions.length > 0) {
            buildPayload.permissions = apkAndroidPermissions(spec.permissions);
            buildPayload.requestPermissionsOnLaunch = true;
          }
          const r = await apkApi('POST', '/build', buildPayload);
          if (r.status < 200 || r.status >= 300 || !r.json || !r.json.build_id) throw new Error(apkErrMsg(r, 'Server build tidak merespons dengan benar (HTTP ' + r.status + ')'));
          buildId = String(r.json.build_id);
        } catch (startErr) {
          let refilled = false;
          if (charged) refilled = await refillQuotaIfNeeded(cleanUser, quotaEntry);
          const refreshedUser = await getUserFromDb(cleanUser);
          const refreshedUsed = refreshedUser && refreshedUser.activatedEmails ? refreshedUser.activatedEmails.length : 0;
          const errMsg = (startErr && startErr.message) ? startErr.message : String(startErr);
          return jsonResponse(res, 500, { success: false, refilled, message: refilled ? 'Build gagal dimulai: ' + errMsg + '. Kuota dikembalikan.' : 'Build gagal dimulai: ' + errMsg, quotaInfo: { usedQuota: refreshedUsed, bonusQuota: userObj.bonusQuota || 0, totalQuota, isAdmin: userObj.isAdmin, isVip: isVipActive } });
        }

        const job = {
          buildId, username: cleanUser, appName: spec.appName, packageName: spec.packageName, versionName: spec.versionName,
          versionCode: spec.versionCode, url: spec.url, status: 'building', remoteStatus: 'queued', progress: null,
          downloadUrl: '', error: '', quotaEntry: charged ? quotaEntry : '', charged, refunded: false, orderId: '',
          permissions: spec.permissions, hasIcon: !!spec.icon,
          timestamp: now, finishedAt: 0, finalized: false, monitoring: false
        };
        apkJobs.set(buildId, job);
        await apkSaveJob(job);
        apkMonitor(job).catch(function (e) { console.error('[APK] Monitor error:', e.message); });
        return jsonResponse(res, 200, { success: true, buildId, status: 'building', timestamp: now, quotaInfo: { usedQuota: charged ? usedQuota + 1 : usedQuota, bonusQuota: userObj.bonusQuota || 0, totalQuota, isAdmin: userObj.isAdmin, isVip: isVipActive } });
      } finally {
        apkStarting.delete(cleanUser);
      }

    } else if (parsedUrl.pathname === '/api/apk/status' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const buildId = parsedUrl.searchParams.get('build_id');
      if (!username || !buildId) return jsonResponse(res, 400, { success: false, message: 'Parameter username dan build_id diperlukan' });
      const cleanUser = username.toLowerCase();
      const job = await apkGetJob(buildId);
      if (!job) return jsonResponse(res, 404, { success: false, notFound: true, message: 'Build tidak ditemukan' });
      if (job.username !== cleanUser) {
        const viewer = await getUserFromDb(cleanUser);
        if (!viewer || !viewer.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }
      const out = { success: true, status: job.status, remoteStatus: job.remoteStatus || '', progress: job.progress, message: job.error || '', refilled: !!job.refunded, orderId: job.orderId || '', build: apkPublicBuild(job) };
      if (job.finalized) {
        const owner = await getUserFromDb(job.username);
        if (owner) {
          const ownerVip = owner.vipUntil && owner.vipUntil > Date.now();
          out.quotaInfo = { usedQuota: owner.activatedEmails ? owner.activatedEmails.length : 0, bonusQuota: owner.bonusQuota || 0, totalQuota: (owner.baseQuota || BASE_QUOTA) + (owner.bonusQuota || 0), isAdmin: owner.isAdmin, isVip: ownerVip };
        }
      }
      jsonResponse(res, 200, out);

    } else if (parsedUrl.pathname === '/api/apk/history' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const builds = await apkListUserBuilds(username.toLowerCase());
      jsonResponse(res, 200, { success: true, builds });

    } else if (parsedUrl.pathname === '/api/apk/download' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const buildId = parsedUrl.searchParams.get('build_id');
      if (!username || !buildId) return jsonResponse(res, 400, { success: false, message: 'Parameter username dan build_id diperlukan' });
      const cleanUser = username.toLowerCase();
      const dlUser = await getUserFromDb(cleanUser);
      if (!dlUser) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const job = await apkGetJob(buildId);
      if (!job) return jsonResponse(res, 404, { success: false, message: 'Build tidak ditemukan' });
      if (job.username !== cleanUser && !dlUser.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      if (job.status !== 'ready' || !job.downloadUrl) return jsonResponse(res, 409, { success: false, message: 'APK belum siap diunduh' });
      let fileResp;
      try {
        const dlUrl = new URL(job.downloadUrl, APK_API_BASE + '/');
        if (dlUrl.protocol !== 'http:' && dlUrl.protocol !== 'https:') throw new Error('URL download tidak valid');
        fileResp = await httpRequestBuffer(dlUrl.toString(), { method: 'GET', timeout: 180000 }, 5);
      } catch (dlErr) {
        return jsonResponse(res, 502, { success: false, message: 'Gagal mengambil file APK: ' + ((dlErr && dlErr.message) || dlErr) });
      }
      const fileOk = fileResp.status >= 200 && fileResp.status < 300 && fileResp.body.length > 4 && fileResp.body[0] === 0x50 && fileResp.body[1] === 0x4B;
      if (!fileOk) return jsonResponse(res, 502, { success: false, message: 'File APK tidak tersedia atau sudah kedaluwarsa (HTTP ' + fileResp.status + ')' });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="' + apkFileName(job) + '"',
        'Content-Length': fileResp.body.length,
        'Cache-Control': 'no-store'
      });
      res.end(fileResp.body);

    } else if (parsedUrl.pathname === '/api/transaction/create' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, vipId, vipName, vipPrice, vipDays } = JSON.parse(body);
      const cleanUser = username ? username.toLowerCase() : '';
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const transactionId = 'TRX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      await saveTransactionToDb(transactionId, { transactionId, username: cleanUser, vipId, vipName, vipPrice: parseInt(vipPrice), vipDays: parseInt(vipDays), status: 'pending', proofImage: null, proofFileName: null, createdAt: Date.now(), updatedAt: Date.now(), adminNote: '' });
      jsonResponse(res, 200, { success: true, transactionId, message: 'Pesanan dibuat! Transfer via DANA & upload bukti.' });

    } else if (parsedUrl.pathname === '/api/transaction/upload-proof' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, transactionId, proofImage, fileName } = JSON.parse(body);
      const cleanUser = username ? username.toLowerCase() : '';
      const trx = await getTransactionFromDb(transactionId);
      if (!trx) return jsonResponse(res, 404, { success: false, message: 'Transaksi tidak ditemukan!' });
      if (trx.username !== cleanUser) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      trx.proofImage = proofImage; trx.proofFileName = fileName; trx.status = 'process'; trx.updatedAt = Date.now();
      await saveTransactionToDb(transactionId, trx);
      jsonResponse(res, 200, { success: true, message: 'Bukti terkirim!' });

    } else if (parsedUrl.pathname === '/api/qris/create' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, vipId } = JSON.parse(body);
      const cleanUser = username ? String(username).toLowerCase() : '';
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const shop = await getVipShopFromDb();
      const item = vipId ? shop[vipId] : null;
      if (!item || item.active === false) return jsonResponse(res, 400, { success: false, message: 'Produk VIP tidak ditemukan atau tidak aktif!' });
      const price = parseInt(item.price);
      const days = parseInt(item.days);
      if (!price || price < 1 || !days || days < 1) return jsonResponse(res, 400, { success: false, message: 'Data produk VIP tidak valid!' });
      const nowTs = Date.now();
      const allTrxQr = await getTransactionsFromDb();
      const reusable = Object.values(allTrxQr).find(t => t.username === cleanUser && t.method === 'qris' && t.vipId === vipId && t.status === 'pending' && t.vipPrice === price && (t.qrExpiresAt ? t.qrExpiresAt > nowTs + 60000 : (nowTs - t.createdAt) < QR_DEFAULT_VALID_MS - 60000));
      if (reusable) return jsonResponse(res, 200, Object.assign({ success: true, reused: true }, qrTrxClientView(reusable)));
      const transactionId = 'TRX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      let invoice;
      try {
        const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
        const safeEmailName = cleanUser.replace(/[^a-z0-9._-]/g, '') || 'user';
        const raw = await qrPayRequest('POST', '/v1/invoices', {
          customer_name: cleanUser,
          customer_email: safeEmailName + '@example.com',
          amount: price,
          description: 'VIP ' + item.name + ' - ' + cleanUser,
          payment_method: 'qris',
          redirect_url: proto + '://' + (req.headers.host || 'localhost') + '/'
        });
        invoice = normalizeQrInvoice(raw);
      } catch (apiErr) {
        return jsonResponse(res, 502, { success: false, message: 'Gagal membuat QR: ' + apiErr.message });
      }
      if (!invoice.id) return jsonResponse(res, 502, { success: false, message: 'Respons API pembayaran tidak berisi ID invoice.' });
      if (!invoice.checkoutUrl) return jsonResponse(res, 502, { success: false, message: 'Respons API pembayaran tidak berisi link pembayaran.' });
      const newTrx = {
        transactionId, username: cleanUser, vipId, vipName: item.name, vipPrice: price, vipDays: days,
        status: 'pending', method: 'qris', invoiceId: invoice.id,
        qrAmount: invoice.amount || price, qrString: invoice.qrString, qrImage: invoice.qrImage,
        checkoutUrl: invoice.checkoutUrl, qrExpiresAt: invoice.expiresAt,
        proofImage: null, proofFileName: null, createdAt: Date.now(), updatedAt: Date.now(), adminNote: ''
      };
      await saveTransactionToDb(transactionId, newTrx);
      qrPendingIds.add(transactionId);
      jsonResponse(res, 200, Object.assign({ success: true, reused: false }, qrTrxClientView(newTrx)));

    } else if (parsedUrl.pathname === '/api/qris/status' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const transactionId = parsedUrl.searchParams.get('transactionId');
      const cleanUser = username ? username.toLowerCase() : '';
      const trx = transactionId ? await getTransactionFromDb(transactionId) : null;
      if (!trx || trx.method !== 'qris') return jsonResponse(res, 404, { success: false, message: 'Transaksi QR tidak ditemukan!' });
      if (trx.username !== cleanUser) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      if (trx.status === 'success') {
        const u = await getUserFromDb(cleanUser);
        return jsonResponse(res, 200, { success: true, status: 'paid', message: 'Pembayaran berhasil. Akun VIP aktif!', session: u ? buildSessionPayload(cleanUser, u) : null });
      }
      if (trx.status === 'failed') return jsonResponse(res, 200, { success: true, status: 'failed', message: trx.adminNote || 'Pembayaran gagal / kedaluwarsa.' });
      try {
        const inv = normalizeQrInvoice(await qrPayRequest('GET', '/v1/invoices/' + encodeURIComponent(trx.invoiceId)));
        const state = qrClassify(inv);
        if (state === 'paid') {
          const act = await activateVipFromTransaction(transactionId);
          if (act.busy) return jsonResponse(res, 200, { success: true, status: 'pending' });
          const u = await getUserFromDb(cleanUser);
          return jsonResponse(res, 200, { success: true, status: 'paid', activated: !!act.activated, message: 'Pembayaran berhasil. Akun VIP aktif!', session: u ? buildSessionPayload(cleanUser, u) : null });
        }
        if (state === 'failed') {
          trx.status = 'failed'; trx.adminNote = 'Invoice ' + (inv.status || 'gagal') + ' (QR)'; trx.updatedAt = Date.now();
          await saveTransactionToDb(transactionId, trx);
          return jsonResponse(res, 200, { success: true, status: 'failed', message: 'QR kedaluwarsa / dibatalkan. Pilih produk lagi untuk membuat QR baru.' });
        }
        jsonResponse(res, 200, { success: true, status: 'pending' });
      } catch (apiErr) {
        jsonResponse(res, 200, { success: true, status: 'pending', warning: apiErr.message });
      }

    } else if (parsedUrl.pathname === '/api/transaction/my' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const cleanUser = username.toLowerCase();
      const allTrx = await getTransactionsFromDb();
      const myTrx = Object.values(allTrx).filter(t => t.username === cleanUser).sort((a, b) => b.createdAt - a.createdAt);
      jsonResponse(res, 200, { success: true, transactions: myTrx });

    } else if (parsedUrl.pathname === '/api/admin/transactions' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const allTrx = await getTransactionsFromDb();
      const transactions = Object.values(allTrx).sort((a, b) => b.createdAt - a.createdAt);
      jsonResponse(res, 200, { success: true, transactions });

    } else if (parsedUrl.pathname === '/api/admin/transaction/confirm' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, transactionId, status, adminNote } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const trx = await getTransactionFromDb(transactionId);
      if (!trx) return jsonResponse(res, 404, { success: false, message: 'Transaksi tidak ditemukan!' });
      trx.status = status; trx.adminNote = adminNote || ''; trx.updatedAt = Date.now();
      await saveTransactionToDb(transactionId, trx);
      if (status === 'success') {
        const targetUser = await getUserFromDb(trx.username);
        if (targetUser) { targetUser.vipUntil = Date.now() + (trx.vipDays * 24 * 60 * 60 * 1000); await saveUserToDb(trx.username, targetUser); }
      }
      jsonResponse(res, 200, { success: true, message: status === 'success' ? 'Pembayaran dikonfirmasi! User VIP.' : 'Pembayaran ditolak.' });

    } else if (parsedUrl.pathname === '/api/admin/transaction/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, transactionId } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      await removeTransactionFromDb(transactionId);
      jsonResponse(res, 200, { success: true, message: 'Transaksi dihapus' });

    } else if (parsedUrl.pathname === '/api/admin/vip-shop/save' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, id, name, price, days } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      if (!name || !price || !days) return jsonResponse(res, 400, { success: false, message: 'Lengkapi!' });
      if (price < 1000) return jsonResponse(res, 400, { success: false, message: 'Min Rp 1.000!' });
      if (days < 1) return jsonResponse(res, 400, { success: false, message: 'Min 1 hari!' });
      const itemId = id || ('vip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
      const shop = await getVipShopFromDb();
      const order = id ? (shop[id]?.order || Object.keys(shop).length + 1) : Object.keys(shop).length + 1;
      await saveVipShopToDb(itemId, { id: itemId, name, price: parseInt(price), days: parseInt(days), active: true, order });
      jsonResponse(res, 200, { success: true, message: id ? 'Layanan diperbarui!' : 'Layanan ditambahkan!' });

    } else if (parsedUrl.pathname === '/api/admin/vip-shop/toggle' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, id, active } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const item = await getVipShopFromDb();
      if (!item[id]) return jsonResponse(res, 404, { success: false, message: 'Layanan tidak ditemukan!' });
      item[id].active = active;
      await saveVipShopToDb(id, item[id]);
      jsonResponse(res, 200, { success: true, message: active ? 'Diaktifkan' : 'Dinonaktifkan' });

    } else if (parsedUrl.pathname === '/api/admin/vip-shop/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, id } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      await removeVipShopFromDb(id);
      jsonResponse(res, 200, { success: true, message: 'Layanan dihapus' });

    } else if (parsedUrl.pathname === '/api/redeems/active' && req.method === 'GET') {
      const allRedeems = await getAllRedeemsFromDb();
      const activeRedeems = {};
      for (const [code, val] of Object.entries(allRedeems)) {
        const remainingClaims = val.maxClaims - val.claimedCount;
        if (remainingClaims > 0) activeRedeems[code] = { quotaPerUser: val.quotaPerUser || 1, maxClaims: val.maxClaims, claimedCount: val.claimedCount };
      }
      jsonResponse(res, 200, { success: true, redeems: activeRedeems });

    } else if (parsedUrl.pathname === '/api/redeems/claimed' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 200, { success: true, claimedCodes: {} });
      const cleanUser = username.toLowerCase();
      const allRedeems = await getAllRedeemsFromDb();
      const claimedCodes = {};
      for (const [code, val] of Object.entries(allRedeems)) {
        if (val.claimedUsers && val.claimedUsers.includes(cleanUser)) claimedCodes[code] = true;
      }
      jsonResponse(res, 200, { success: true, claimedCodes });

    } else if (parsedUrl.pathname === '/api/feature-request/submit' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, title, description } = JSON.parse(body);
      const cleanUser = username ? username.toLowerCase() : '';
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      if (!title || !description) return jsonResponse(res, 400, { success: false, message: 'Lengkapi!' });
      if (title.length < 3 || title.length > 100) return jsonResponse(res, 400, { success: false, message: 'Judul 3-100!' });
      if (description.length < 10 || description.length > 1000) return jsonResponse(res, 400, { success: false, message: 'Deskripsi 10-1000!' });
      const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      await saveFeatureRequestToDb(reqId, { id: reqId, username: cleanUser, title: title.trim(), description: description.trim(), status: 'pending', timestamp: Date.now(), adminNote: '' });
      jsonResponse(res, 200, { success: true, message: 'Request terkirim!' });

    } else if (parsedUrl.pathname === '/api/feature-request/my' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const allRequests = await getFeatureRequestsFromDb();
      const cleanUser = username.toLowerCase();
      const myRequests = Object.values(allRequests).filter(r => r.username === cleanUser).sort((a, b) => b.timestamp - a.timestamp);
      jsonResponse(res, 200, { success: true, requests: myRequests });

    } else if (parsedUrl.pathname === '/api/admin/feature-requests' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const allRequests = await getFeatureRequestsFromDb();
      const requests = Object.values(allRequests).sort((a, b) => b.timestamp - a.timestamp);
      jsonResponse(res, 200, { success: true, requests });

    } else if (parsedUrl.pathname === '/api/admin/feature-request/update' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, requestId, status, adminNote } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      if (!['pending', 'approved', 'rejected'].includes(status)) return jsonResponse(res, 400, { success: false, message: 'Status tidak valid!' });
      const allRequests = await getFeatureRequestsFromDb();
      const reqObj = allRequests[requestId];
      if (!reqObj) return jsonResponse(res, 404, { success: false, message: 'Request tidak ditemukan!' });
      reqObj.status = status; reqObj.adminNote = adminNote || ''; reqObj.updatedAt = Date.now();
      await saveFeatureRequestToDb(requestId, reqObj);
      jsonResponse(res, 200, { success: true, message: 'Request diupdate!' });

    } else if (parsedUrl.pathname === '/api/admin/feature-request/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, requestId } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      await removeFeatureRequestFromDb(requestId);
      jsonResponse(res, 200, { success: true, message: 'Request dihapus!' });

    } else if (parsedUrl.pathname === '/api/user/my-emails') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });
      const cleanUser = username.toLowerCase();
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const lastReset = userObj.lastResetTime || now;
      const nextReset = lastReset + twentyFourHours;
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      if (now - lastReset >= twentyFourHours) {
        userObj.activatedEmails = []; userObj.lastResetTime = now;
        await saveUserToDb(cleanUser, userObj);
        return jsonResponse(res, 200, { success: true, activatedEmails: [], usedQuota: 0, bonusQuota: userObj.bonusQuota || 0, totalQuota: (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0), lastResetTime: now, nextResetTime: now + twentyFourHours, isVip: isVipActive, isAdmin: !!userObj.isAdmin, resetJustNow: true });
      }
      jsonResponse(res, 200, { success: true, activatedEmails: userObj.activatedEmails || [], usedQuota: userObj.activatedEmails ? userObj.activatedEmails.length : 0, bonusQuota: userObj.bonusQuota || 0, totalQuota: (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0), lastResetTime: lastReset, nextResetTime: nextReset, isVip: isVipActive, isAdmin: !!userObj.isAdmin, resetJustNow: false });

    } else if (parsedUrl.pathname === '/api/user/change-password' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, oldPassword, newPassword } = JSON.parse(body);
      if (!username || !oldPassword || !newPassword) return jsonResponse(res, 400, { success: false, message: 'Semua field wajib!' });
      if (newPassword.length < 4) return jsonResponse(res, 400, { success: false, message: 'Min 4 karakter!' });
      const cleanUser = username.toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      if (!(await checkUserPassword(userObj, oldPassword, cleanUser))) return jsonResponse(res, 401, { success: false, message: 'Password lama salah!' });
      userObj.passwordHash = await hashPassword(newPassword);
      delete userObj.password;
      await saveUserToDb(cleanUser, userObj);
      jsonResponse(res, 200, { success: true, message: 'Password diubah!' });

    } else if (parsedUrl.pathname === '/api/chat/messages' && req.method === 'GET') {
      // Pesan chat TIDAK dihapus otomatis (permanen sampai admin menghapus manual).
      const allMessages = await getGlobalChatFromDb();
      const sortedEntries = Object.entries(allMessages).filter(([, m]) => m && typeof m === 'object').sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0)).slice(-CHAT_MAX_RETURN);
      const messages = {};
      sortedEntries.forEach(([id, m]) => { messages[id] = m; });
      jsonResponse(res, 200, { success: true, messages });

    } else if (parsedUrl.pathname === '/api/chat/send' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, message } = JSON.parse(body);
      if (!username || !message) return jsonResponse(res, 400, { success: false, message: 'Username dan pesan wajib!' });
      const cleanUser = username.toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const trimmedMsg = message.trim().substring(0, 500);
      if (!trimmedMsg) return jsonResponse(res, 400, { success: false, message: 'Pesan kosong!' });
      const now = Date.now();
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const msgId = 'msg_' + now + '_' + Math.random().toString(36).substring(2, 8);
      await saveGlobalChatMessageToDb(msgId, { username: cleanUser, message: trimmedMsg, timestamp: now, isAdmin: !!userObj.isAdmin, isVip: !!isVipActive });
      jsonResponse(res, 200, { success: true, message: 'Pesan terkirim!' });

    } else if (parsedUrl.pathname === '/api/chat/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, messageId } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      await deleteGlobalChatMessageFromDb(messageId);
      jsonResponse(res, 200, { success: true, message: 'Pesan dihapus' });

    } else if (parsedUrl.pathname === '/api/chat/react' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, messageId, reaction } = JSON.parse(body);
      if (!username || !messageId || !reaction) return jsonResponse(res, 400, { success: false, message: 'Data tidak lengkap!' });
      if (!CHAT_REACTIONS.includes(reaction)) return jsonResponse(res, 400, { success: false, message: 'Reaksi tidak valid!' });
      if (!isValidChatMessageId(messageId)) return jsonResponse(res, 400, { success: false, message: 'ID pesan tidak valid!' });
      const cleanUser = String(username).toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const targetMsg = await getGlobalChatMessageFromDb(messageId);
      if (!targetMsg) return jsonResponse(res, 404, { success: false, message: 'Pesan tidak ditemukan!' });
      const alreadyReacted = !!(targetMsg.reactions && targetMsg.reactions[reaction] && targetMsg.reactions[reaction][cleanUser]);
      await set(ref(db, 'globalChat/' + messageId + '/reactions/' + reaction + '/' + cleanUser), alreadyReacted ? null : true);
      jsonResponse(res, 200, { success: true, reacted: !alreadyReacted });

    } else if (parsedUrl.pathname === '/api/chat/poll' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, question, options } = JSON.parse(body);
      const pollAdmin = adminUsername ? await getUserFromDb(String(adminUsername).toLowerCase()) : null;
      if (!pollAdmin || !pollAdmin.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const pollQuestion = String(question || '').trim().substring(0, 200);
      if (!pollQuestion) return jsonResponse(res, 400, { success: false, message: 'Pertanyaan polling wajib diisi!' });
      let pollOptions = Array.isArray(options) ? options.map(o => String(o || '').trim().substring(0, 100)).filter(Boolean) : [];
      pollOptions = pollOptions.filter((o, i) => pollOptions.indexOf(o) === i).slice(0, CHAT_POLL_MAX_OPTIONS);
      if (pollOptions.length < 2) return jsonResponse(res, 400, { success: false, message: 'Minimal 2 pilihan jawaban (tidak boleh sama)!' });
      const pollNow = Date.now();
      const pollMsgId = 'msg_' + pollNow + '_' + Math.random().toString(36).substring(2, 8);
      await saveGlobalChatMessageToDb(pollMsgId, {
        username: String(adminUsername).toLowerCase(),
        message: '📊 Polling: ' + pollQuestion,
        timestamp: pollNow,
        isAdmin: true,
        isVip: !!(pollAdmin.vipUntil && pollAdmin.vipUntil > pollNow),
        type: 'poll',
        poll: { question: pollQuestion, options: pollOptions, closed: false }
      });
      jsonResponse(res, 200, { success: true, message: 'Polling terkirim!', messageId: pollMsgId });

    } else if (parsedUrl.pathname === '/api/chat/vote' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, messageId, optionIndex } = JSON.parse(body);
      if (!username || !messageId) return jsonResponse(res, 400, { success: false, message: 'Data tidak lengkap!' });
      if (!isValidChatMessageId(messageId)) return jsonResponse(res, 400, { success: false, message: 'ID pesan tidak valid!' });
      const cleanUser = String(username).toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const pollMsg = await getGlobalChatMessageFromDb(messageId);
      if (!pollMsg || pollMsg.type !== 'poll' || !pollMsg.poll) return jsonResponse(res, 404, { success: false, message: 'Polling tidak ditemukan!' });
      if (pollMsg.poll.closed) return jsonResponse(res, 400, { success: false, message: 'Polling sudah ditutup!' });
      const pollOpts = Array.isArray(pollMsg.poll.options) ? pollMsg.poll.options : Object.values(pollMsg.poll.options || {});
      const idx = Number(optionIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= pollOpts.length) return jsonResponse(res, 400, { success: false, message: 'Pilihan tidak valid!' });
      await set(ref(db, 'globalChat/' + messageId + '/votes/' + cleanUser), idx);
      jsonResponse(res, 200, { success: true, message: 'Jawaban tersimpan!' });

    } else if (parsedUrl.pathname === '/api/chat/poll-close' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, messageId } = JSON.parse(body);
      const closeAdmin = adminUsername ? await getUserFromDb(String(adminUsername).toLowerCase()) : null;
      if (!closeAdmin || !closeAdmin.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      if (!isValidChatMessageId(messageId)) return jsonResponse(res, 400, { success: false, message: 'ID pesan tidak valid!' });
      const closeMsg = await getGlobalChatMessageFromDb(messageId);
      if (!closeMsg || closeMsg.type !== 'poll' || !closeMsg.poll) return jsonResponse(res, 404, { success: false, message: 'Polling tidak ditemukan!' });
      const nowClosed = !closeMsg.poll.closed;
      await set(ref(db, 'globalChat/' + messageId + '/poll/closed'), nowClosed);
      jsonResponse(res, 200, { success: true, closed: nowClosed, message: nowClosed ? 'Polling ditutup' : 'Polling dibuka kembali' });

    } else if (parsedUrl.pathname === '/api/admin/create-vip-account' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, vipUsername, vipPassword, vipDays } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const cleanVipUser = vipUsername.toLowerCase().trim();
      if (!cleanVipUser || !vipPassword || !vipDays) return jsonResponse(res, 400, { success: false, message: 'Lengkapi!' });
      if (vipDays < 1 || vipDays > 3650) return jsonResponse(res, 400, { success: false, message: '1-3650 hari!' });
      const existingUser = await getUserFromDb(cleanVipUser);
      if (existingUser) return jsonResponse(res, 400, { success: false, message: 'Username sudah terdaftar!' });
      const now = Date.now();
      const vipUntil = now + (vipDays * 24 * 60 * 60 * 1000);
      await saveUserToDb(cleanVipUser, { passwordHash: await hashPassword(vipPassword), email: 'vip@am-premium.local', isAdmin: false, activatedEmails: [], bonusQuota: 0, baseQuota: BASE_QUOTA, lastResetTime: now, vipUntil, isVipAccount: true, createdBy: adminUsername.toLowerCase(), createdAt: now });
      const vipAccId = 'vip_' + now + '_' + Math.random().toString(36).substring(2, 8);
      await saveVipAccountToDb(vipAccId, { username: cleanVipUser, passwordEnc: encryptText(vipPassword), vipUntil, createdBy: adminUsername.toLowerCase(), createdAt: now });
      jsonResponse(res, 200, { success: true, message: 'Akun VIP "' + cleanVipUser + '" dibuat untuk ' + vipDays + ' hari!', username: cleanVipUser, vipUntil });

    } else if (parsedUrl.pathname === '/api/admin/get-vip-accounts' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const vipAccounts = await getVipAccountsFromDb();
      const enriched = {};
      const now = Date.now();
      for (const [id, acc] of Object.entries(vipAccounts)) {
        const userData = await getUserFromDb(acc.username);
        const { password: legacyPw, passwordEnc, ...accRest } = acc;
        enriched[id] = { ...accRest, password: passwordEnc ? decryptText(passwordEnc) : (legacyPw || ''), isActive: userData && userData.vipUntil > now, currentVipUntil: userData ? (userData.vipUntil || 0) : 0, exists: !!userData };
      }
      jsonResponse(res, 200, { success: true, vipAccounts: enriched });

    } else if (parsedUrl.pathname === '/api/admin/delete-vip-account' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, vipUsername } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const cleanVipUser = vipUsername.toLowerCase();
      await deleteUserFromDb(cleanVipUser);
      const vipAccounts = await getVipAccountsFromDb();
      for (const [id, acc] of Object.entries(vipAccounts)) {
        if (acc.username === cleanVipUser) await removeVipAccountFromDb(id);
      }
      jsonResponse(res, 200, { success: true, message: 'Akun VIP dihapus!' });

    } else if (parsedUrl.pathname === '/api/admin/delete-user' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, targetUsername } = JSON.parse(body);
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const cleanTarget = targetUsername.toLowerCase();
      if (cleanTarget === adminUsername.toLowerCase()) return jsonResponse(res, 400, { success: false, message: 'Tidak dapat hapus akun sendiri!' });
      if (cleanTarget === 'adminbaguss') return jsonResponse(res, 400, { success: false, message: 'Admin utama tidak dapat dihapus!' });
      const targetUser = await getUserFromDb(cleanTarget);
      if (!targetUser) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan!' });
      await deleteUserFromDb(cleanTarget);
      const vipAccounts = await getVipAccountsFromDb();
      for (const [id, acc] of Object.entries(vipAccounts)) {
        if (acc.username === cleanTarget) await removeVipAccountFromDb(id);
      }
      jsonResponse(res, 200, { success: true, message: 'Akun "' + cleanTarget + '" dihapus!', deletedUser: cleanTarget });

    } else if (parsedUrl.pathname === '/api/admin/upload-init' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, uploadId, filename, totalChunks, fileSize, fileType } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak' });
      const uploadSessionDir = path.join(UPLOAD_DIR, uploadId);
      if (!fs.existsSync(uploadSessionDir)) fs.mkdirSync(uploadSessionDir, { recursive: true });
      fs.writeFileSync(path.join(uploadSessionDir, 'meta.json'), JSON.stringify({ filename, totalChunks, fileSize, fileType, createdAt: Date.now() }));
      jsonResponse(res, 200, { success: true, uploadId });

    } else if (parsedUrl.pathname === '/api/admin/upload-chunk' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, uploadId, chunkIndex, chunkData } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak' });
      const uploadSessionDir = path.join(UPLOAD_DIR, uploadId);
      if (!fs.existsSync(uploadSessionDir)) return jsonResponse(res, 404, { success: false, message: 'Sesi tidak ditemukan' });
      const base64 = chunkData.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(path.join(uploadSessionDir, 'chunk_' + String(chunkIndex).padStart(6, '0')), buffer);
      jsonResponse(res, 200, { success: true, chunkIndex });

    } else if (parsedUrl.pathname === '/api/admin/upload-finalize' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, uploadId } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak' });
      const uploadSessionDir = path.join(UPLOAD_DIR, uploadId);
      if (!fs.existsSync(uploadSessionDir)) return jsonResponse(res, 404, { success: false, message: 'Sesi tidak ditemukan' });
      const meta = JSON.parse(fs.readFileSync(path.join(uploadSessionDir, 'meta.json'), 'utf8'));
      const chunks = fs.readdirSync(uploadSessionDir).filter(f => f.startsWith('chunk_')).sort();
      if (chunks.length !== meta.totalChunks) return jsonResponse(res, 400, { success: false, message: 'Chunk tidak lengkap: ' + chunks.length + '/' + meta.totalChunks });
      const buffers = chunks.map(c => fs.readFileSync(path.join(uploadSessionDir, c)));
      const fullBuffer = Buffer.concat(buffers);
      const base64 = fullBuffer.toString('base64');
      const dataUrl = 'data:' + (meta.fileType || 'video/mp4') + ';base64,' + base64;
      await saveVideoToDb(dataUrl);
      chunks.forEach(c => { try { fs.unlinkSync(path.join(uploadSessionDir, c)); } catch(e){} });
      try { fs.unlinkSync(path.join(uploadSessionDir, 'meta.json')); } catch(e){}
      try { fs.rmdirSync(uploadSessionDir); } catch(e){}
      jsonResponse(res, 200, { success: true, message: 'Video tersimpan', size: fullBuffer.length });

    } else if (parsedUrl.pathname === '/api/admin/get-all-users') {
      const username = parsedUrl.searchParams.get('username');
      const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      const allUsers = await getAllUsersFromDb();
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const userList = Object.entries(allUsers).map(([uname, udata]) => {
        const isVip = udata.vipUntil && udata.vipUntil > now;
        const usedQuota = udata.activatedEmails ? udata.activatedEmails.length : 0;
        const bonusQuota = udata.bonusQuota || 0;
        const lastReset = udata.lastResetTime || 0;
        const nextReset = lastReset + twentyFourHours;
        const isResetDue = now - lastReset >= twentyFourHours;
        return { username: uname, email: udata.email || '-', isAdmin: !!udata.isAdmin, isVip: !!isVip, vipUntil: udata.vipUntil || 0, usedQuota, bonusQuota, totalQuota: (udata.baseQuota || BASE_QUOTA) + bonusQuota, lastResetTime: lastReset, nextResetTime: nextReset, isResetDue, activatedEmails: udata.activatedEmails || [], isVipAccount: !!udata.isVipAccount };
      });
      userList.sort((a, b) => { if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1; if (a.isVip !== b.isVip) return a.isVip ? -1 : 1; return a.username.localeCompare(b.username); });
      const stats = { total: userList.length, admins: userList.filter(u => u.isAdmin).length, vips: userList.filter(u => u.isVip).length, regulars: userList.filter(u => !u.isAdmin && !u.isVip).length, resetDue: userList.filter(u => u.isResetDue).length };
      jsonResponse(res, 200, { success: true, users: userList, stats });

    } else if (parsedUrl.pathname === '/api/user/username' && req.method === 'PUT') {
      const body = await readBody(req);
      const { currentUsername, newUsername } = JSON.parse(body);
      if (!currentUsername || !newUsername) return jsonResponse(res, 400, { success: false, message: 'Username lama dan baru diperlukan.' });
      const cleanOld = currentUsername.toLowerCase();
      const cleanNew = String(newUsername).trim().toLowerCase();
      if (cleanNew.length < 3 || cleanNew.length > 40 || /[.#$\[\]\/\s]/.test(cleanNew)) return jsonResponse(res, 400, { success: false, message: 'Username minimal 3 karakter dan tidak boleh mengandung spasi atau . # $ [ ] /' });
      const existingUser = await getUserFromDb(cleanNew);
      if (existingUser) return jsonResponse(res, 400, { success: false, message: 'Username sudah digunakan.' });
      const userData = await getUserFromDb(cleanOld);
      if (!userData) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan.' });
      await saveUserToDb(cleanNew, userData);
      await set(ref(db, `users/${cleanOld}`), null);
      jsonResponse(res, 200, { success: true, newUsername: cleanNew, token: signToken(cleanNew) });

    } else if (parsedUrl.pathname === '/api/admin/set-status' && req.method === 'POST') {
      const body = await readBody(req);
      const { status, username } = JSON.parse(body);
      const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      await saveServerStatusToDb(status);
      jsonResponse(res, 200, { success: true, status });

    } else if (parsedUrl.pathname === '/api/admin/set-vip' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, targetUser, days } = JSON.parse(body);
      const adminObj = await getUserFromDb(username.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Akses ditolak.' });
      const cleanTarget = targetUser.toLowerCase();
      const targetObj = await getUserFromDb(cleanTarget);
      if (!targetObj) return jsonResponse(res, 400, { success: false, message: 'User target tidak ditemukan!' });
      targetObj.vipUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
      await saveUserToDb(cleanTarget, targetObj);
      jsonResponse(res, 200, { success: true, message: 'VIP ' + cleanTarget + ' aktif ' + days + ' hari!' });

    } else if (parsedUrl.pathname === '/api/admin/get-vip-list') {
      const username = parsedUrl.searchParams.get('username');
      const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      const allUsers = await getAllUsersFromDb();
      const vipUsers = {};
      const now = Date.now();
      for (let [uname, udata] of Object.entries(allUsers)) {
        if (udata.vipUntil && udata.vipUntil > now) vipUsers[uname] = { vipUntil: udata.vipUntil };
      }
      jsonResponse(res, 200, { success: true, vipUsers });

    } else if (parsedUrl.pathname === '/api/admin/remove-vip' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, targetUser } = JSON.parse(body);
      const adminObj = await getUserFromDb(username.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) return jsonResponse(res, 403, { success: false });
      const cleanTarget = targetUser.toLowerCase();
      const targetObj = await getUserFromDb(cleanTarget);
      if (targetObj) { targetObj.vipUntil = 0; await saveUserToDb(cleanTarget, targetObj); }
      jsonResponse(res, 200, { success: true });

    } else if (parsedUrl.pathname === '/api/admin/create-announcement' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, title, content } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      const id = 'info_' + Date.now();
      await saveAnnouncementToDb(id, { title, content, timestamp: Date.now() });
      jsonResponse(res, 200, { success: true, message: 'Informasi dipublikasikan!' });

    } else if (parsedUrl.pathname === '/api/admin/update-announcement' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, id, title, content } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      await saveAnnouncementToDb(id, { title, content, timestamp: Date.now() });
      jsonResponse(res, 200, { success: true, message: 'Informasi diperbarui!' });

    } else if (parsedUrl.pathname === '/api/admin/delete-announcement' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, id } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      await removeAnnouncementFromDb(id);
      jsonResponse(res, 200, { success: true });

    } else if (parsedUrl.pathname === '/api/admin/create-redeem' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, code, quotaPerUser, maxClaims } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      if (!code || !quotaPerUser || !maxClaims) return jsonResponse(res, 400, { success: false, message: 'Lengkapi!' });
      if (quotaPerUser < 1 || maxClaims < 1) return jsonResponse(res, 400, { success: false, message: 'Min 1!' });
      const existingCode = await getRedeemFromDb(code);
      if (existingCode) return jsonResponse(res, 400, { success: false, message: 'Kode sudah ada!' });
      await saveRedeemToDb(code, { quotaPerUser: parseInt(quotaPerUser), maxClaims: parseInt(maxClaims), claimedCount: 0, claimedUsers: [] });
      jsonResponse(res, 200, { success: true, message: 'Kode ' + code + ' dibuat! (' + quotaPerUser + ' kuota/user, maks ' + maxClaims + ' orang)' });

    } else if (parsedUrl.pathname === '/api/admin/get-redeems') {
      const username = parsedUrl.searchParams.get('username');
      const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      const redeems = await getAllRedeemsFromDb();
      jsonResponse(res, 200, { success: true, redeems });

    } else if (parsedUrl.pathname === '/api/admin/delete-redeem' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, code } = JSON.parse(body);
      const userObj = await getUserFromDb(username.toLowerCase());
      if (!userObj || !userObj.isAdmin) return jsonResponse(res, 403, { success: false });
      await removeRedeemFromDb(code);
      jsonResponse(res, 200, { success: true });

    } else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, code } = JSON.parse(body);
      const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (currentServerStatus !== 'online' && (!userObj || !userObj.isAdmin)) return jsonResponse(res, 403, { success: false, message: 'Server offline.' });
      const cleanUser = username.toLowerCase();
      const redeemObj = await getRedeemFromDb(code);
      if (!userObj || !redeemObj) return jsonResponse(res, 400, { success: false, message: 'User atau kode tidak valid!' });
      if (redeemObj.claimedUsers && redeemObj.claimedUsers.includes(cleanUser)) return jsonResponse(res, 400, { success: false, message: 'Anda sudah klaim kode ini!' });
      if (redeemObj.claimedCount >= redeemObj.maxClaims) return jsonResponse(res, 400, { success: false, message: 'Kuota klaim habis!' });
      const rewardQuota = redeemObj.quotaPerUser || 1;
      if (!userObj.bonusQuota) userObj.bonusQuota = 0;
      userObj.bonusQuota += rewardQuota;
      userObj.bonusGrantedAt = Date.now();
      userObj.lastBonusActivity = Date.now();
      redeemObj.claimedCount += 1;
      if (!redeemObj.claimedUsers) redeemObj.claimedUsers = [];
      redeemObj.claimedUsers.push(cleanUser);
      await saveUserToDb(cleanUser, userObj);
      await saveRedeemToDb(code, redeemObj);
      jsonResponse(res, 200, { success: true, message: 'Berhasil! +' + rewardQuota + ' kuota bonus.', usedQuota: userObj.activatedEmails ? userObj.activatedEmails.length : 0, bonusQuota: userObj.bonusQuota, totalQuota: (userObj.baseQuota || BASE_QUOTA) + userObj.bonusQuota, isVip: userObj.vipUntil && userObj.vipUntil > Date.now(), isAdmin: userObj.isAdmin });

    } else if (parsedUrl.pathname === '/api/auth/session' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, token } = JSON.parse(body);
      if (!username || !token) return jsonResponse(res, 400, { success: false });
      const cleanUser = String(username).toLowerCase();
      if (verifyToken(token) !== cleanUser) return jsonResponse(res, 401, { success: false });
      await checkAndExpireBonusQuota(cleanUser);
      const existingUser = await getUserFromDb(cleanUser);
      if (!existingUser) return jsonResponse(res, 404, { success: false });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (!existingUser.lastResetTime) existingUser.lastResetTime = now;
      if (now - existingUser.lastResetTime >= twentyFourHours) { existingUser.activatedEmails = []; existingUser.lastResetTime = now; await saveUserToDb(cleanUser, existingUser); }
      const isVipActive = existingUser.vipUntil && existingUser.vipUntil > now;
      const usedCount = existingUser.activatedEmails ? existingUser.activatedEmails.length : 0;
      jsonResponse(res, 200, { success: true, username: cleanUser, isAdmin: existingUser.isAdmin, usedQuota: usedCount, bonusQuota: existingUser.bonusQuota || 0, totalQuota: (existingUser.baseQuota || BASE_QUOTA) + (existingUser.bonusQuota || 0), isVip: isVipActive, vipUntil: existingUser.vipUntil || 0, serverStatus: currentServerStatus });

    } else if (parsedUrl.pathname === '/api/auth' && req.method === 'POST') {
      const body = await readBody(req);
      const { mode, username, password, deviceToken, email } = JSON.parse(body);
      if (!username || !password) return jsonResponse(res, 400, { success: false, message: 'Username dan password wajib!' });
      const cleanUser = String(username).trim().toLowerCase();
      if (!cleanUser || /[.#$\[\]\/\s]/.test(cleanUser)) return jsonResponse(res, 400, { success: false, message: 'Username tidak boleh mengandung spasi atau karakter . # $ [ ] /' });
      let existingUser = await getUserFromDb(cleanUser);
      if (mode === 'register') {
        if (cleanUser === 'adminbaguss' || existingUser) return jsonResponse(res, 400, { success: false, message: 'Username tidak tersedia!' });
        if (cleanUser.length < 3) return jsonResponse(res, 400, { success: false, message: 'Username minimal 3 karakter!' });
        if (String(password).length < 4) return jsonResponse(res, 400, { success: false, message: 'Password minimal 4 karakter!' });
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!EMAIL_REGEX.test(cleanEmail)) return jsonResponse(res, 400, { success: false, message: 'Email valid wajib diisi (untuk reset password)!' });
        const newDeviceToken = deviceToken || ('dev_' + Math.random().toString(36).substring(2) + Date.now());
        const regIp = clientIp(req);
        if (rateBlocked('register', regIp, 10, REGISTER_WINDOW)) return jsonResponse(res, 429, { success: false, message: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.' });
        rateNote('register', regIp, REGISTER_WINDOW);
        await saveUserToDb(cleanUser, { passwordHash: await hashPassword(password), email: cleanEmail, isAdmin: false, activatedEmails: [], bonusQuota: 0, baseQuota: BASE_QUOTA, lastResetTime: Date.now(), vipUntil: 0, deviceToken: newDeviceToken });
        const fakeAuthToken = signToken(cleanUser);
        return jsonResponse(res, 200, { success: true, message: 'Registrasi berhasil!', username: cleanUser, isAdmin: false, usedQuota: 0, bonusQuota: 0, totalQuota: BASE_QUOTA, isVip: false, serverStatus: currentServerStatus, deviceToken: newDeviceToken, token: fakeAuthToken });
      } else {
        const loginIp = clientIp(req);
        const loginKeyUser = loginIp + '|' + cleanUser;
        if (rateBlocked('login', loginKeyUser, 8, LOGIN_WINDOW) || rateBlocked('loginip', loginIp, 40, LOGIN_WINDOW)) {
          return jsonResponse(res, 429, { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' });
        }
        if (existingUser && await checkUserPassword(existingUser, password, cleanUser)) {
          rateClear('login', loginKeyUser);
          await checkAndExpireBonusQuota(cleanUser);
          existingUser = await getUserFromDb(cleanUser);
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000;
          if (!existingUser.lastResetTime) existingUser.lastResetTime = now;
          if (now - existingUser.lastResetTime >= twentyFourHours) { existingUser.activatedEmails = []; existingUser.lastResetTime = now; await saveUserToDb(cleanUser, existingUser); }
          const isVipActive = existingUser.vipUntil && existingUser.vipUntil > now;
          const usedCount = existingUser.activatedEmails ? existingUser.activatedEmails.length : 0;
          const fakeAuthToken = signToken(cleanUser);
          return jsonResponse(res, 200, { success: true, message: 'Login berhasil!', username: cleanUser, isAdmin: existingUser.isAdmin, usedQuota: usedCount, bonusQuota: existingUser.bonusQuota || 0, totalQuota: (existingUser.baseQuota || BASE_QUOTA) + (existingUser.bonusQuota || 0), isVip: isVipActive, vipUntil: existingUser.vipUntil || 0, serverStatus: currentServerStatus, token: fakeAuthToken });
        }
        rateNote('login', loginKeyUser, LOGIN_WINDOW);
        rateNote('loginip', loginIp, LOGIN_WINDOW);
        return jsonResponse(res, 401, { success: false, message: 'Username atau password salah!' });
      }

    } else if (parsedUrl.pathname === '/api/auth/forgot' && req.method === 'POST') {
      const body = await readBody(req);
      const { username } = JSON.parse(body);
      const generic = { success: true, message: 'Jika akun ada dan punya email terdaftar, kode sudah dikirim.' };
      const cleanUser = String(username || '').trim().toLowerCase();
      if (!cleanUser || /[.#$\[\]\/\s]/.test(cleanUser)) return jsonResponse(res, 200, generic);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj || !userObj.email || !EMAIL_REGEX.test(userObj.email) || /@am-premium\.local$/.test(userObj.email)) return jsonResponse(res, 200, generic);
      const snap = await get(child(ref(db), 'passwordResets/' + cleanUser));
      const old = snap.exists() ? snap.val() : null;
      const now = Date.now();
      if (old && old.sentAt && now - old.sentAt < RESET_COOLDOWN) {
        return jsonResponse(res, 429, { success: false, message: 'Tunggu ' + Math.ceil((RESET_COOLDOWN - (now - old.sentAt)) / 1000) + ' detik sebelum minta kode lagi.' });
      }
      const code = String(crypto.randomInt(100000, 1000000));
      try {
        await sendResetEmail(userObj.email, cleanUser, code);
      } catch (mailErr) {
        console.error('[RESET] gagal kirim email:', mailErr.message);
        return jsonResponse(res, 500, { success: false, message: 'Gagal mengirim email. Hubungi admin.' });
      }
      await set(ref(db, 'passwordResets/' + cleanUser), { codeHash: hashResetCode(code), expiresAt: now + RESET_CODE_TTL, attempts: 0, sentAt: now });
      jsonResponse(res, 200, generic);

    } else if (parsedUrl.pathname === '/api/auth/reset' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, code, newPassword } = JSON.parse(body);
      const cleanUser = String(username || '').trim().toLowerCase();
      if (!cleanUser || !code || !newPassword) return jsonResponse(res, 400, { success: false, message: 'Semua field wajib!' });
      if (/[.#$\[\]\/\s]/.test(cleanUser)) return jsonResponse(res, 400, { success: false, message: 'Username tidak valid' });
      if (String(newPassword).length < 4) return jsonResponse(res, 400, { success: false, message: 'Password minimal 4 karakter!' });
      const snap = await get(child(ref(db), 'passwordResets/' + cleanUser));
      const rec = snap.exists() ? snap.val() : null;
      if (!rec || rec.expiresAt < Date.now()) return jsonResponse(res, 400, { success: false, message: 'Kode tidak valid atau sudah kedaluwarsa. Minta kode baru.' });
      if ((rec.attempts || 0) >= RESET_MAX_ATTEMPTS) {
        await set(ref(db, 'passwordResets/' + cleanUser), null);
        return jsonResponse(res, 429, { success: false, message: 'Terlalu banyak percobaan. Minta kode baru.' });
      }
      const given = Buffer.from(hashResetCode(String(code).trim()), 'hex');
      const saved = Buffer.from(rec.codeHash, 'hex');
      if (given.length !== saved.length || !crypto.timingSafeEqual(given, saved)) {
        rec.attempts = (rec.attempts || 0) + 1;
        await set(ref(db, 'passwordResets/' + cleanUser), rec);
        return jsonResponse(res, 400, { success: false, message: 'Kode salah.' });
      }
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      userObj.passwordHash = await hashPassword(String(newPassword));
      delete userObj.password;
      await saveUserToDb(cleanUser, userObj);
      await set(ref(db, 'passwordResets/' + cleanUser), null);
      jsonResponse(res, 200, { success: true, message: 'Password berhasil diubah. Silakan login.' });

    } else if (parsedUrl.pathname === '/api/magiclink' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, email } = JSON.parse(body);
      const cleanUser = username ? username.toLowerCase() : '';
      await checkAndExpireBonusQuota(cleanUser);
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 400, { success: false, message: 'User tidak ditemukan.' });
      if (currentServerStatus !== 'online' && !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Server offline!' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - (userObj.lastResetTime || now) >= twentyFourHours) { userObj.activatedEmails = []; userObj.lastResetTime = now; }
      if (!userObj.activatedEmails) userObj.activatedEmails = [];
      if (!userObj.bonusQuota) userObj.bonusQuota = 0;
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const maxAllowed = (userObj.baseQuota || BASE_QUOTA) + userObj.bonusQuota;
      if (!userObj.isAdmin && !isVipActive) {
        if (!userObj.activatedEmails.includes(email) && userObj.activatedEmails.length >= maxAllowed) return jsonResponse(res, 403, { success: false, message: 'Kuota Anda habis!' });
      }
      const quotaEntry = email + '_' + Date.now();
      if (!userObj.isAdmin && !isVipActive && !userObj.activatedEmails.includes(email)) {
        userObj.activatedEmails.push(quotaEntry);
        if (userObj.bonusQuota > 0) { userObj.lastBonusActivity = now; userObj.bonusGrantedAt = userObj.bonusGrantedAt || now; }
        await saveUserToDb(cleanUser, userObj);
      }
      try {
        const result = await am.magiclink(email);
        const orderId = generateOrderId('AM');
        await saveOrderToDb(orderId, { orderId, username: cleanUser, type: 'am', detail: email, result: result ? JSON.stringify(result).substring(0, 300) : 'Magic link terkirim', timestamp: Date.now(), quotaEntry });
        jsonResponse(res, 200, { success: true, orderId, result, quotaInfo: { usedQuota: userObj.activatedEmails.length, bonusQuota: userObj.bonusQuota, totalQuota: (userObj.baseQuota || BASE_QUOTA) + userObj.bonusQuota } });
      } catch (apiErr) {
        const refilled = await refillQuotaIfNeeded(cleanUser, quotaEntry);
        const refreshedUser = await getUserFromDb(cleanUser);
        const refreshedUsed = refreshedUser.activatedEmails ? refreshedUser.activatedEmails.length : 0;
        jsonResponse(res, 500, { success: false, refilled, message: refilled ? 'Generate gagal: ' + apiErr.message + '. Kuota dikembalikan.' : 'Generate gagal: ' + apiErr.message, quotaInfo: { usedQuota: refreshedUsed, bonusQuota: userObj.bonusQuota || 0, totalQuota: (userObj.baseQuota || BASE_QUOTA) + (userObj.bonusQuota || 0) } });
      }

    } else if (parsedUrl.pathname === '/api/verif' && req.method === 'POST') {
      const body = await readBody(req);
      const { email, url: verifyUrl, username } = JSON.parse(body);
      let userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (currentServerStatus !== 'online' && (!userObj || !userObj.isAdmin)) return jsonResponse(res, 403, { error: 'Server offline.' });
      if (!email || !verifyUrl) return jsonResponse(res, 400, { error: 'Parameter email dan url diperlukan.' });
      const result = await am.verif(email, verifyUrl);
      jsonResponse(res, 200, result);

    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Endpoint tidak ditemukan.');
    }
  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      if (err && err.message === 'Payload too large') jsonResponse(res, 413, { success: false, message: 'Data terlalu besar' });
      else if (err instanceof SyntaxError) jsonResponse(res, 400, { success: false, message: 'Format data tidak valid' });
      else jsonResponse(res, 500, { success: false, message: 'Terjadi kesalahan pada server' });
    }
  }
});

// Di Vercel: jangan listen(), cukup export handler serverless.
if (process.env.VERCEL) {
  module.exports = (req, res) => server.emit('request', req, res);
} else {
  server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 AM Premium Banggus v7.3                                  ║');
  console.log('║  📡 http://localhost:' + PORT + '                                    ║');
  console.log('║  💳 DANA Admin: terkonfigurasi (dari .env)                   ║');
  console.log('║  ──────────────────────────────────────────────────────────  ║');
  console.log('║  ✨ FITUR AKTIF:                                             ║');
  console.log('║  🎨 Alight Motion Premium                                    ║');
  console.log('║  🎬 Netflix Token Generator                                  ║');
  console.log('║  🖼️  HD Foto Generator (Sebelum/Sesudah)                      ║');
  console.log('║  📦 APK Builder (Website → APK)                              ║');
  console.log('║  🛒 VIP Shop & Transaksi                                     ║');
  console.log('║  📲 Bayar QR Otomatis + Aktivasi VIP Otomatis                ║');
  console.log('║  💬 Chat Global & Orderan                                    ║');
  console.log('║  🔔 Browser Notification (BARU!)                             ║');
  console.log('║  ⚙️  Panel Admin Lengkap                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
});
}
