const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const tls = require('tls');
const crypto = require('crypto');
const Go = require('@xof/fetch');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, child, remove } = require('firebase/database');

// ====== KONFIGURASI ======
const config = {
  base: 'https://app.kyzznekoo.my.id',
  kyzznekooApiKey: 'sk_xof_c55534e72b71ed35f19e214cdd8d4717'
};

const firebaseConfig = {
  apiKey: "AIzaSyCg1K6T7IZ4ldhX6ehn9uC_KfRrFSSv9ec",
  authDomain: "jualakunbs.firebaseapp.com",
  databaseURL: "https://jualakunbs-default-rtdb.firebaseio.com",
  projectId: "jualakunbs",
  storageBucket: "jualakunbs.firebasestorage.app",
  messagingSenderId: "341323679179",
  appId: "1:341323679179:web:0167d4d9e3661c553d624e"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ====== KONFIGURASI DANA ADMIN ======
const DANA_ADMIN_NUMBER = '085377788830';
const DANA_ADMIN_NAME = 'L,S';

// ====== KONFIGURASI ONLINE TRACKING ======
const ONLINE_TIMEOUT = 45 * 1000;
const ONLINE_CLEANUP_INTERVAL = 60 * 1000;

// ====== KONFIGURASI BONUS QUOTA EXPIRY ======
const BONUS_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;
const BASE_QUOTA = 2;

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
      const bonusGrantedAt = userObj.bonusGrantedAt || 0;
      const lastBonusActivity = userObj.lastBonusActivity || bonusGrantedAt;

      if (lastBonusActivity > 0 && (now - lastBonusActivity) >= BONUS_EXPIRY_MS) {
        userObj.bonusQuota = 0;
        userObj.bonusGrantedAt = 0;
        userObj.lastBonusActivity = 0;
        if (userObj.activatedEmails && userObj.activatedEmails.length > userObj.baseQuota) {
          userObj.activatedEmails = userObj.activatedEmails.slice(0, userObj.baseQuota);
        }
        changed = true;
        console.log(`[BONUS EXPIRED] User ${username} - bonus expired (2 hari)`);
      }
    }

    if (changed) await saveUserToDb(username, userObj);
    return userObj;
  } catch (e) {
    console.error('[BONUS EXPIRY] Error:', e.message);
    return null;
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

async function initAdmin() {
  const adminData = await getUserFromDb('adminbaguss');
  if (!adminData) {
    await saveUserToDb('adminbaguss', {
      password: 'baguss', isAdmin: true, activatedEmails: [], bonusQuota: 0,
      baseQuota: BASE_QUOTA, lastResetTime: Date.now(), vipUntil: 0
    });
  }
}
initAdmin();

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
const am = {
  async magiclink(email) {
    if (!email.includes("@") || !email.includes(".")) throw new Error("Invalid email.");
    const { data } = await go.get('/api/alightmotion/v5/magiclink', {
      query: { email },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/json',
        'X-apikey': config.kyzznekooApiKey
      }
    });
    return data;
  },
  async verif(email, url) {
    const { data } = await go.post('/api/alightmotion/v5/premium', {
      body: { email, url },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/json',
        'X-apikey': config.kyzznekooApiKey
      }
    });
    return data;
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
<title>AM Premium • Banggus</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
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
  .chat-wrap { height:400px; background:var(--bg-0); border:1px solid var(--line-2); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; }
  .chat-stream { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
  .chat-msg { max-width:82%; padding:8px 11px; border-radius:10px; font-size:12.5px; line-height:1.45; word-wrap:break-word; animation:fadeUp 0.25s; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .chat-msg-them { align-self:flex-start; background:var(--bg-2); border:1px solid var(--line-2); border-bottom-left-radius:3px; }
  .chat-msg-me { align-self:flex-end; background:var(--accent); color:white; border-bottom-right-radius:3px; }
  .chat-msg-header { font-size:10px; font-weight:700; opacity:0.85; margin-bottom:3px; display:flex; align-items:center; gap:4px; }
  .chat-time { font-size:9.5px; opacity:0.55; margin-top:3px; }
  .chat-input-bar { display:flex; gap:8px; padding:10px; border-top:1px solid var(--line-2); background:var(--bg-1); }
  .chat-input-bar input { flex:1; }
  .chat-input-bar button { width:40px; height:40px; border-radius:9px; background:var(--accent); border:none; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
  .chat-input-bar button:hover { background:var(--accent-2); }
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
  @media (max-width:480px) { .app-shell { padding:10px; } .card, .card-elevated { padding:13px; } .chat-wrap { height:360px; } }
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
        <div class="brand-text">AM Premium</div>
        <div class="brand-sub">by Banggus</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
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
    <button onclick="switchView('orders')" data-nav="orders" class="nav-link orders-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>Orderan Saya</button>
    <div class="nav-section-label">Akun</div>
    <button onclick="switchView('vipshop')" data-nav="vipshop" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>Beli VIP<span class="badge badge-warn" style="margin-left:auto; font-size:9px; padding:1px 6px;">HOT</span></button>
    <button onclick="switchView('chat')" data-nav="chat" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat Global<span id="chat-unread-badge" class="badge badge-err hide" style="margin-left:auto; font-size:9px; padding:1px 6px;">0</span></button>
    <button onclick="switchView('profile')" data-nav="profile" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Profil Akun</button>
    <div class="nav-section-label">Lainnya</div>
    <button onclick="switchView('guide')" data-nav="guide" class="nav-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Panduan</button>
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
          <label class="field-label">Recovery Email</label>
          <input type="email" id="auth-email" placeholder="kamu@email.com" class="inp">
          <p style="font-size:10.5px; color:var(--warn); margin-top:6px;">1 perangkat hanya bisa mendaftar 1 akun</p>
        </div>
      </div>
      <button onclick="handleAuthAction()" id="auth-submit-btn" class="btn"><span id="auth-btn-text">Masuk</span></button>
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
              <div style="font-size:12px; font-weight:800; color:var(--warn);">VIP Premium</div>
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
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div class="chat-wrap">
        <div id="chat-messages" class="chat-stream"><p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Memuat...</p></div>
        <div class="chat-input-bar">
          <input type="text" id="chat-input" placeholder="Tulis pesan..." maxlength="500" class="inp" onkeydown="if(event.key==='Enter')sendChatMessage()">
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
      <div style="padding-top:12px; border-top:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;">
          <div class="section-head" style="margin:0; color:var(--info);">Gmail Terverifikasi</div>
          <button onclick="loadVerifiedEmails()" class="btn btn-ghost btn-xs">Refresh</button>
        </div>
        <div id="quota-status-card" style="padding:11px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.25); border-radius:9px; margin-bottom:9px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--info); letter-spacing:0.06em;">Status Kuota</div>
            <span id="quota-status-badge" class="badge badge-ok" style="font-size:9px;">Tersedia</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; text-align:center;">
            <div><div style="font-size:9px; color:var(--text-2);">Terpakai</div><div id="quota-used-display" class="mono" style="font-size:13px; font-weight:800;">0</div></div>
            <div><div style="font-size:9px; color:var(--text-2);">Tersisa</div><div id="quota-remain-display" class="mono" style="font-size:13px; font-weight:800; color:var(--info);">2</div></div>
            <div><div style="font-size:9px; color:var(--text-2);">Total</div><div id="quota-total-display" class="mono" style="font-size:13px; font-weight:800; color:var(--accent);">2</div></div>
          </div>
        </div>
        <div id="reset-countdown-card" class="hide" style="padding:13px; background:linear-gradient(135deg,var(--err-soft),var(--accent-soft)); border:1px solid rgba(248,113,113,0.3); border-radius:11px; margin-bottom:9px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <div style="width:34px; height:34px; border-radius:9px; background:rgba(248,113,113,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div><div style="font-size:12px; font-weight:800; color:var(--err);">Kuota habis</div><div style="font-size:10.5px; color:var(--text-1);">Reset dalam:</div></div>
          </div>
          <div class="countdown-grid">
            <div class="countdown-cell"><div id="countdown-hours" class="countdown-num">00</div><div class="countdown-lbl">Jam</div></div>
            <div class="countdown-cell"><div id="countdown-minutes" class="countdown-num">00</div><div class="countdown-lbl">Menit</div></div>
            <div class="countdown-cell"><div id="countdown-seconds" class="countdown-num">00</div><div class="countdown-lbl">Detik</div></div>
          </div>
          <p style="font-size:10px; text-align:center; color:var(--text-1); margin-top:8px;">Reset berikutnya: <span id="next-reset-time" class="mono" style="color:var(--err); font-weight:700;">-</span></p>
        </div>
        <div id="verified-emails-list" style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto;">
          <p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px; font-style:italic;">Memuat...</p>
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

    <div id="section-guide" class="hide card" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid var(--line);">
        <div class="section-head" style="margin:0;">Panduan</div>
        <button onclick="switchView('generator')" class="btn btn-ghost btn-xs">← Kembali</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:10px; padding:10px; background:var(--bg-2); border:1px solid var(--line); border-radius:9px;"><div style="width:24px; height:24px; border-radius:50%; background:var(--accent); color:white; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">1</div><div style="font-size:12px; color:var(--text-1);">Login/daftar dulu dengan akunmu</div></div>
        <div style="display:flex; gap:10px; padding:10px; background:var(--bg-2); border:1px solid var(--line); border-radius:9px;"><div style="width:24px; height:24px; border-radius:50%; background:var(--accent); color:white; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">2</div><div style="font-size:12px; color:var(--text-1);"><strong>Alight Motion:</strong> Masukkan email target, kirim magic link, copy URL, verifikasi</div></div>
        <div style="display:flex; gap:10px; padding:10px; background:var(--bg-2); border:1px solid var(--line); border-radius:9px;"><div style="width:24px; height:24px; border-radius:50%; background:var(--netflix); color:white; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">3</div><div style="font-size:12px; color:var(--text-1);"><strong>Netflix:</strong> Pilih plan, klik Generate, tunggu proses</div></div>
        <div style="display:flex; gap:10px; padding:10px; background:var(--bg-2); border:1px solid var(--line); border-radius:9px;"><div style="width:24px; height:24px; border-radius:50%; background:var(--info); color:white; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">4</div><div style="font-size:12px; color:var(--text-1);"><strong>Setiap generator membuat Order ID otomatis</strong>, cek di "Orderan Saya"</div></div>
        <div style="display:flex; gap:10px; padding:10px; background:var(--bg-2); border:1px solid var(--line); border-radius:9px;"><div style="width:24px; height:24px; border-radius:50%; background:var(--warn); color:#3a2800; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">5</div><div style="font-size:12px; color:var(--text-1);"><strong>Kuota sama semua fitur.</strong> Bonus kuota expired dalam 2 hari jika tidak dipakai.</div></div>
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

  <div style="text-align:center; font-size:10px; color:var(--text-2); padding:10px 0; letter-spacing:0.08em; text-transform:uppercase; font-weight:600;">AM Premium • Banggus</div>
</div>

<script>
const DANA_ADMIN_NUMBER = '${DANA_ADMIN_NUMBER}';
const DANA_ADMIN_NAME = '${DANA_ADMIN_NAME}';
const BASE_QUOTA = 2;

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

const CACHE_DURATION = { status:30000, video:60000, chat:15000, emails:30000, redeems:60000, announcements:60000, netflixHistory:30000, myOrders:15000, adminOrders:15000, onlineUsers:15000 };
const memoryCache = {};

function getCached(key) {
  const entry = memoryCache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > entry.duration) { delete memoryCache[key]; return null; }
  return entry.data;
}
function setCache(key, data, duration) { memoryCache[key] = { data, time: Date.now(), duration }; }

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
  if (loggedInUsername) navigator.sendBeacon('/api/online/offline', JSON.stringify({ username: loggedInUsername }));
});

function toggleMenu() {
  const drawer = document.getElementById('nav-drawer');
  const overlay = document.getElementById('drawer-overlay');
  drawer.classList.toggle('open');
  overlay.classList.toggle('hide');
}

function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll('[data-nav]').forEach(el => { el.classList.toggle('active', el.dataset.nav === viewName); });
  toggleMenu();
  ['terminal-view','section-profile','section-guide','section-announcement','section-chat','section-admin','section-request','section-vipshop','section-netflix','section-orders'].forEach(id => { document.getElementById(id).classList.add('hide'); });
  if (viewName === 'generator') document.getElementById('terminal-view').classList.remove('hide');
  else if (viewName === 'orders') { document.getElementById('section-orders').classList.remove('hide'); loadMyOrders(); }
  else if (viewName === 'netflix') { document.getElementById('section-netflix').classList.remove('hide'); loadNetflixHistory(); updateNetflixQuotaDisplay(); }
  else if (viewName === 'vipshop') {
    document.getElementById('section-vipshop').classList.remove('hide');
    loadVipShopItems(); loadUserTransactions();
    document.getElementById('dana-number-display').innerText = DANA_ADMIN_NUMBER;
    document.getElementById('dana-owner-display').innerText = 'a.n. ' + DANA_ADMIN_NAME;
  }
  else if (viewName === 'profile') { document.getElementById('section-profile').classList.remove('hide'); loadVerifiedEmails(); }
  else if (viewName === 'guide') document.getElementById('section-guide').classList.remove('hide');
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
    const typeIcon = o.type === 'am' ? '🎨' : o.type === 'netflix' ? '🎬' : '📱';
    const typeLabel = o.type === 'am' ? 'Alight Motion' : o.type === 'netflix' ? 'Netflix' : 'Unknown';
    const typeBadge = o.type === 'am' ? 'badge-accent' : o.type === 'netflix' ? 'badge-err' : 'badge-muted';
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
    const typeIcon = o.type === 'am' ? '🎨' : o.type === 'netflix' ? '🎬' : '📱';
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
  } else {
    ind.style.transform = 'translateX(100%)'; regBtn.style.color = 'white'; loginBtn.style.color = 'var(--text-1)';
    emailField.classList.remove('hide'); btnText.innerText = 'Daftar';
  }
}

async function handleAuthAction() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const email = document.getElementById('auth-email').value.trim();
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
    const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mode: currentAuthMode, username, password, email, deviceToken }) });
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
  const container = document.getElementById('verified-emails-list');
  if (!container) return;
  container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:8px;">⏳ Memuat...</p>';
  try {
    const res = await fetch('/api/user/my-emails?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (!data.success) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Gagal</p>'; return; }
    lastEmailsFetch = now; setCache('verifiedEmails', data, CACHE_DURATION.emails); renderVerifiedEmails(data);
  } catch (e) { container.innerHTML = '<p style="font-size:11px; color:var(--err); text-align:center; padding:8px;">Kesalahan koneksi</p>'; }
}

function renderVerifiedEmails(data) {
  const container = document.getElementById('verified-emails-list');
  if (!container) return;
  updateQuotaStatusCard(data);
  handleCountdown(data);
  updateNetflixQuotaDisplay();
  const emails = data.activatedEmails || [];
  if (emails.length === 0) {
    container.innerHTML = '<div style="padding:11px; text-align:center; background:var(--bg-2); border:1px dashed var(--line-2); border-radius:9px;"><div style="font-size:11.5px; color:var(--text-1); font-weight:600;">Belum ada Gmail</div><div style="font-size:10px; color:var(--text-2); margin-top:2px;">Gmail yang terverifikasi akan muncul di sini</div></div>';
    return;
  }
  container.innerHTML = emails.map((email, idx) => {
    const isLatest = idx === emails.length - 1;
    const safeEmail = email.replace(/'/g, "\\\\'");
    return '<div style="padding:8px 11px; background:var(--info-soft); border:1px solid rgba(96,165,250,0.25); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:8px;"><div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;"><div style="width:28px; height:28px; border-radius:7px; background:rgba(96,165,250,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div style="min-width:0; flex:1;"><div class="mono" style="font-size:11px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(email) + '</div><div style="display:flex; align-items:center; gap:4px; margin-top:2px;"><span style="font-size:9px; color:var(--ok); font-weight:700;">●</span><span style="font-size:9px; color:var(--ok); font-weight:700;">Terverifikasi</span>' + (isLatest ? '<span style="font-size:9px; color:var(--warn); font-weight:700;">• Terbaru</span>' : '') + '</div></div></div><button onclick="copyEmail(\\'' + safeEmail + '\\')" class="btn btn-ghost btn-xs" style="flex-shrink:0;">Copy</button></div>';
  }).join('');
}

function updateQuotaStatusCard(data) {
  const total = data.totalQuota || BASE_QUOTA;
  const used = data.usedQuota || 0;
  const remain = Math.max(0, total - used);
  document.getElementById('quota-used-display').innerText = used;
  document.getElementById('quota-remain-display').innerText = (data.isAdmin || data.isVip) ? '∞' : remain;
  document.getElementById('quota-total-display').innerText = (data.isAdmin || data.isVip) ? '∞' : total;
  const card = document.getElementById('quota-status-card');
  const badge = document.getElementById('quota-status-badge');
  if (data.isAdmin || data.isVip) { card.style.background = 'var(--accent-soft)'; card.style.borderColor = 'rgba(139,124,246,0.3)'; badge.className = 'badge badge-accent'; badge.innerText = data.isAdmin ? '👑 Admin' : '⭐ VIP'; }
  else if (remain <= 0) { card.style.background = 'var(--err-soft)'; card.style.borderColor = 'rgba(248,113,113,0.3)'; badge.className = 'badge badge-err'; badge.innerText = '✗ Habis'; }
  else if (remain <= 1) { card.style.background = 'var(--warn-soft)'; card.style.borderColor = 'rgba(251,191,36,0.3)'; badge.className = 'badge badge-warn'; badge.innerText = '⚠ Terbatas'; }
  else { card.style.background = 'var(--info-soft)'; card.style.borderColor = 'rgba(96,165,250,0.25)'; badge.className = 'badge badge-ok'; badge.innerText = '✓ Tersedia'; }
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

function copyEmail(email) { navigator.clipboard.writeText(email).then(() => showToast('Tersalin!', 'success')).catch(() => showToast('Gagal', 'error')); }

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

function renderGlobalChat(data) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  if (!data.success || !data.messages) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada</p>'; return; }
  const entries = Object.entries(data.messages).sort((a,b) => a[1].timestamp - b[1].timestamp);
  if (entries.length === 0) { container.innerHTML = '<p style="font-size:11px; color:var(--text-2); text-align:center; padding:12px; font-style:italic;">Belum ada. Jadilah yang pertama!</p>'; return; }
  if (entries.length > 0) lastChatMessageId = entries[entries.length - 1][0];
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  container.innerHTML = entries.map(([id, msg]) => {
    const isMe = msg.username === loggedInUsername;
    const isAdmin = msg.isAdmin;
    const isVip = msg.isVip;
    const bubbleClass = isMe ? 'chat-msg-me' : 'chat-msg-them';
    const roleIcon = isAdmin ? '👑 ' : isVip ? '⭐ ' : '👤 ';
    const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const isToday = new Date(msg.timestamp).toDateString() === new Date().toDateString();
    const timeStr = isToday ? time : date + ' ' + time;
    const deleteBtn = isAdminUser ? ' <button onclick="deleteChatMessage(\\'' + id + '\\')" style="background:none; border:none; font-size:9px; opacity:0.5; cursor:pointer; margin-left:2px;">🗑</button>' : '';
    return '<div class="chat-msg ' + bubbleClass + '"><div class="chat-msg-header">' + roleIcon + '<span>' + escapeHtml(msg.username) + '</span>' + (isAdmin ? ' · ADMIN' : '') + (isVip && !isAdmin ? ' · VIP' : '') + deleteBtn + '</div><div>' + escapeHtml(msg.message) + '</div><div class="chat-time">' + timeStr + '</div></div>';
  }).join('');
  if (wasAtBottom || container.scrollTop === 0) container.scrollTop = container.scrollHeight;
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
const PORT = 3001;

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
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) { reject(new Error('Payload too large')); req.destroy(); }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let currentServerStatus = await getServerStatusFromDb();

  try {
    if (parsedUrl.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Content-Length': Buffer.byteLength(htmlTemplate)
      });
      res.end(htmlTemplate);

    } else if (parsedUrl.pathname === '/api/status') {
      jsonResponse(res, 200, { status: currentServerStatus });

    } else if (parsedUrl.pathname === '/api/video') {
      const videoUrl = await getVideoFromDb();
      jsonResponse(res, 200, { success: true, videoUrl });

    } else if (parsedUrl.pathname === '/api/announcements') {
      const announcements = await getAllAnnouncementsFromDb();
      jsonResponse(res, 200, { success: true, announcements });

    } else if (parsedUrl.pathname === '/api/vip-shop' && req.method === 'GET') {
      const items = await getVipShopFromDb();
      jsonResponse(res, 200, { success: true, items });

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
      jsonResponse(res, 200, { success: true, count: active.length, users: active });

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
      if (userObj.password !== oldPassword) return jsonResponse(res, 401, { success: false, message: 'Password lama salah!' });
      userObj.password = newPassword;
      await saveUserToDb(cleanUser, userObj);
      jsonResponse(res, 200, { success: true, message: 'Password diubah!' });

    } else if (parsedUrl.pathname === '/api/chat/messages' && req.method === 'GET') {
      const messages = await getGlobalChatFromDb();
      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      for (const [id, msg] of Object.entries(messages)) {
        if (now - msg.timestamp > threeDays) { await deleteGlobalChatMessageFromDb(id); delete messages[id]; }
      }
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
      await saveUserToDb(cleanVipUser, { password: vipPassword, email: 'vip@am-premium.local', isAdmin: false, activatedEmails: [], bonusQuota: 0, baseQuota: BASE_QUOTA, lastResetTime: now, vipUntil, isVipAccount: true, createdBy: adminUsername.toLowerCase(), createdAt: now });
      const vipAccId = 'vip_' + now + '_' + Math.random().toString(36).substring(2, 8);
      await saveVipAccountToDb(vipAccId, { username: cleanVipUser, password: vipPassword, vipUntil, createdBy: adminUsername.toLowerCase(), createdAt: now });
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
        enriched[id] = { ...acc, isActive: userData && userData.vipUntil > now, currentVipUntil: userData ? (userData.vipUntil || 0) : 0, exists: !!userData };
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
      const cleanNew = newUsername.trim().toLowerCase();
      const existingUser = await getUserFromDb(cleanNew);
      if (existingUser) return jsonResponse(res, 400, { success: false, message: 'Username sudah digunakan.' });
      const userData = await getUserFromDb(cleanOld);
      if (!userData) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan.' });
      await saveUserToDb(cleanNew, userData);
      await set(ref(db, `users/${cleanOld}`), null);
      jsonResponse(res, 200, { success: true, newUsername: cleanNew });

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
      const cleanUser = username.toLowerCase();
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
      const { mode, username, password, email, deviceToken } = JSON.parse(body);
      const cleanUser = username.trim().toLowerCase();
      let existingUser = await getUserFromDb(cleanUser);
      if (mode === 'register') {
        if (cleanUser === 'adminbaguss' || existingUser) return jsonResponse(res, 400, { success: false, message: 'Username tidak tersedia!' });
        const newDeviceToken = deviceToken || ('dev_' + Math.random().toString(36).substring(2) + Date.now());
        await saveUserToDb(cleanUser, { password, email, isAdmin: false, activatedEmails: [], bonusQuota: 0, baseQuota: BASE_QUOTA, lastResetTime: Date.now(), vipUntil: 0, deviceToken: newDeviceToken });
        const fakeAuthToken = 'token_' + Math.random().toString(36).substring(2) + Date.now();
        return jsonResponse(res, 200, { success: true, message: 'Registrasi berhasil!', username: cleanUser, isAdmin: false, usedQuota: 0, bonusQuota: 0, totalQuota: BASE_QUOTA, isVip: false, serverStatus: currentServerStatus, deviceToken: newDeviceToken, token: fakeAuthToken });
      } else {
        if (existingUser && existingUser.password === password) {
          await checkAndExpireBonusQuota(cleanUser);
          existingUser = await getUserFromDb(cleanUser);
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000;
          if (!existingUser.lastResetTime) existingUser.lastResetTime = now;
          if (now - existingUser.lastResetTime >= twentyFourHours) { existingUser.activatedEmails = []; existingUser.lastResetTime = now; await saveUserToDb(cleanUser, existingUser); }
          const isVipActive = existingUser.vipUntil && existingUser.vipUntil > now;
          const usedCount = existingUser.activatedEmails ? existingUser.activatedEmails.length : 0;
          const fakeAuthToken = 'token_' + Math.random().toString(36).substring(2) + Date.now();
          return jsonResponse(res, 200, { success: true, message: 'Login berhasil!', username: cleanUser, isAdmin: existingUser.isAdmin, usedQuota: usedCount, bonusQuota: existingUser.bonusQuota || 0, totalQuota: (existingUser.baseQuota || BASE_QUOTA) + (existingUser.bonusQuota || 0), isVip: isVipActive, vipUntil: existingUser.vipUntil || 0, serverStatus: currentServerStatus, token: fakeAuthToken });
        }
        return jsonResponse(res, 401, { success: false, message: 'Username atau password salah!' });
      }

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
    if (!res.headersSent) jsonResponse(res, 500, { success: false, message: err.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 AM Premium Banggus v7.2                                  ║');
  console.log('║  📡 http://localhost:' + PORT + '                                    ║');
  console.log('║  💳 DANA Admin: ' + DANA_ADMIN_NUMBER + '                     ║');
  console.log('║  ──────────────────────────────────────────────────────────  ║');
  console.log('║  ✨ FITUR AKTIF:                                             ║');
  console.log('║  🎨 Alight Motion Premium                                    ║');
  console.log('║  🎬 Netflix Token Generator                                  ║');
  console.log('║  🛒 VIP Shop & Transaksi                                     ║');
  console.log('║  💬 Chat Global & Orderan                                    ║');
  console.log('║  ⚙️  Panel Admin Lengkap                                     ║');
  console.log('║  ──────────────────────────────────────────────────────────  ║');
  console.log('║  🗑️  APK MOD & TEMP MAIL TELAH DIHAPUS                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
});