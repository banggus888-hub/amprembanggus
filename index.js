const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Go = require('@xof/fetch');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, child } = require('firebase/database');

const config = {
  base: 'https://restapidhan.vercel.app',
  apikey: 'freeapikeydhan26'
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

const go = Go.create({
  baseURL: config.base,
  browser: true,
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
          if (fs.statSync(fp).isDirectory()) {
            fs.rmSync(fp, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fp);
          }
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
async function saveServerStatusToDb(status) {
  await set(ref(db, `settings/serverStatus`), status);
}
async function getUserFromDb(username) {
  if (!username) return null;
  const snapshot = await get(child(ref(db), `users/${username}`));
  return snapshot.exists() ? snapshot.val() : null;
}
async function saveUserToDb(username, userData) {
  await set(ref(db, `users/${username}`), userData);
}
async function deleteUserFromDb(username) {
  await set(ref(db, `users/${username}`), null);
}
async function getRedeemFromDb(code) {
  const snapshot = await get(child(ref(db), `redeems/${code}`));
  return snapshot.exists() ? snapshot.val() : null;
}
async function saveRedeemToDb(code, data) {
  await set(ref(db, `redeems/${code}`), data);
}
async function removeRedeemFromDb(code) {
  await set(ref(db, `redeems/${code}`), null);
}
async function getAllRedeemsFromDb() {
  const snapshot = await get(child(ref(db), `redeems`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function getAllAnnouncementsFromDb() {
  const snapshot = await get(child(ref(db), `announcements`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveAnnouncementToDb(id, data) {
  await set(ref(db, `announcements/${id}`), data);
}
async function removeAnnouncementFromDb(id) {
  await set(ref(db, `announcements/${id}`), null);
}
async function getAllUsersFromDb() {
  const snapshot = await get(child(ref(db), `users`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function getVideoFromDb() {
  const snapshot = await get(child(ref(db), `settings/featuredVideo`));
  return snapshot.exists() ? snapshot.val() : 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-lights-31910-large.mp4';
}
async function saveVideoToDb(videoUrl) {
  await set(ref(db, `settings/featuredVideo`), videoUrl);
}

// ====== GLOBAL CHAT HELPERS ======
async function getGlobalChatFromDb() {
  const snapshot = await get(child(ref(db), `globalChat`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveGlobalChatMessageToDb(id, data) {
  await set(ref(db, `globalChat/${id}`), data);
}
async function deleteGlobalChatMessageFromDb(id) {
  await set(ref(db, `globalChat/${id}`), null);
}

// ====== VIP ACCOUNTS HELPERS ======
async function getVipAccountsFromDb() {
  const snapshot = await get(child(ref(db), `vipAccounts`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveVipAccountToDb(id, data) {
  await set(ref(db, `vipAccounts/${id}`), data);
}
async function removeVipAccountFromDb(id) {
  await set(ref(db, `vipAccounts/${id}`), null);
}

// ====== FEATURE REQUESTS HELPERS ======
async function getFeatureRequestsFromDb() {
  const snapshot = await get(child(ref(db), `featureRequests`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveFeatureRequestToDb(id, data) {
  await set(ref(db, `featureRequests/${id}`), data);
}
async function removeFeatureRequestFromDb(id) {
  await set(ref(db, `featureRequests/${id}`), null);
}

// ====== VIP PACKAGES HELPERS ======
async function getVipPackagesFromDb() {
  const snapshot = await get(child(ref(db), `settings/vipPackages`));
  return snapshot.exists() ? snapshot.val() : getDefaultVipPackages();
}
async function saveVipPackagesToDb(packages) {
  await set(ref(db, `settings/vipPackages`), packages);
}

function getDefaultVipPackages() {
  return {
    'vip_7': { id: 'vip_7', name: 'VIP 7 Hari', days: 7, price: 2000, active: true },
    'vip_30': { id: 'vip_30', name: 'VIP 30 Hari', days: 30, price: 5000, active: true },
    'vip_90': { id: 'vip_90', name: 'VIP 90 Hari', days: 90, price: 12000, active: true },
    'vip_365': { id: 'vip_365', name: 'VIP 1 Tahun', days: 365, price: 40000, active: true }
  };
}

// ====== PAYMENT SETTINGS HELPERS ======
async function getPaymentSettingsFromDb() {
  const snapshot = await get(child(ref(db), `settings/payment`));
  return snapshot.exists() ? snapshot.val() : getDefaultPaymentSettings();
}
async function savePaymentSettingsToDb(settings) {
  await set(ref(db, `settings/payment`), settings);
}

function getDefaultPaymentSettings() {
  return {
    qrImage: '', // akan diisi QR code base64 dari user
    merchantName: 'AM Premium Store',
    paymentNote: 'Scan QRIS untuk melakukan pembayaran',
    adminWhatsapp: ''
  };
}

// ====== ORDERS HELPERS ======
async function getOrdersFromDb() {
  const snapshot = await get(child(ref(db), `orders`));
  return snapshot.exists() ? snapshot.val() : {};
}
async function saveOrderToDb(id, data) {
  await set(ref(db, `orders/${id}`), data);
}
async function removeOrderFromDb(id) {
  await set(ref(db, `orders/${id}`), null);
}
async function getOrderFromDb(id) {
  const snapshot = await get(child(ref(db), `orders/${id}`));
  return snapshot.exists() ? snapshot.val() : null;
}

async function initAdmin() {
  const adminData = await getUserFromDb('adminbaguss');
  if (!adminData) {
    await saveUserToDb('adminbaguss', {
      password: 'baguss',
      isAdmin: true,
      activatedEmails: [],
      bonusQuota: 0,
      lastResetTime: Date.now(),
      vipUntil: 0
    });
  }
  
  // Init default VIP packages if not exists
  const packages = await getVipPackagesFromDb();
  if (!packages || Object.keys(packages).length === 0) {
    await saveVipPackagesToDb(getDefaultVipPackages());
  }
  
  // Init default payment settings
  const paymentSettings = await getPaymentSettingsFromDb();
  if (!paymentSettings.qrImage) {
    // QR code default dari user (placeholder - akan diupdate admin)
    await savePaymentSettingsToDb({
      ...getDefaultPaymentSettings(),
      qrImage: '' // Admin harus upload QR sendiri
    });
  }
}
initAdmin();

const am = {
  async magiclink(email) {
    if (!email.includes("@") || !email.includes(".")) throw new Error("Invalid email.");
    const { data } = await go.get('/api/am', {
      query: { action: 'send', apikey: config.apikey, email }
    });
    return data;
  },
  async verif(email, url) {
    const { data } = await go.get('/api/am', {
      query: { action: 'verif', apikey: config.apikey, email, url }
    });
    return data;
  }
};

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
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-primary: #07040f;
    --bg-secondary: #0f0a1e;
    --purple: #a855f7;
    --purple-dark: #7e22ce;
    --cyan: #06b6d4;
    --emerald: #10b981;
    --rose: #f43f5e;
    --amber: #f59e0b;
  }
  * { -webkit-tap-highlight-color: transparent; }
  html, body {
    width: 100%; max-width: 100%; overflow-x: hidden; margin: 0; padding: 0;
    background: var(--bg-primary);
    color: #e2e8f0;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  body::before {
    content: '';
    position: fixed; inset: 0;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(168,85,247,0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(126,34,206,0.05) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }
  .mono { font-family: 'JetBrains Mono', monospace; }
  
  .phone-wrapper {
    width: 100%; max-width: 540px; margin: 0 auto;
    min-height: 100vh; display: flex; flex-direction: column;
    padding: 1rem; position: relative; z-index: 1; box-sizing: border-box;
  }

  .glass-panel {
    background: linear-gradient(145deg, rgba(20,14,38,0.85), rgba(12,8,24,0.75));
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    border: 1px solid rgba(168,85,247,0.18);
    box-shadow: 0 20px 60px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04);
    border-radius: 1.5rem;
    padding: 1.5rem;
    position: relative;
  }
  .glass-panel::before {
    content: '';
    position: absolute; inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, rgba(168,85,247,0.4), transparent 40%, transparent 60%, rgba(6,182,212,0.3));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  .input-glow {
    background: rgba(7,4,15,0.85);
    border: 1.5px solid rgba(168,85,247,0.18);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 1rem;
    padding: 0.85rem 1.15rem;
    font-size: 0.92rem;
    color: #e2e8f0;
    width: 100%;
    box-sizing: border-box;
  }
  .input-glow:focus {
    border-color: rgba(168,85,247,0.8);
    box-shadow: 0 0 0 4px rgba(168,85,247,0.12), 0 0 30px rgba(168,85,247,0.2);
    outline: none;
    background: rgba(7,4,15,0.95);
  }
  .input-glow::placeholder { color: #4b5563; }

  .btn-primary {
    background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
    box-shadow: 0 12px 30px -10px rgba(168,85,247,0.6), inset 0 1px 0 rgba(255,255,255,0.2);
    transition: all 0.25s ease;
    border-radius: 1rem;
    padding: 0.95rem 1rem;
    font-weight: 700;
    color: white;
    width: 100%;
    border: none;
    cursor: pointer;
    font-size: 0.92rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 40px -10px rgba(168,85,247,0.8); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    box-shadow: 0 12px 30px -10px rgba(16,185,129,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
    border-radius: 1rem; padding: 0.95rem 1rem;
    font-weight: 700; color: #031a12; width: 100%; border: none;
    cursor: pointer; font-size: 0.92rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    transition: all 0.25s ease;
  }
  .btn-success:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 40px -10px rgba(16,185,129,0.7); }

  .btn-danger {
    background: linear-gradient(135deg, #f43f5e 0%, #dc2626 100%);
    box-shadow: 0 12px 30px -10px rgba(244,63,94,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
    border-radius: 1rem; padding: 0.95rem 1rem;
    font-weight: 700; color: white; width: 100%; border: none;
    cursor: pointer; font-size: 0.92rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    transition: all 0.25s ease;
  }
  .btn-danger:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 40px -10px rgba(244,63,94,0.7); }

  .btn-secondary {
    background: rgba(168,85,247,0.1);
    border: 1px solid rgba(168,85,247,0.25);
    color: #c4b5fd;
    border-radius: 0.85rem; padding: 0.65rem 1rem;
    font-weight: 600; font-size: 0.82rem;
    cursor: pointer; transition: all 0.2s;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  }
  .btn-secondary:hover { background: rgba(168,85,247,0.2); border-color: rgba(168,85,247,0.5); }

  #nav-drawer {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(105%);
    width: 85%; max-width: 340px;
    padding: 1.5rem;
    background: linear-gradient(180deg, rgba(15,10,30,0.98), rgba(7,4,15,0.99));
    backdrop-filter: blur(30px);
    border-left: 1px solid rgba(168,85,247,0.2);
    overflow-y: auto;
  }
  #nav-drawer.open { transform: translateX(0); }

  .nav-item {
    width: 100%; display: flex; align-items: center; gap: 0.85rem;
    padding: 0.85rem 1rem; border-radius: 0.9rem;
    color: #94a3b8; font-weight: 600; font-size: 0.88rem;
    transition: all 0.2s; text-align: left; background: transparent;
    border: 1px solid transparent; cursor: pointer;
  }
  .nav-item:hover {
    background: rgba(168,85,247,0.08);
    color: #c4b5fd;
    border-color: rgba(168,85,247,0.15);
  }
  .nav-item.active {
    background: linear-gradient(135deg, rgba(168,85,247,0.18), rgba(126,34,206,0.1));
    color: #e9d5ff;
    border-color: rgba(168,85,247,0.35);
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1.3); opacity: 0; }
  }
  .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
  .pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
  
  .toast {
    position: fixed; top: 1.25rem; left: 50%; transform: translateX(-50%) translateY(-120%);
    padding: 0.85rem 1.25rem; border-radius: 1rem;
    font-weight: 600; font-size: 0.85rem;
    z-index: 9999; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 90%; display: flex; align-items: center; gap: 0.6rem;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7);
    backdrop-filter: blur(20px);
  }
  .toast.show { transform: translateX(-50%) translateY(0); }
  .toast-success { background: rgba(16,185,129,0.95); color: #031a12; }
  .toast-error { background: rgba(244,63,94,0.95); color: white; }
  .toast-info { background: rgba(168,85,247,0.95); color: white; }

  .progress-bar {
    width: 100%; height: 8px; background: rgba(168,85,247,0.1);
    border-radius: 999px; overflow: hidden; position: relative;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #a855f7, #06b6d4, #a855f7);
    background-size: 200% 100%;
    animation: shimmer 2s linear infinite;
    border-radius: 999px;
    transition: width 0.3s ease;
    width: 0%;
  }

  .badge {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.7rem; border-radius: 999px;
    font-size: 0.7rem; font-weight: 700;
    border: 1px solid;
  }
  .badge-online { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.35); color: #6ee7b7; }
  .badge-offline { background: rgba(244,63,94,0.12); border-color: rgba(244,63,94,0.35); color: #fda4af; }
  .badge-admin { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.4); color: #fbbf24; }
  .badge-vip { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.4); color: #d8b4fe; }
  .badge-user { background: rgba(148,163,184,0.1); border-color: rgba(148,163,184,0.3); color: #cbd5e1; }
  .badge-pending { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); color: #fbbf24; }
  .badge-process { background: rgba(6,182,212,0.15); border-color: rgba(6,182,212,0.4); color: #67e8f9; }
  .badge-success { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #6ee7b7; }
  .badge-failed { background: rgba(244,63,94,0.15); border-color: rgba(244,63,94,0.4); color: #fda4af; }

  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(168,85,247,0.25), transparent);
    margin: 0.75rem 0;
  }

  .section-title {
    font-size: 0.72rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: #a78bfa; margin-bottom: 0.6rem;
    display: flex; align-items: center; gap: 0.4rem;
  }

  .stat-card {
    background: rgba(7,4,15,0.6);
    border: 1px solid rgba(168,85,247,0.15);
    border-radius: 1rem; padding: 0.85rem 1rem;
    display: flex; align-items: center; justify-content: space-between;
  }

  .file-drop {
    border: 2px dashed rgba(168,85,247,0.3);
    border-radius: 1rem; padding: 1.5rem 1rem;
    text-align: center; transition: all 0.25s;
    cursor: pointer; background: rgba(7,4,15,0.4);
  }
  .file-drop:hover, .file-drop.dragover {
    border-color: rgba(168,85,247,0.7);
    background: rgba(168,85,247,0.08);
  }

  .video-container {
    width: 100%; height: 180px; border-radius: 1.25rem;
    overflow: hidden; position: relative;
    border: 1px solid rgba(168,85,247,0.3);
    box-shadow: 0 0 40px rgba(168,85,247,0.15);
    background: black;
  }
  .video-container video { width: 100%; height: 100%; object-fit: cover; }

  .icon-btn {
    width: 2.75rem; height: 2.75rem;
    display: flex; align-items: center; justify-content: center;
    border-radius: 0.85rem;
    background: rgba(15,10,30,0.9);
    border: 1px solid rgba(168,85,247,0.25);
    color: #c4b5fd; cursor: pointer;
    transition: all 0.25s ease;
  }
  .icon-btn:hover {
    border-color: rgba(168,85,247,0.6);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -5px rgba(168,85,247,0.4);
  }

  .countdown-box {
    background: rgba(7,4,15,0.6);
    border: 1px solid rgba(244,63,94,0.25);
    border-radius: 0.75rem;
    padding: 0.5rem;
    text-align: center;
  }
  .countdown-num {
    font-size: 1.15rem; font-weight: 800;
    color: white; font-family: 'JetBrains Mono', monospace;
    line-height: 1;
  }
  .countdown-label {
    font-size: 0.6rem; color: #94a3b8;
    text-transform: uppercase; font-weight: 700;
    margin-top: 0.25rem;
    letter-spacing: 0.05em;
  }

  .chat-container {
    display: flex; flex-direction: column;
    height: 420px;
    background: rgba(7,4,15,0.5);
    border-radius: 1rem;
    border: 1px solid rgba(168,85,247,0.15);
    overflow: hidden;
  }
  .chat-messages {
    flex: 1; overflow-y: auto;
    padding: 0.85rem;
    display: flex; flex-direction: column;
    gap: 0.6rem;
  }
  .chat-bubble {
    max-width: 85%;
    padding: 0.6rem 0.85rem;
    border-radius: 1rem;
    font-size: 0.82rem;
    line-height: 1.4;
    word-wrap: break-word;
    animation: slide-up 0.3s ease;
  }
  .chat-bubble-other {
    align-self: flex-start;
    background: rgba(30,20,55,0.9);
    border: 1px solid rgba(168,85,247,0.2);
    color: #e2e8f0;
    border-bottom-left-radius: 0.25rem;
  }
  .chat-bubble-me {
    align-self: flex-end;
    background: linear-gradient(135deg, #a855f7, #7e22ce);
    color: white;
    border-bottom-right-radius: 0.25rem;
    box-shadow: 0 4px 15px -5px rgba(168,85,247,0.5);
  }
  .chat-bubble-admin {
    border: 1px solid rgba(245,158,11,0.5);
  }
  .chat-bubble-vip {
    border: 1px solid rgba(168,85,247,0.5);
  }
  .chat-meta {
    font-size: 0.65rem;
    opacity: 0.7;
    margin-bottom: 0.25rem;
    display: flex; align-items: center; gap: 0.35rem;
    font-weight: 700;
  }
  .chat-input-row {
    display: flex; gap: 0.5rem;
    padding: 0.65rem;
    border-top: 1px solid rgba(168,85,247,0.15);
    background: rgba(7,4,15,0.7);
  }
  .chat-input-row input {
    flex: 1;
    background: rgba(30,20,55,0.6);
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 0.75rem;
    padding: 0.6rem 0.85rem;
    font-size: 0.85rem;
    color: #e2e8f0;
    outline: none;
  }
  .chat-input-row input:focus {
    border-color: rgba(168,85,247,0.6);
  }
  .chat-input-row button {
    background: linear-gradient(135deg, #a855f7, #7e22ce);
    border: none;
    border-radius: 0.75rem;
    padding: 0.6rem 1rem;
    color: white;
    font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .chat-input-row button:hover { transform: translateY(-1px); box-shadow: 0 8px 20px -5px rgba(168,85,247,0.5); }

  .chat-timestamp {
    font-size: 0.6rem;
    opacity: 0.55;
    margin-top: 0.2rem;
  }

  .vip-account-card {
    background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(168,85,247,0.06));
    border: 1px solid rgba(245,158,11,0.3);
    border-radius: 1rem;
    padding: 0.85rem;
    animation: slide-up 0.3s ease;
  }

  .vip-package-card {
    background: linear-gradient(135deg, rgba(168,85,247,0.1), rgba(6,182,212,0.06));
    border: 2px solid rgba(168,85,247,0.25);
    border-radius: 1.25rem;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .vip-package-card:hover {
    border-color: rgba(168,85,247,0.6);
    transform: translateY(-3px);
    box-shadow: 0 20px 40px -15px rgba(168,85,247,0.5);
  }
  .vip-package-card.selected {
    border-color: #a855f7;
    background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.1));
    box-shadow: 0 0 30px rgba(168,85,247,0.3);
  }
  .vip-package-card::before {
    content: '';
    position: absolute;
    top: -50%; right: -50%;
    width: 200%; height: 200%;
    background: radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .vip-package-card:hover::before { opacity: 1; }

  .vip-benefit-item {
    display: flex; align-items: flex-start; gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.75rem;
    background: rgba(16,185,129,0.06);
    border: 1px solid rgba(16,185,129,0.2);
    margin-bottom: 0.5rem;
  }

  .order-card {
    background: linear-gradient(135deg, rgba(7,4,15,0.8), rgba(15,10,30,0.6));
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 1rem;
    padding: 1rem;
    animation: slide-up 0.3s ease;
  }

  .qr-container {
    background: white;
    border-radius: 1.25rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 0 40px rgba(168,85,247,0.3);
  }
  .qr-container img {
    width: 100%;
    max-width: 280px;
    height: auto;
    display: block;
    border-radius: 0.5rem;
  }
  .qr-corner {
    position: absolute;
    width: 30px; height: 30px;
    border: 3px solid #a855f7;
  }
  .qr-corner-tl { top: 8px; left: 8px; border-right: none; border-bottom: none; border-radius: 0.75rem 0 0 0; }
  .qr-corner-tr { top: 8px; right: 8px; border-left: none; border-bottom: none; border-radius: 0 0.75rem 0 0; }
  .qr-corner-bl { bottom: 8px; left: 8px; border-right: none; border-top: none; border-radius: 0 0 0 0.75rem; }
  .qr-corner-br { bottom: 8px; right: 8px; border-left: none; border-top: none; border-radius: 0 0 0.75rem 0; }

  .step-indicator {
    display: flex; align-items: center; justify-content: center;
    gap: 0.35rem;
    margin: 0.5rem 0 1rem;
  }
  .step-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: rgba(168,85,247,0.2);
    border: 1px solid rgba(168,85,247,0.3);
    transition: all 0.3s;
  }
  .step-dot.active {
    background: #a855f7;
    box-shadow: 0 0 15px rgba(168,85,247,0.6);
    transform: scale(1.2);
  }
  .step-dot.completed {
    background: #10b981;
    border-color: #10b981;
  }

  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .modal-overlay.show {
    opacity: 1;
    pointer-events: all;
  }
  .modal-content {
    background: linear-gradient(145deg, rgba(20,14,38,0.98), rgba(12,8,24,0.95));
    border: 1px solid rgba(168,85,247,0.3);
    border-radius: 1.5rem;
    padding: 1.5rem;
    max-width: 420px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 30px 80px -20px rgba(0,0,0,1);
    transform: scale(0.9);
    transition: transform 0.3s;
  }
  .modal-overlay.show .modal-content {
    transform: scale(1);
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.3); border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(168,85,247,0.5); }

  @media (max-width: 480px) {
    .phone-wrapper { padding: 0.75rem; }
    .glass-panel { padding: 1.15rem; border-radius: 1.25rem; }
    .chat-container { height: 380px; }
  }
</style>
</head>
<body>

<div id="toast-container"></div>

<!-- MODAL PEMBAYARAN -->
<div id="payment-modal" class="modal-overlay" onclick="if(event.target===this)closePaymentModal()">
  <div class="modal-content">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-extrabold text-white">Pembayaran QRIS</h3>
      <button onclick="closePaymentModal()" class="icon-btn" style="width:2.25rem;height:2.25rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="step-indicator">
      <div class="step-dot active" id="step-1"></div>
      <div class="step-dot" id="step-2"></div>
      <div class="step-dot" id="step-3"></div>
      <div class="step-dot" id="step-4"></div>
    </div>

    <!-- STEP 1: DETAIL ORDER -->
    <div id="payment-step-1">
      <div class="p-4 rounded-xl mb-4" style="background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.25);">
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs text-slate-400">ID Top Up</span>
          <span id="pay-order-id" class="text-xs font-bold text-cyan-300 mono">-</span>
        </div>
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs text-slate-400">Paket VIP</span>
          <span id="pay-package-name" class="text-xs font-bold text-white">-</span>
        </div>
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs text-slate-400">Masa Aktif</span>
          <span id="pay-package-days" class="text-xs font-bold text-purple-300">- hari</span>
        </div>
        <div class="divider"></div>
        <div class="flex justify-between items-center">
          <span class="text-sm font-bold text-slate-300">Total Bayar</span>
          <span id="pay-total-price" class="text-lg font-extrabold text-emerald-400 mono">Rp 0</span>
        </div>
      </div>

      <div class="p-4 rounded-xl mb-4" style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3);">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(245,158,11,0.2);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-xs font-bold text-amber-300">Status Pembayaran</p>
            <p id="pay-status-text" class="text-[10px] text-slate-400">Menunggu pembayaran</p>
          </div>
          <span id="pay-status-badge" class="badge badge-pending">PENDING</span>
        </div>
      </div>

      <button onclick="showPaymentStep(2)" class="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        Lanjut ke Pembayaran
      </button>
    </div>

    <!-- STEP 2: QR CODE -->
    <div id="payment-step-2" class="hidden">
      <p class="text-center text-xs text-slate-400 mb-3">Scan QRIS berikut dengan aplikasi pembayaran Anda</p>

      <div id="qr-display-container" class="qr-container mb-4">
        <div class="qr-corner qr-corner-tl"></div>
        <div class="qr-corner qr-corner-tr"></div>
        <div class="qr-corner qr-corner-bl"></div>
        <div class="qr-corner qr-corner-br"></div>
        <img id="qr-image" src="" alt="QRIS Payment" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkluZm8gUGVtYmF5YXJhbjwvdGV4dD48L3N2Zz4='">
      </div>

      <div class="p-3 rounded-xl mb-4" style="background: rgba(6,182,212,0.08); border: 1px solid rgba(6,182,212,0.3);">
        <p class="text-[10px] text-cyan-300 text-center font-bold">💡 Setelah transfer, klik "Saya Sudah Bayar" lalu upload bukti pembayaran</p>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="showPaymentStep(1)" class="btn-secondary">← Kembali</button>
        <button onclick="showPaymentStep(3)" class="btn-success" style="background: linear-gradient(135deg, #06b6d4, #0891b2); color: white;">Saya Sudah Bayar</button>
      </div>
    </div>

    <!-- STEP 3: UPLOAD BUKTI -->
    <div id="payment-step-3" class="hidden">
      <p class="text-center text-xs text-slate-400 mb-3">Upload bukti pembayaran Anda</p>

      <div class="file-drop mb-4" id="payment-file-drop">
        <input type="file" id="payment-file-input" accept="image/*" class="hidden">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5" style="margin: 0 auto 0.5rem; display: block;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="text-xs font-bold text-slate-300">Klik atau drop bukti bayar</p>
        <p class="text-[10px] text-slate-500 mt-1">JPG, PNG • Max 5MB</p>
        <p id="payment-file-info" class="text-[10px] text-purple-300 mono mt-2 hidden"></p>
      </div>

      <div id="payment-preview" class="hidden mb-4">
        <img id="payment-preview-img" src="" alt="Preview" class="w-full rounded-xl" style="max-height: 200px; object-fit: contain;">
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="showPaymentStep(2)" class="btn-secondary">← Kembali</button>
        <button onclick="submitPaymentProof()" class="btn-success" id="btn-submit-proof" disabled>Kirim Bukti</button>
      </div>
    </div>

    <!-- STEP 4: SUKSES -->
    <div id="payment-step-4" class="hidden text-center">
      <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style="background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1)); border: 2px solid rgba(16,185,129,0.5);">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h3 class="text-lg font-extrabold text-white mb-2">Bukti Terkirim!</h3>
      <p class="text-xs text-slate-400 mb-4">Bukti pembayaran Anda sedang menunggu konfirmasi admin. Akun Anda akan otomatis menjadi VIP setelah dikonfirmasi.</p>
      <div class="p-3 rounded-xl mb-4" style="background: rgba(6,182,212,0.08); border: 1px solid rgba(6,182,212,0.3);">
        <p class="text-[10px] text-cyan-300 font-bold">Status: <span class="badge badge-process" style="font-size: 0.6rem;">MENUNGGU KONFIRMASI</span></p>
      </div>
      <button onclick="closePaymentModal()" class="btn-primary">Tutup</button>
    </div>
  </div>
</div>

<div class="phone-wrapper">

  <header class="flex items-center justify-between py-2 mb-3">
    <div class="flex items-center gap-2.5">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(6,182,212,0.15)); border: 1px solid rgba(168,85,247,0.3);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>
      <div>
        <p class="text-[10px] font-bold uppercase tracking-widest text-purple-400">Premium Access</p>
        <p class="text-sm font-extrabold text-white">AM BANGGUS</p>
      </div>
    </div>
    <button id="header-menu-btn" onclick="toggleMenu()" class="icon-btn hidden">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  </header>

  <div id="drawer-overlay" onclick="toggleMenu()" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 hidden transition-opacity"></div>

  <div id="nav-drawer" class="fixed inset-y-0 right-0 z-50 flex flex-col justify-between">
    <div>
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-purple-500/20">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-purple-400">Dashboard</p>
          <h3 class="text-base font-extrabold text-white">MENU</h3>
        </div>
        <button onclick="toggleMenu()" class="icon-btn" style="width:2.25rem;height:2.25rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <nav class="space-y-1.5">
        <button onclick="switchView('generator')" data-nav="generator" class="nav-item active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Generator Utama
        </button>
        <button onclick="switchView('vip-store')" data-nav="vip-store" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
          Beli VIP Premium
          <span class="ml-auto text-[9px] px-1.5 py-0.5 rounded-full" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 700;">HOT</span>
        </button>
        <button onclick="switchView('my-orders')" data-nav="my-orders" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Pesanan Saya
        </button>
        <button onclick="switchView('chat')" data-nav="chat" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Chat Global
          <span id="chat-unread-badge" class="ml-auto hidden text-[9px] px-1.5 py-0.5 rounded-full" style="background: #f43f5e; color: white;">0</span>
        </button>
        <button onclick="switchView('profile')" data-nav="profile" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Akun & Profil
        </button>
        <button onclick="switchView('guide')" data-nav="guide" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Panduan
        </button>
        <button onclick="switchView('announcement')" data-nav="announcement" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          Pengumuman
        </button>
        <button onclick="switchView('request')" data-nav="request" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Request Fitur
        </button>
        <button id="nav-admin-btn" onclick="switchView('admin')" data-nav="admin" class="nav-item hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Panel Admin
        </button>
      </nav>
    </div>

    <div class="pt-4 border-t border-purple-500/20 space-y-3">
      <div class="flex items-center gap-2.5 p-3 rounded-xl" style="background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.15);">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black" style="background: linear-gradient(135deg, #a855f7, #7e22ce); color: white;">
          <span id="drawer-avatar">?</span>
        </div>
        <div class="flex-1 min-w-0">
          <p id="drawer-username" class="text-xs font-bold text-white truncate">Guest</p>
          <p id="drawer-role" class="text-[10px] text-purple-400 font-semibold">Belum Login</p>
        </div>
      </div>
      <button onclick="handleLogout()" id="drawer-logout-btn" class="w-full py-2.5 rounded-xl text-rose-400 text-xs font-bold transition hidden flex items-center justify-center gap-2" style="background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Keluar
      </button>
    </div>
  </div>

  <div class="flex-1 flex flex-col justify-center py-2 space-y-3">

    <div id="offline-banner" class="p-3 rounded-2xl text-xs font-semibold text-center hidden animate-slide-up" style="background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); color: #fda4af;">
      <div class="flex items-center justify-center gap-2">
        <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
        Server sedang OFFLINE — Fitur premium dinonaktifkan
      </div>
    </div>

    <!-- VIEW: AUTH -->
    <div id="auth-view" class="glass-panel space-y-5 animate-slide-up">
      <div class="text-center space-y-1.5">
        <div class="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-1" style="background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(6,182,212,0.15)); border: 1px solid rgba(168,85,247,0.35);">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <h1 class="text-xl font-extrabold text-white tracking-tight">Selamat Datang</h1>
        <p class="text-xs text-slate-400">Masuk atau daftar untuk mengakses sistem premium</p>
      </div>

      <div class="relative flex rounded-2xl p-1" style="background: rgba(7,4,15,0.8); border: 1px solid rgba(168,85,247,0.15);">
        <div id="tab-indicator" class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300" style="background: linear-gradient(135deg, #a855f7, #7e22ce); box-shadow: 0 4px 15px rgba(168,85,247,0.4);"></div>
        <button onclick="switchAuthTab('login')" id="tab-login-btn" class="relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-xl transition-colors text-white">LOGIN</button>
        <button onclick="switchAuthTab('register')" id="tab-reg-btn" class="relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-xl transition-colors text-slate-400">REGISTER</button>
      </div>

      <div class="space-y-3.5">
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold uppercase tracking-widest text-purple-300 pl-1">Username</label>
          <input type="text" id="auth-username" placeholder="username_unik" class="input-glow mono">
        </div>
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold uppercase tracking-widest text-purple-300 pl-1">Password</label>
          <input type="password" id="auth-password" placeholder="••••••••" class="input-glow">
        </div>
        <div id="email-field-container" class="space-y-1.5 hidden">
          <label class="text-[10px] font-bold uppercase tracking-widest text-purple-300 pl-1">Recovery Email</label>
          <input type="email" id="auth-email" placeholder="email@gmail.com" class="input-glow">
          <p class="text-[10px] text-amber-400/90 pl-1 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            1 perangkat hanya bisa daftar 1 akun
          </p>
        </div>
      </div>

      <button onclick="handleAuthAction()" id="auth-submit-btn" class="btn-primary">
        <span id="auth-btn-text">Masuk ke Terminal</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </div>

    <!-- VIEW: TERMINAL (GENERATOR UTAMA) -->
    <div id="terminal-view" class="space-y-3 hidden">

      <div class="video-container">
        <video id="main-display-video" src="" autoplay loop muted playsinline preload="none"></video>
      </div>

      <div class="glass-panel py-2.5 px-3.5 flex items-center justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0" style="background: linear-gradient(135deg, #a855f7, #7e22ce); color: white;">
            <span id="user-avatar">U</span>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-white truncate" id="logged-username">-</p>
            <span id="role-badge" class="badge badge-user mt-0.5">User</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="server-status-indicator" class="badge badge-online">
            <span id="server-dot" class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span id="server-status-text">...</span>
          </span>
        </div>
      </div>

      <div id="vip-status-banner" class="p-3.5 rounded-2xl hidden animate-slide-up" style="background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(168,85,247,0.15)); border: 1px solid rgba(245,158,11,0.4);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(245,158,11,0.2);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
            </div>
            <div>
              <p class="text-xs font-extrabold text-amber-300">VIP PREMIUM MEMBER</p>
              <p id="vip-expiry-text" class="text-[10px] text-slate-300">Aktif hingga: -</p>
            </div>
          </div>
          <span class="badge badge-vip">ACTIVE</span>
        </div>
      </div>

      <div id="reset-banner-main" class="p-3.5 rounded-2xl hidden animate-slide-up" style="background: linear-gradient(135deg, rgba(244,63,94,0.15), rgba(168,85,247,0.1)); border: 1px solid rgba(244,63,94,0.4);">
        <div class="flex items-center gap-2.5 mb-2.5">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(244,63,94,0.2);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fda4af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-extrabold text-rose-300">KUOTA HABIS</p>
            <p class="text-[10px] text-slate-300">Reset otomatis dalam:</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div class="countdown-box">
            <p id="cd-hours-main" class="countdown-num">00</p>
            <p class="countdown-label">Jam</p>
          </div>
          <div class="countdown-box">
            <p id="cd-minutes-main" class="countdown-num">00</p>
            <p class="countdown-label">Menit</p>
          </div>
          <div class="countdown-box">
            <p id="cd-seconds-main" class="countdown-num">00</p>
            <p class="countdown-label">Detik</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="stat-card">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-purple-300">Kuota</p>
            <p id="quota-display" class="text-sm font-extrabold text-white mono mt-0.5">0/1</p>
          </div>
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(168,85,247,0.15);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
        </div>
        <div class="stat-card">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Reset</p>
            <p id="reset-timer-display" class="text-sm font-extrabold text-white mono mt-0.5">24 Jam</p>
          </div>
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(6,182,212,0.15);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
      </div>

      <div class="glass-panel space-y-3.5">
        <div>
          <div class="section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Kirim Magic Link
          </div>
          <input type="email" id="target-email" placeholder="target@gmail.com" class="input-glow">
        </div>

        <button id="btn-send" onclick="handleSendEmail()" class="btn-primary">
          <svg id="send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span id="send-text">Kirim Magic Link</span>
        </button>

        <div class="divider"></div>

        <div>
          <div class="section-title" style="color: #6ee7b7;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Verifikasi Magic URL
          </div>
          <input type="text" id="magic-url" placeholder="https://alight-creative.firebaseapp.com/_..." class="input-glow mono" style="font-size: 0.8rem;">
        </div>

        <button onclick="handleActivate()" class="btn-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Verifikasi Sekarang
        </button>
      </div>

      <!-- KLAIM KODE REDEEM -->
      <div class="glass-panel space-y-3">
        <div class="section-title" style="color: #67e8f9;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          Klaim Kode Redeem
        </div>
        <div class="flex gap-2">
          <input type="text" id="redeem-code-input-main" placeholder="KODE-REDEEM" class="input-glow mono uppercase" style="flex: 1; padding: 0.7rem 1rem; font-size: 0.85rem; font-weight: 700;">
          <button onclick="handleRedeemCodeMain()" class="btn-primary" style="width: auto; padding: 0.7rem 1rem; font-size: 0.8rem;">Klaim</button>
        </div>

        <div class="pt-2 border-t border-cyan-500/20">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Kode Redeem Aktif</span>
            <button onclick="loadActiveRedeems()" class="text-[10px] text-slate-400 hover:text-white underline">Refresh</button>
          </div>
          <div id="active-redeem-list" class="space-y-2 max-h-48 overflow-y-auto">
            <p class="text-slate-500 italic text-xs text-center py-2">Memuat kode aktif...</p>
          </div>
        </div>
      </div>

      <div id="result-box" class="hidden">
        <div class="glass-panel" style="padding: 1rem;">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-purple-300">Response</span>
            <button onclick="copyResult()" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.68rem;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
          <pre id="result-text" class="mono text-[11px] text-purple-300 whitespace-pre-wrap break-all" style="max-height: 200px; overflow-y: auto;"></pre>
        </div>
      </div>
    </div>

    <!-- VIEW: VIP STORE -->
    <div id="section-vip-store" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-amber-500/20">
        <h2 class="section-title" style="margin: 0; color: #fbbf24;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
          Beli VIP Premium
        </h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <!-- Banner Keuntungan VIP -->
      <div class="p-4 rounded-2xl" style="background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(168,85,247,0.1)); border: 1px solid rgba(245,158,11,0.4);">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(245,158,11,0.25);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
          </div>
          <div>
            <p class="text-sm font-extrabold text-amber-300">KEUNTUNGAN VIP PREMIUM</p>
            <p class="text-[10px] text-slate-300">Nikmati semua fitur tanpa batas</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="vip-benefit-item">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: rgba(16,185,129,0.2);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="text-xs text-slate-200 font-semibold">BISA MEMBUAT AM PREMIUM TERUS MENERUS</p>
          </div>
          <div class="vip-benefit-item">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: rgba(16,185,129,0.2);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="text-xs text-slate-200 font-semibold">KUOTA MENJADI UNLIMITED (TANPA BATAS)</p>
          </div>
          <div class="vip-benefit-item">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: rgba(16,185,129,0.2);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="text-xs text-slate-200 font-semibold">BISA MENJUAL AM PREMIUM TANPA BATAS</p>
          </div>
          <div class="vip-benefit-item">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: rgba(16,185,129,0.2);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="text-xs text-slate-200 font-semibold">AKSES SEMUA FITUR PREMIUM TANPA BATAS</p>
          </div>
          <div class="vip-benefit-item">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: rgba(16,185,129,0.2);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="text-xs text-slate-200 font-semibold">PRIORITAS SUPPORT & BADGE VIP EKSKLUSIF</p>
          </div>
          <div class="vip-benefit-item">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: rgba(16,185,129,0.2);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="text-xs text-slate-200 font-semibold">DLL - Banyak keuntungan lainnya!</p>
          </div>
        </div>
      </div>

      <!-- Pilih Paket -->
      <div>
        <p class="section-title" style="color: #fbbf24; margin-bottom: 0.75rem;">Pilih Paket VIP</p>
        <div id="vip-packages-list" class="space-y-3">
          <p class="text-slate-500 italic text-xs text-center py-3 animate-pulse">Memuat paket...</p>
        </div>
      </div>

      <button onclick="openPaymentModal()" id="btn-buy-vip" class="btn-primary" disabled style="background: linear-gradient(135deg, #f59e0b, #d97706);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        <span>Pilih Paket Terlebih Dahulu</span>
      </button>
    </div>

    <!-- VIEW: MY ORDERS -->
    <div id="section-my-orders" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-cyan-500/20">
        <h2 class="section-title" style="margin: 0; color: #67e8f9;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Pesanan Saya
        </h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <div class="flex justify-between items-center mb-2">
        <span class="text-[10px] text-slate-400">Riwayat pembelian VIP Anda</span>
        <button onclick="loadMyOrders()" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.68rem;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>

      <div id="my-orders-list" class="space-y-2 max-h-96 overflow-y-auto">
        <p class="text-slate-500 italic text-xs text-center py-3">Memuat pesanan...</p>
      </div>
    </div>

    <!-- VIEW: CHAT GLOBAL -->
    <div id="section-chat" class="glass-panel space-y-3 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
        <h2 class="section-title" style="margin: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Chat Global
        </h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <div class="chat-container">
        <div id="chat-messages" class="chat-messages">
          <p class="text-slate-500 italic text-xs text-center py-3">Memuat chat...</p>
        </div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="Tulis pesan..." maxlength="500" onkeydown="if(event.key==='Enter')sendChatMessage()">
          <button onclick="sendChatMessage()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between text-[10px] text-slate-500">
        <span id="chat-online-count">👥 0 user online</span>
        <button onclick="loadGlobalChat()" class="text-purple-400 hover:text-purple-300 underline">Refresh</button>
      </div>
    </div>

    <!-- VIEW: PROFILE -->
    <div id="section-profile" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
        <h2 class="section-title" style="margin: 0;">Akun & Profil</h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <div class="space-y-2.5">
        <div class="stat-card">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Username</p>
            <p id="profile-uname" class="text-sm font-bold text-white mono mt-0.5">-</p>
          </div>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(168,85,247,0.15);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="stat-card">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipe</p>
              <p id="profile-role" class="text-xs font-bold text-purple-400 mt-0.5">Standard</p>
            </div>
          </div>
          <div class="stat-card">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kuota</p>
              <p id="profile-quota" class="text-xs font-bold text-cyan-400 mono mt-0.5">0</p>
            </div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div>
        <div class="section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Ganti Username
        </div>
        <div class="flex gap-2">
          <input type="text" id="new-username-input" placeholder="username_baru" class="input-glow" style="flex: 1; padding: 0.7rem 1rem; font-size: 0.85rem;">
          <button onclick="triggerUpdateUsername()" class="btn-primary" style="width: auto; padding: 0.7rem 1rem; font-size: 0.8rem;">Simpan</button>
        </div>
      </div>

      <div>
        <div class="section-title" style="color: #fda4af;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Ganti Password
        </div>
        <div class="space-y-2">
          <input type="password" id="old-password-input" placeholder="Password lama" class="input-glow" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
          <input type="password" id="new-password-input" placeholder="Password baru" class="input-glow" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
          <input type="password" id="confirm-password-input" placeholder="Konfirmasi password baru" class="input-glow" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
          <button onclick="handleChangePassword()" class="btn-primary" style="width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Ubah Password
          </button>
        </div>
        <p class="text-[10px] text-amber-400/80 mt-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Ganti password segera setelah menerima akun VIP
        </p>
      </div>

      <!-- RIWAYAT GMAIL TERVERIFIKASI -->
      <div class="pt-3 border-t border-cyan-500/20">
        <div class="flex justify-between items-center mb-2">
          <div class="section-title" style="color: #67e8f9; margin: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Riwayat Gmail Terverifikasi
          </div>
          <button onclick="loadVerifiedEmails()" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.68rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div id="quota-status-card" class="p-3 rounded-xl mb-2.5" style="background: rgba(6,182,212,0.06); border: 1px solid rgba(6,182,212,0.25);">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Status Kuota</span>
            <span id="quota-status-badge" class="badge badge-online" style="font-size: 0.6rem; padding: 0.15rem 0.5rem;">Tersedia</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <div>
              <p class="text-slate-400 text-[10px]">Terpakai</p>
              <p class="mono font-extrabold text-white" id="quota-used-display">0</p>
            </div>
            <div class="text-right">
              <p class="text-slate-400 text-[10px]">Tersisa</p>
              <p class="mono font-extrabold text-cyan-300" id="quota-remain-display">1</p>
            </div>
            <div class="text-right">
              <p class="text-slate-400 text-[10px]">Total</p>
              <p class="mono font-extrabold text-purple-300" id="quota-total-display">1</p>
            </div>
          </div>
        </div>

        <div id="reset-countdown-card" class="p-3.5 rounded-xl mb-2.5 hidden" style="background: linear-gradient(135deg, rgba(244,63,94,0.12), rgba(168,85,247,0.08)); border: 1px solid rgba(244,63,94,0.35);">
          <div class="flex items-center gap-2.5 mb-2.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(244,63,94,0.2);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fda4af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <p class="text-xs font-extrabold text-rose-300">KUOTA HABIS</p>
              <p class="text-[10px] text-slate-300">Kuota akan direset otomatis dalam:</p>
            </div>
          </div>
          
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="countdown-box">
              <p id="countdown-hours" class="countdown-num">00</p>
              <p class="countdown-label">Jam</p>
            </div>
            <div class="countdown-box">
              <p id="countdown-minutes" class="countdown-num">00</p>
              <p class="countdown-label">Menit</p>
            </div>
            <div class="countdown-box">
              <p id="countdown-seconds" class="countdown-num">00</p>
              <p class="countdown-label">Detik</p>
            </div>
          </div>

          <p class="text-[10px] text-center text-slate-400 mt-2.5">
            Reset berikutnya: <span id="next-reset-time" class="text-rose-300 font-bold mono">-</span>
          </p>

          <div class="progress-bar mt-2.5" style="height: 6px;">
            <div id="reset-progress-fill" class="progress-fill" style="background: linear-gradient(90deg, #f43f5e, #a855f7, #f43f5e);"></div>
          </div>
        </div>

        <div id="verified-emails-list" class="space-y-1.5 max-h-64 overflow-y-auto">
          <p class="text-slate-500 italic text-center py-2 text-xs">Memuat riwayat...</p>
        </div>
      </div>
    </div>

    <!-- VIEW: PANEL ADMIN -->
    <div id="section-admin" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-amber-500/20">
        <h2 class="section-title" style="margin: 0; color: #fbbf24;">Panel Admin Master</h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <div class="p-3 rounded-xl" style="background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(168,85,247,0.08)); border: 1px solid rgba(245,158,11,0.3);">
        <p class="text-xs font-extrabold text-amber-300 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
          ADMIN MASTER CONTROL PANEL
        </p>
      </div>

      <!-- Status Server -->
      <div>
        <p class="section-title" style="color: #fbbf24;">Status Server</p>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="changeServerState('online')" class="btn-secondary" style="background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.35); color: #6ee7b7;">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Online
          </button>
          <button onclick="changeServerState('offline')" class="btn-secondary" style="background: rgba(244,63,94,0.12); border-color: rgba(244,63,94,0.35); color: #fda4af;">
            <span class="w-2 h-2 rounded-full bg-rose-500"></span> Offline
          </button>
        </div>
      </div>

      <!-- Upload Video -->
      <div>
        <p class="section-title" style="color: #fbbf24;">Upload Video (>5MB Support)</p>
        <div id="file-drop-zone" class="file-drop">
          <input type="file" id="admin-video-file" accept="video/*" class="hidden">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5" style="margin: 0 auto 0.5rem; display: block;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p class="text-xs font-bold text-slate-300">Klik atau drop video di sini</p>
          <p class="text-[10px] text-slate-500 mt-1">Support MP4, WebM, MOV • Max 200MB</p>
          <p id="file-info" class="text-[10px] text-purple-300 mono mt-2 hidden"></p>
        </div>
        
        <div id="upload-progress-container" class="hidden mt-3">
          <div class="flex justify-between text-[10px] text-slate-400 mb-1.5">
            <span id="upload-status-text">Mengunggah...</span>
            <span id="upload-percent" class="mono font-bold text-purple-300">0%</span>
          </div>
          <div class="progress-bar">
            <div id="upload-progress-fill" class="progress-fill"></div>
          </div>
          <p id="upload-speed" class="text-[10px] text-slate-500 mono mt-1.5 text-center"></p>
        </div>

        <button onclick="handleUploadVideo()" id="btn-upload-video" class="btn-primary mt-3" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span id="btn-upload-text">Upload & Perbarui Video</span>
        </button>
      </div>

      <!-- ============ KELOLA PAKET VIP ============ -->
      <div class="pt-3 border-t border-amber-500/20">
        <div class="flex justify-between items-center mb-2">
          <p class="section-title" style="color: #fbbf24; margin: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
            Kelola Paket VIP
          </p>
          <button onclick="loadAdminVipPackages()" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.68rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div id="admin-vip-packages-list" class="space-y-2 max-h-64 overflow-y-auto mb-3">
          <p class="text-slate-500 italic text-center py-2">Memuat paket...</p>
        </div>

        <div class="p-3 rounded-xl" style="background: rgba(7,4,15,0.6); border: 1px solid rgba(245,158,11,0.25);">
          <p class="text-[10px] font-bold text-amber-300 mb-2">Tambah / Edit Paket</p>
          <input type="hidden" id="pkg-edit-id" value="">
          <input type="text" id="pkg-name" placeholder="Nama paket (contoh: VIP 7 Hari)" class="input-glow mb-2" style="padding: 0.6rem 0.9rem; font-size: 0.8rem;">
          <div class="grid grid-cols-2 gap-2 mb-2">
            <input type="number" id="pkg-days" placeholder="Masa aktif (hari)" class="input-glow" style="padding: 0.6rem 0.9rem; font-size: 0.8rem;" min="1">
            <input type="number" id="pkg-price" placeholder="Harga (Rp)" class="input-glow" style="padding: 0.6rem 0.9rem; font-size: 0.8rem;" min="0">
          </div>
          <div class="flex gap-2">
            <button onclick="handleSaveVipPackage()" id="pkg-submit-btn" class="btn-primary" style="flex: 1; font-size: 0.8rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Simpan Paket
            </button>
            <button onclick="resetPkgForm()" id="pkg-cancel-btn" class="btn-secondary hidden">Batal</button>
          </div>
        </div>
      </div>

      <!-- ============ PENGATURAN PEMBAYARAN ============ -->
      <div class="pt-3 border-t border-amber-500/20">
        <p class="section-title" style="color: #fbbf24; margin-bottom: 0.75rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Pengaturan QRIS Pembayaran
        </p>

        <div class="p-3 rounded-xl mb-3" style="background: rgba(6,182,212,0.08); border: 1px solid rgba(6,182,212,0.3);">
          <p class="text-[10px] text-cyan-300 font-bold mb-2">📸 QR Code Saat Ini</p>
          <div id="admin-qr-preview" class="qr-container" style="max-width: 200px; margin: 0 auto;">
            <img id="admin-qr-img" src="" alt="QRIS" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJlbHVtIGFkYSBRUjwvdGV4dD48L3N2Zz4='">
          </div>
        </div>

        <div class="file-drop mb-3" id="qr-file-drop">
          <input type="file" id="qr-file-input" accept="image/*" class="hidden">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5" style="margin: 0 auto 0.5rem; display: block;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p class="text-xs font-bold text-slate-300">Upload QR Code Baru</p>
          <p class="text-[10px] text-slate-500 mt-1">JPG, PNG • Max 5MB</p>
        </div>

        <button onclick="handleUploadQR()" id="btn-upload-qr" class="btn-primary" disabled style="font-size: 0.85rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span id="btn-upload-qr-text">Upload QR Code</span>
        </button>

        <input type="text" id="payment-note-input" placeholder="Catatan pembayaran" class="input-glow mt-3" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
        <button onclick="handleSavePaymentSettings()" class="btn-success mt-2" style="font-size: 0.85rem;">Simpan Pengaturan</button>
      </div>

      <!-- ============ KONFIRMASI PEMBAYARAN ============ -->
      <div class="pt-3 border-t border-amber-500/20">
        <div class="flex justify-between items-center mb-2">
          <p class="section-title" style="color: #fbbf24; margin: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Konfirmasi Pembayaran
          </p>
          <button onclick="loadAdminOrders()" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.68rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div class="flex gap-1.5 mb-2 flex-wrap">
          <button onclick="setOrderFilter('pending')" data-ofilter="pending" class="order-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem; background: rgba(245,158,11,0.25); border-color: rgba(245,158,11,0.6); color: white;">⏳ Pending</button>
          <button onclick="setOrderFilter('process')" data-ofilter="process" class="order-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">🔄 Proses</button>
          <button onclick="setOrderFilter('success')" data-ofilter="success" class="order-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">✓ Sukses</button>
          <button onclick="setOrderFilter('failed')" data-ofilter="failed" class="order-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">✗ Gagal</button>
          <button onclick="setOrderFilter('all')" data-ofilter="all" class="order-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">Semua</button>
        </div>

        <div id="admin-orders-list" class="space-y-2 max-h-96 overflow-y-auto">
          <p class="text-slate-500 italic text-center py-2">Memuat pesanan...</p>
        </div>
      </div>

      <!-- Kelola VIP User -->
      <div>
        <p class="section-title" style="color: #fbbf24;">Kelola VIP User</p>
        <input type="text" id="vip-target-user" placeholder="Username target" class="input-glow mb-2" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
        <div class="flex gap-2">
          <input type="number" id="vip-duration-days" placeholder="Jumlah hari" class="input-glow" style="flex: 1; padding: 0.7rem 1rem; font-size: 0.85rem;">
          <button onclick="handleSetVip()" class="btn-primary" style="width: auto; padding: 0.7rem 1rem; font-size: 0.8rem;">Set VIP</button>
        </div>
        <div class="flex justify-between items-center mt-2 mb-1">
          <span class="text-[10px] text-amber-300 font-bold">Daftar VIP Aktif</span>
          <button onclick="loadAdminVipList()" class="text-[10px] text-slate-400 hover:text-white underline">Refresh</button>
        </div>
        <div id="admin-vip-list" class="space-y-1.5 max-h-32 overflow-y-auto text-[11px]">
          <p class="text-slate-500 italic text-center py-2">Memuat...</p>
        </div>
      </div>

      <!-- Buat Akun VIP Baru -->
      <div class="p-3 rounded-xl" style="background: linear-gradient(135deg, rgba(168,85,247,0.1), rgba(6,182,212,0.06)); border: 1px solid rgba(168,85,247,0.35);">
        <p class="section-title" style="color: #d8b4fe; margin-top: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          Buat Akun VIP Baru
        </p>
        <p class="text-[10px] text-slate-400 mb-2">Admin dapat membuat akun VIP untuk dibagikan ke user</p>
        <input type="text" id="vip-create-username" placeholder="Username akun VIP" class="input-glow mb-2" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
        <input type="text" id="vip-create-password" placeholder="Password akun VIP" class="input-glow mb-2 mono" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
        <input type="number" id="vip-create-days" placeholder="Masa aktif VIP (hari)" class="input-glow mb-2" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
        <button onclick="handleCreateVipAccount()" class="btn-success" style="background: linear-gradient(135deg, #a855f7, #7e22ce); color: white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          Buat Akun VIP
        </button>

        <div class="flex justify-between items-center mt-3 mb-1">
          <span class="text-[10px] text-purple-300 font-bold">Daftar Akun VIP Dibuat</span>
          <button onclick="loadVipAccounts()" class="text-[10px] text-slate-400 hover:text-white underline">Refresh</button>
        </div>
        <div id="vip-accounts-list" class="space-y-1.5 max-h-40 overflow-y-auto text-[11px]">
          <p class="text-slate-500 italic text-center py-2">Memuat...</p>
        </div>
      </div>

      <!-- Daftar User Terdaftar -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <p class="section-title" style="color: #fbbf24; margin: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Daftar User Terdaftar
          </p>
          <button onclick="loadAllUsers()" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.68rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div class="space-y-2 mb-2.5">
          <div class="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); pointer-events: none;">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="user-search-input" oninput="filterUserList()" placeholder="Cari username atau email..." class="input-glow" style="padding: 0.6rem 0.85rem 0.6rem 2.4rem; font-size: 0.82rem;">
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button onclick="setUserFilter('all')" data-filter="all" class="user-filter-btn btn-secondary active-filter" style="padding: 0.3rem 0.7rem; font-size: 0.68rem; background: rgba(168,85,247,0.25); border-color: rgba(168,85,247,0.6); color: white;">Semua</button>
            <button onclick="setUserFilter('admin')" data-filter="admin" class="user-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">👑 Admin</button>
            <button onclick="setUserFilter('vip')" data-filter="vip" class="user-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">⭐ VIP</button>
            <button onclick="setUserFilter('regular')" data-filter="regular" class="user-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">👤 Reguler</button>
            <button onclick="setUserFilter('reset')" data-filter="reset" class="user-filter-btn btn-secondary" style="padding: 0.3rem 0.7rem; font-size: 0.68rem;">🔄 Reset Due</button>
          </div>
        </div>

        <div id="user-stats-bar" class="grid grid-cols-4 gap-1.5 mb-2.5 text-center">
          <div class="p-1.5 rounded-lg" style="background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.2);">
            <p class="text-[9px] text-purple-300 font-bold uppercase">Total</p>
            <p id="stat-total" class="text-xs font-extrabold text-white mono">-</p>
          </div>
          <div class="p-1.5 rounded-lg" style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2);">
            <p class="text-[9px] text-amber-300 font-bold uppercase">Admin</p>
            <p id="stat-admins" class="text-xs font-extrabold text-amber-300 mono">-</p>
          </div>
          <div class="p-1.5 rounded-lg" style="background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.2);">
            <p class="text-[9px] text-purple-300 font-bold uppercase">VIP</p>
            <p id="stat-vips" class="text-xs font-extrabold text-purple-300 mono">-</p>
          </div>
          <div class="p-1.5 rounded-lg" style="background: rgba(6,182,212,0.08); border: 1px solid rgba(6,182,212,0.2);">
            <p class="text-[9px] text-cyan-300 font-bold uppercase">Reset</p>
            <p id="stat-reset" class="text-xs font-extrabold text-cyan-300 mono">-</p>
          </div>
        </div>

        <div id="all-users-list" class="space-y-1.5 max-h-64 overflow-y-auto text-[11px]">
          <p class="text-slate-500 italic text-center py-2">Klik Refresh untuk memuat daftar user...</p>
        </div>
      </div>

      <!-- Generate Redeem Code -->
      <div>
        <p class="section-title" style="color: #fbbf24;">Generate Redeem Code</p>
        <input type="text" id="gen-code" placeholder="NAMA-KODE" class="input-glow uppercase mono mb-2" style="padding: 0.7rem 1rem; font-size: 0.85rem; font-weight: 700;">
        <div class="grid grid-cols-2 gap-2 mb-2">
          <input type="number" id="gen-quota-per-user" placeholder="Kuota per user" class="input-glow" style="padding: 0.7rem 1rem; font-size: 0.85rem;" min="1">
          <input type="number" id="gen-max-claims" placeholder="Maks orang klaim" class="input-glow" style="padding: 0.7rem 1rem; font-size: 0.85rem;" min="1">
        </div>
        <button onclick="handleCreateRedeem()" class="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Generate Kode Redeem
        </button>
      </div>

      <!-- Daftar Kode Aktif -->
      <div>
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[10px] text-amber-300 font-bold">Daftar Kode Aktif</span>
          <button onclick="loadAdminRedeems()" class="text-[10px] text-slate-400 hover:text-white underline">Refresh</button>
        </div>
        <div id="admin-redeem-list" class="space-y-1.5 max-h-32 overflow-y-auto text-[11px]">
          <p class="text-slate-500 italic text-center py-2">Memuat...</p>
        </div>
      </div>

      <!-- Kelola Pengumuman -->
      <div class="space-y-3 pt-3 border-t border-amber-500/20">
        <p class="section-title" style="color: #fbbf24; margin: 0;">Panel Kelola Pengumuman</p>
        <input type="hidden" id="info-edit-id" value="">
        <input type="text" id="info-title" placeholder="Judul informasi" class="input-glow" style="padding: 0.7rem 1rem; font-size: 0.85rem;">
        <textarea id="info-content" placeholder="Isi pesan informasi..." class="input-glow" style="height: 90px; resize: none; padding: 0.7rem 1rem; font-size: 0.85rem;"></textarea>
        <div class="flex gap-2">
          <button id="info-submit-btn" onclick="handleSaveAnnouncement()" class="btn-primary" style="flex: 1;">Publikasikan</button>
          <button id="info-cancel-btn" onclick="resetInfoForm()" class="btn-secondary hidden">Batal</button>
        </div>
        <div id="admin-info-list" class="space-y-1.5 max-h-32 overflow-y-auto text-[11px] pt-1"></div>
      </div>

      <!-- REQUEST FITUR USER (ADMIN VIEW) -->
      <div class="space-y-3 pt-3 border-t border-emerald-500/20">
        <div class="flex justify-between items-center">
          <p class="section-title" style="color: #6ee7b7; margin: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Request Fitur dari User
          </p>
          <button onclick="loadAdminFeatureRequests()" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.68rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
        <div id="admin-feature-requests-list" class="space-y-2 max-h-64 overflow-y-auto text-[11px]">
          <p class="text-slate-500 italic text-center py-2">Memuat request fitur...</p>
        </div>
      </div>
    </div>

    <!-- VIEW: GUIDE -->
    <div id="section-guide" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
        <h2 class="section-title" style="margin: 0;">Panduan Penggunaan</h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <div class="space-y-2.5">
        ${[1,2,3,4,5,6,7].map((n, i) => {
          const steps = [
            'Pastikan Anda sudah login ke sistem dengan akun Anda.',
            'Beralih ke menu Generator Utama untuk mulai memproses.',
            'Masukkan email target Google/Gmail pada kolom yang tersedia.',
            'Klik tombol Kirim Magic Link untuk memicu token verifikasi.',
            'Salin tautan Magic Link dari email, paste di kolom URL.',
            'Klik Verifikasi Sekarang — proses selesai!',
            'Klaim kode redeem di Generator Utama untuk dapat kuota bonus.'
          ];
          return `
          <div class="flex gap-3 items-start p-2.5 rounded-xl" style="background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.12);">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0" style="background: linear-gradient(135deg, #a855f7, #7e22ce); color: white;">${n}</div>
            <p class="text-xs text-slate-300 leading-relaxed pt-0.5">${steps[i]}</p>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- VIEW: ANNOUNCEMENT -->
    <div id="section-announcement" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
        <h2 class="section-title" style="margin: 0; color: #67e8f9;">Informasi & Pengumuman</h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <div id="user-announcement-container" class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        <p class="text-slate-500 italic text-xs text-center py-3">Memuat informasi...</p>
      </div>
    </div>

    <!-- VIEW: REQUEST FITUR (USER) -->
    <div id="section-request" class="glass-panel space-y-4 hidden">
      <div class="flex items-center justify-between pb-3 border-b border-emerald-500/20">
        <h2 class="section-title" style="margin: 0; color: #6ee7b7;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Request Fitur Baru
        </h2>
        <button onclick="switchView('generator')" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.7rem;">← Kembali</button>
      </div>

      <p class="text-xs text-slate-400">Punya ide fitur baru? Kirim saran Anda ke admin!</p>

      <div class="space-y-3">
        <input type="text" id="feature-request-title" placeholder="Nama fitur yang diinginkan" class="input-glow" style="padding: 0.85rem 1.15rem;">
        <textarea id="feature-request-desc" placeholder="Jelaskan fitur yang Anda inginkan..." class="input-glow" style="height: 100px; resize: none; padding: 0.85rem 1.15rem;"></textarea>
        <button onclick="handleSubmitFeatureRequest()" class="btn-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Kirim Request Fitur
        </button>
      </div>

      <div class="pt-3 border-t border-emerald-500/20">
        <div class="flex justify-between items-center mb-2">
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Request Fitur Anda</span>
          <button onclick="loadUserFeatureRequests()" class="text-[10px] text-slate-400 hover:text-white underline">Refresh</button>
        </div>
        <div id="user-feature-requests-list" class="space-y-2 max-h-60 overflow-y-auto">
          <p class="text-slate-500 italic text-xs text-center py-2">Memuat...</p>
        </div>
      </div>
    </div>

    <p class="text-center text-[10px] text-slate-600 tracking-wider py-2">AM PREMIUM • BY BANGGUS</p>
  </div>
</div>

<script>
// ============ STATE ============
let currentAuthMode = 'login';
let loggedInUsername = '';
let isAdminUser = false;
let isVipUser = false;
let selectedVideoFile = null;
let selectedQRFile = null;
let currentResultText = '';
let cachedUserList = [];
let cachedOrderList = [];
let currentUserFilter = 'all';
let currentOrderFilter = 'pending';
let quotaCountdownInterval = null;
let globalCountdownInterval = null;
let chatRefreshInterval = null;
let unreadChatCount = 0;
let lastChatMessageId = null;
let currentView = 'generator';
let userQuotaData = { usedQuota: 0, bonusQuota: 0, totalQuota: 1, nextResetTime: 0, lastResetTime: 0 };
let claimedRedeemCodes = {};
let selectedVipPackage = null;
let currentOrderId = null;
let paymentSettings = { qrImage: '', paymentNote: '' };

// ============ OPTIMASI KUOTA ============
let isPageVisible = true;
let statusPollInterval = null;
let videoPollInterval = null;
let lastStatusFetch = 0;
let lastVideoFetch = 0;
let lastChatFetch = 0;
let lastEmailsFetch = 0;
let lastRedeemsFetch = 0;
let lastAnnouncementsFetch = 0;

const CACHE_DURATION = {
  status: 30000,
  video: 60000,
  chat: 15000,
  emails: 30000,
  redeems: 60000,
  announcements: 60000
};

const memoryCache = {};

function getCached(key) {
  const entry = memoryCache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > entry.duration) {
    delete memoryCache[key];
    return null;
  }
  return entry.data;
}

function setCache(key, data, duration) {
  memoryCache[key] = { data, time: Date.now(), duration };
}

document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
  if (isPageVisible) {
    if (currentView === 'generator') fetchServerStatus(true);
    if (currentView === 'chat') loadGlobalChat(true);
  }
});

// ============ TOAST ============
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  toast.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ============ DRAWER ============
function toggleMenu() {
  document.getElementById('nav-drawer').classList.toggle('open');
  document.getElementById('drawer-overlay').classList.toggle('hidden');
}

function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === viewName);
  });
  toggleMenu();
  ['terminal-view', 'section-profile', 'section-guide', 'section-announcement', 'section-chat', 'section-admin', 'section-request', 'section-vip-store', 'section-my-orders'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (viewName === 'generator') document.getElementById('terminal-view').classList.remove('hidden');
  else if (viewName === 'profile') {
    document.getElementById('section-profile').classList.remove('hidden');
    loadVerifiedEmails();
  }
  else if (viewName === 'guide') document.getElementById('section-guide').classList.remove('hidden');
  else if (viewName === 'announcement') {
    document.getElementById('section-announcement').classList.remove('hidden');
    loadUserAnnouncements();
  }
  else if (viewName === 'request') {
    document.getElementById('section-request').classList.remove('hidden');
    loadUserFeatureRequests();
  }
  else if (viewName === 'chat') {
    document.getElementById('section-chat').classList.remove('hidden');
    loadGlobalChat(true);
    unreadChatCount = 0;
    updateChatBadge();
  }
  else if (viewName === 'vip-store') {
    document.getElementById('section-vip-store').classList.remove('hidden');
    loadVipPackages();
  }
  else if (viewName === 'my-orders') {
    document.getElementById('section-my-orders').classList.remove('hidden');
    loadMyOrders();
  }
  else if (viewName === 'admin') {
    if (!isAdminUser) return showToast('Akses ditolak!', 'error');
    document.getElementById('section-admin').classList.remove('hidden');
    loadAdminRedeems();
    loadAdminAnnouncements();
    loadAdminVipList();
    loadAllUsers();
    loadVipAccounts();
    loadAdminFeatureRequests();
    loadAdminVipPackages();
    loadAdminOrders();
    loadAdminPaymentSettings();
  }
}

// ============ STATUS & VIDEO ============
async function fetchServerStatus(force = false) {
  if (!isPageVisible && !force) return;
  const now = Date.now();
  if (!force && now - lastStatusFetch < CACHE_DURATION.status) {
    const cached = getCached('serverStatus');
    if (cached) { updateStatusUI(cached); return; }
  }
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    updateStatusUI(data.status);
    lastStatusFetch = now;
    setCache('serverStatus', data.status, CACHE_DURATION.status);
  } catch(e) {}
}

async function fetchFeaturedVideo(force = false) {
  if (!isPageVisible && !force) return;
  const now = Date.now();
  if (!force && now - lastVideoFetch < CACHE_DURATION.video) {
    const cached = getCached('featuredVideo');
    if (cached) {
      const v = document.getElementById('main-display-video');
      if (v && v.src !== cached) v.src = cached;
      return;
    }
  }
  try {
    const res = await fetch('/api/video');
    const data = await res.json();
    if (data.success && data.videoUrl) {
      const v = document.getElementById('main-display-video');
      if (v && v.src !== data.videoUrl) v.src = data.videoUrl;
      lastVideoFetch = now;
      setCache('featuredVideo', data.videoUrl, CACHE_DURATION.video);
    }
  } catch(e) {}
}

function updateStatusUI(status) {
  const ind = document.getElementById('server-status-indicator');
  const dot = document.getElementById('server-dot');
  const txt = document.getElementById('server-status-text');
  const banner = document.getElementById('offline-banner');
  if (!ind) return;
  if (status === 'online') {
    ind.className = 'badge badge-online';
    dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
    txt.innerText = 'Online';
    banner.classList.add('hidden');
  } else {
    ind.className = 'badge badge-offline';
    dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
    txt.innerText = 'Offline';
    if (!isAdminUser) banner.classList.remove('hidden');
  }
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

// ============ AUTH ============
function switchAuthTab(mode) {
  currentAuthMode = mode;
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-reg-btn');
  const ind = document.getElementById('tab-indicator');
  const emailField = document.getElementById('email-field-container');
  const btnText = document.getElementById('auth-btn-text');
  if (mode === 'login') {
    ind.style.transform = 'translateX(0%)';
    loginBtn.className = 'relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-xl transition-colors text-white';
    regBtn.className = 'relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-xl transition-colors text-slate-400';
    emailField.classList.add('hidden');
    btnText.innerText = 'Masuk ke Terminal';
  } else {
    ind.style.transform = 'translateX(100%)';
    regBtn.className = 'relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-xl transition-colors text-white';
    loginBtn.className = 'relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-xl transition-colors text-slate-400';
    emailField.classList.remove('hidden');
    btnText.innerText = 'Daftar Akun Baru';
  }
}

async function handleAuthAction() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  if (!username || !password) return showToast('Username dan password wajib diisi!', 'error');

  let deviceToken = localStorage.getItem('am_device_token');
  if (currentAuthMode === 'register' && deviceToken) return showToast('Perangkat ini sudah terdaftar!', 'error');

  const btn = document.getElementById('auth-submit-btn');
  const originalText = document.getElementById('auth-btn-text').innerText;
  document.getElementById('auth-btn-text').innerText = 'Memproses...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentAuthMode, username, password, email, deviceToken })
    });
    const data = await res.json();
    if (data.success) {
      if (currentAuthMode === 'register' && data.deviceToken) localStorage.setItem('am_device_token', data.deviceToken);
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('savedUsername', data.username);
      }
      showToast(data.message, 'success');
      applySession(data);
    } else showToast(data.message, 'error');
  } catch (err) {
    showToast('Kesalahan koneksi server', 'error');
  } finally {
    document.getElementById('auth-btn-text').innerText = originalText;
    btn.disabled = false;
  }
}

function applySession(data) {
  loggedInUsername = data.username;
  isAdminUser = data.isAdmin;
  isVipUser = data.isVip || false;
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('terminal-view').classList.remove('hidden');
  document.getElementById('header-menu-btn').classList.remove('hidden');
  document.getElementById('logged-username').innerText = data.username;
  document.getElementById('user-avatar').innerText = data.username.charAt(0).toUpperCase();
  document.getElementById('drawer-avatar').innerText = data.username.charAt(0).toUpperCase();
  document.getElementById('drawer-username').innerText = data.username;
  document.getElementById('drawer-role').innerText = data.isAdmin ? 'Admin Master' : (data.isVip ? 'VIP Member' : 'User');
  document.getElementById('drawer-logout-btn').classList.remove('hidden');
  document.getElementById('profile-uname').innerText = data.username;
  document.getElementById('profile-role').innerText = data.isAdmin ? 'Admin Master' : (data.isVip ? 'VIP Member' : 'Standard User');
  document.getElementById('profile-quota').innerText = data.isAdmin || data.isVip ? 'Unlimited' : (1 + (data.bonusQuota || 0) - data.usedQuota);

  updateQuotaDisplay(data);
  checkVipStatus(data);
  loadUserAnnouncements();
  loadVerifiedEmails();
  loadActiveRedeems();
  updateStatusUI(data.serverStatus);
  fetchFeaturedVideo(true);
  loadPaymentSettings();

  if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  loadGlobalChat();
  chatRefreshInterval = setInterval(() => {
    if (!isPageVisible) return;
    if (currentView !== 'chat') checkNewChatMessages();
    else loadGlobalChat();
  }, CACHE_DURATION.chat);

  const roleBadge = document.getElementById('role-badge');
  if (data.isAdmin) {
    roleBadge.className = 'badge badge-admin';
    roleBadge.innerText = '👑 Admin';
    document.getElementById('nav-admin-btn').classList.remove('hidden');
  } else if (data.isVip) {
    roleBadge.className = 'badge badge-vip';
    roleBadge.innerText = 'VIP Member';
  } else {
    roleBadge.className = 'badge badge-user';
    roleBadge.innerText = 'User';
  }
}

async function checkSavedSession() {
  const token = localStorage.getItem('authToken');
  const savedUname = localStorage.getItem('savedUsername');
  if (!token || !savedUname) return;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: savedUname, token })
    });
    const data = await res.json();
    if (data.success) applySession(data);
  } catch (e) {}
}
checkSavedSession();

// ============ VIP STORE ============
async function loadVipPackages() {
  const container = document.getElementById('vip-packages-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3 animate-pulse">Memuat paket...</p>';
  
  try {
    const res = await fetch('/api/vip-packages');
    const data = await res.json();
    if (data.success && data.packages && Object.keys(data.packages).length > 0) {
      const packages = Object.values(data.packages).filter(p => p.active !== false);
      if (packages.length === 0) {
        container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3">Belum ada paket tersedia</p>';
        return;
      }
      container.innerHTML = packages.map(pkg => `
        <div class="vip-package-card" onclick="selectVipPackage('${pkg.id}', '${escapeHtml(pkg.name)}', ${pkg.days}, ${pkg.price})" data-pkg-id="${pkg.id}">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(245,158,11,0.25), rgba(168,85,247,0.15));">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
              </div>
              <div>
                <p class="text-sm font-extrabold text-white">${escapeHtml(pkg.name)}</p>
                <p class="text-[10px] text-slate-400">Masa aktif ${pkg.days} hari</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-lg font-extrabold text-emerald-400 mono">Rp ${pkg.price.toLocaleString('id-ID')}</p>
              <p class="text-[9px] text-slate-500">Sekali bayar</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-amber-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Unlimited kuota • Semua fitur premium</span>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3">Belum ada paket tersedia</p>';
    }
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-xs text-center py-3">Gagal memuat paket</p>';
  }
}

function selectVipPackage(id, name, days, price) {
  selectedVipPackage = { id, name, days, price };
  document.querySelectorAll('.vip-package-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.pkgId === id);
  });
  const btn = document.getElementById('btn-buy-vip');
  btn.disabled = false;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
    <span>Beli ${name} - Rp ${price.toLocaleString('id-ID')}</span>
  `;
  showToast(`Paket ${name} dipilih`, 'info');
}

// ============ PAYMENT ============
async function loadPaymentSettings() {
  try {
    const res = await fetch('/api/payment-settings');
    const data = await res.json();
    if (data.success) {
      paymentSettings = data.settings;
    }
  } catch(e) {}
}

function openPaymentModal() {
  if (!selectedVipPackage) return showToast('Pilih paket VIP terlebih dahulu!', 'error');
  currentOrderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  
  document.getElementById('pay-order-id').innerText = currentOrderId;
  document.getElementById('pay-package-name').innerText = selectedVipPackage.name;
  document.getElementById('pay-package-days').innerText = selectedVipPackage.days + ' hari';
  document.getElementById('pay-total-price').innerText = 'Rp ' + selectedVipPackage.price.toLocaleString('id-ID');
  document.getElementById('pay-status-badge').className = 'badge badge-pending';
  document.getElementById('pay-status-badge').innerText = 'PENDING';
  document.getElementById('pay-status-text').innerText = 'Menunggu pembayaran';
  
  // Set QR image
  const qrImg = document.getElementById('qr-image');
  if (paymentSettings.qrImage) {
    qrImg.src = paymentSettings.qrImage;
  } else {
    qrImg.src = '';
  }
  
  showPaymentStep(1);
  document.getElementById('payment-modal').classList.add('show');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('show');
}

function showPaymentStep(step) {
  [1,2,3,4].forEach(i => {
    const el = document.getElementById('payment-step-' + i);
    const dot = document.getElementById('step-' + i);
    if (el) el.classList.add('hidden');
    if (dot) {
      dot.classList.remove('active', 'completed');
      if (i < step) dot.classList.add('completed');
      if (i === step) dot.classList.add('active');
    }
  });
  const target = document.getElementById('payment-step-' + step);
  if (target) target.classList.remove('hidden');
}

async function submitPaymentProof() {
  if (!selectedPaymentFile) return showToast('Upload bukti pembayaran terlebih dahulu!', 'error');
  
  const btn = document.getElementById('btn-submit-proof');
  btn.disabled = true;
  btn.innerText = 'Mengirim...';
  
  try {
    const base64 = await blobToBase64(selectedPaymentFile);
    
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loggedInUsername,
        orderId: currentOrderId,
        packageId: selectedVipPackage.id,
        packageName: selectedVipPackage.name,
        days: selectedVipPackage.days,
        price: selectedVipPackage.price,
        proofImage: base64
      })
    });
    const data = await res.json();
    if (data.success) {
      showPaymentStep(4);
      showToast('Bukti pembayaran terkirim!', 'success');
      selectedPaymentFile = null;
      document.getElementById('payment-file-input').value = '';
      document.getElementById('payment-file-info').classList.add('hidden');
      document.getElementById('payment-preview').classList.add('hidden');
      document.getElementById('btn-submit-proof').disabled = true;
    } else {
      showToast(data.message || 'Gagal mengirim bukti', 'error');
      btn.disabled = false;
      btn.innerText = 'Kirim Bukti';
    }
  } catch(e) {
    showToast('Kesalahan koneksi', 'error');
    btn.disabled = false;
    btn.innerText = 'Kirim Bukti';
  }
}

// Payment file upload handler
let selectedPaymentFile = null;
function initPaymentFileDrop() {
  const dropZone = document.getElementById('payment-file-drop');
  const fileInput = document.getElementById('payment-file-input');
  if (!dropZone || !fileInput) return;
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handlePaymentFileSelect(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handlePaymentFileSelect(e.target.files[0]);
  });
}

function handlePaymentFileSelect(file) {
  const info = document.getElementById('payment-file-info');
  const preview = document.getElementById('payment-preview');
  const previewImg = document.getElementById('payment-preview-img');
  const btn = document.getElementById('btn-submit-proof');
  
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar!', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('File terlalu besar! Maksimal 5MB', 'error');
    return;
  }
  
  selectedPaymentFile = file;
  const sizeKB = (file.size / 1024).toFixed(2);
  info.innerText = '📁 ' + file.name + ' (' + sizeKB + ' KB)';
  info.classList.remove('hidden');
  
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
  
  btn.disabled = false;
  showToast('Bukti pembayaran siap dikirim', 'info');
}

// ============ MY ORDERS ============
async function loadMyOrders() {
  if (!loggedInUsername) return;
  const container = document.getElementById('my-orders-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3 animate-pulse">Memuat pesanan...</p>';
  
  try {
    const res = await fetch('/api/orders/my?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.orders && data.orders.length > 0) {
      container.innerHTML = data.orders.map(order => {
        const statusBadge = getOrderStatusBadge(order.status);
        return `
          <div class="order-card">
            <div class="flex justify-between items-start mb-2">
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-cyan-300 mono">${escapeHtml(order.id)}</p>
                <p class="text-sm font-extrabold text-white mt-0.5">${escapeHtml(order.packageName)}</p>
                <p class="text-[10px] text-slate-400">${order.days} hari</p>
              </div>
              ${statusBadge}
            </div>
            <div class="flex justify-between items-center p-2 rounded-lg mb-2" style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2);">
              <span class="text-[10px] text-slate-400">Total Bayar</span>
              <span class="text-sm font-extrabold text-emerald-400 mono">Rp ${order.price.toLocaleString('id-ID')}</span>
            </div>
            <p class="text-[9px] text-slate-500">Dibuat: ${new Date(order.createdAt).toLocaleString('id-ID')}</p>
            ${order.adminNote ? `<p class="text-[10px] text-amber-300 mt-1.5 p-1.5 rounded" style="background: rgba(245,158,11,0.1);">💬 Admin: ${escapeHtml(order.adminNote)}</p>` : ''}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3">Belum ada pesanan</p>';
    }
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-xs text-center py-3">Gagal memuat pesanan</p>';
  }
}

function getOrderStatusBadge(status) {
  const badges = {
    'pending': '<span class="badge badge-pending" style="font-size: 0.6rem; padding: 0.15rem 0.5rem;">⏳ PENDING</span>',
    'process': '<span class="badge badge-process" style="font-size: 0.6rem; padding: 0.15rem 0.5rem;">🔄 PROSES</span>',
    'success': '<span class="badge badge-success" style="font-size: 0.6rem; padding: 0.15rem 0.5rem;">✓ SUKSES</span>',
    'failed': '<span class="badge badge-failed" style="font-size: 0.6rem; padding: 0.15rem 0.5rem;">✗ GAGAL</span>'
  };
  return badges[status] || badges['pending'];
}

// ============ ADMIN: ORDERS ============
async function loadAdminOrders() {
  if (!isAdminUser) return;
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-center py-2 animate-pulse">Memuat pesanan...</p>';
  
  try {
    const res = await fetch('/api/admin/orders?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success) {
      cachedOrderList = data.orders || [];
      renderOrderList();
    } else {
      container.innerHTML = '<p class="text-rose-400 italic text-center py-2">Gagal memuat</p>';
    }
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-center py-2">Kesalahan koneksi</p>';
  }
}

function setOrderFilter(filter) {
  currentOrderFilter = filter;
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    const isActive = btn.dataset.ofilter === filter;
    if (isActive) {
      btn.style.background = 'rgba(245,158,11,0.25)';
      btn.style.borderColor = 'rgba(245,158,11,0.6)';
      btn.style.color = 'white';
    } else {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });
  renderOrderList();
}

function renderOrderList() {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  
  let filtered = cachedOrderList;
  if (currentOrderFilter !== 'all') {
    filtered = cachedOrderList.filter(o => o.status === currentOrderFilter);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-slate-500 italic text-center py-3">Tidak ada pesanan</p>';
    return;
  }
  
  container.innerHTML = filtered.map(order => {
    const statusBadge = getOrderStatusBadge(order.status);
    const actionButtons = order.status === 'pending' || order.status === 'process' ? `
      <div class="flex gap-1.5 mt-2 pt-2 border-t border-slate-800">
        <button onclick="confirmOrder('${order.id}', 'success')" class="flex-1 py-1.5 rounded text-[10px] font-bold" style="background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.4);">✓ Konfirmasi</button>
        <button onclick="confirmOrder('${order.id}', 'failed')" class="flex-1 py-1.5 rounded text-[10px] font-bold" style="background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.4);">✗ Tolak</button>
        <button onclick="viewPaymentProof('${order.id}')" class="px-2 py-1.5 rounded text-[10px] font-bold" style="background: rgba(6,182,212,0.2); color: #67e8f9; border: 1px solid rgba(6,182,212,0.4);">👁</button>
      </div>
    ` : `
      <div class="flex gap-1.5 mt-2 pt-2 border-t border-slate-800">
        <button onclick="viewPaymentProof('${order.id}')" class="flex-1 py-1.5 rounded text-[10px] font-bold" style="background: rgba(6,182,212,0.2); color: #67e8f9; border: 1px solid rgba(6,182,212,0.4);">👁 Lihat Bukti</button>
        <button onclick="deleteOrder('${order.id}')" class="px-2 py-1.5 rounded text-[10px] font-bold" style="background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.4);">🗑</button>
      </div>
    `;
    
    return `
      <div class="order-card">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-cyan-300 mono">${escapeHtml(order.id)}</p>
            <p class="text-sm font-extrabold text-white mt-0.5">${escapeHtml(order.packageName)}</p>
            <p class="text-[10px] text-slate-400">User: <span class="text-purple-300 font-bold">${escapeHtml(order.username)}</span></p>
            <p class="text-[10px] text-slate-400">${order.days} hari • Rp ${order.price.toLocaleString('id-ID')}</p>
          </div>
          ${statusBadge}
        </div>
        <p class="text-[9px] text-slate-500">${new Date(order.createdAt).toLocaleString('id-ID')}</p>
        ${actionButtons}
      </div>
    `;
  }).join('');
}

async function confirmOrder(orderId, status) {
  const note = status === 'success' ? 'Pembayaran dikonfirmasi' : (prompt('Alasan penolakan:') || 'Pembayaran ditolak');
  if (status === 'failed' && !confirm('Yakin tolak pesanan ini?')) return;
  
  try {
    const res = await fetch('/api/admin/orders/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, orderId, status, adminNote: note })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminOrders();
      loadAllUsers();
    } else {
      showToast(data.message || 'Gagal konfirmasi', 'error');
    }
  } catch(e) {
    showToast('Kesalahan koneksi', 'error');
  }
}

function viewPaymentProof(orderId) {
  const order = cachedOrderList.find(o => o.id === orderId);
  if (!order || !order.proofImage) return showToast('Bukti tidak tersedia', 'error');
  
  const win = window.open('');
  win.document.write(`
    <html><head><title>Bukti Pembayaran - ${orderId}</title>
    <style>body{margin:0;background:#07040f;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;}
    img{max-width:90%;max-height:90vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.8);}</style>
    </head><body><img src="${order.proofImage}" alt="Bukti Pembayaran"></body></html>
  `);
}

async function deleteOrder(orderId) {
  if (!confirm('Hapus pesanan ini?')) return;
  try {
    const res = await fetch('/api/admin/orders/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, orderId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Pesanan dihapus', 'success');
      loadAdminOrders();
    }
  } catch(e) {}
}

// ============ ADMIN: VIP PACKAGES ============
async function loadAdminVipPackages() {
  if (!isAdminUser) return;
  const container = document.getElementById('admin-vip-packages-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-center py-2 animate-pulse">Memuat paket...</p>';
  
  try {
    const res = await fetch('/api/vip-packages');
    const data = await res.json();
    if (data.success && data.packages) {
      const packages = Object.values(data.packages);
      if (packages.length === 0) {
        container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Belum ada paket</p>';
        return;
      }
      container.innerHTML = packages.map(pkg => `
        <div class="flex justify-between items-center p-2.5 rounded-lg" style="background: rgba(7,4,15,0.6); border: 1px solid rgba(245,158,11,0.2);">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-amber-300">${escapeHtml(pkg.name)}</p>
            <p class="text-[10px] text-slate-400">${pkg.days} hari • Rp ${pkg.price.toLocaleString('id-ID')}</p>
          </div>
          <div class="flex gap-1">
            <button onclick="editVipPackage('${pkg.id}')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(6,182,212,0.2); color: #67e8f9;">Edit</button>
            <button onclick="deleteVipPackage('${pkg.id}')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(244,63,94,0.2); color: #fda4af;">×</button>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Belum ada paket</p>';
    }
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-center py-2">Gagal memuat</p>';
  }
}

async function handleSaveVipPackage() {
  if (!isAdminUser) return;
  const id = document.getElementById('pkg-edit-id').value;
  const name = document.getElementById('pkg-name').value.trim();
  const days = parseInt(document.getElementById('pkg-days').value);
  const price = parseInt(document.getElementById('pkg-price').value);
  
  if (!name || isNaN(days) || isNaN(price)) return showToast('Lengkapi semua field!', 'error');
  if (days < 1) return showToast('Masa aktif minimal 1 hari!', 'error');
  if (price < 0) return showToast('Harga tidak valid!', 'error');
  
  try {
    const res = await fetch('/api/admin/vip-packages/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminUsername: loggedInUsername,
        packageId: id || null,
        name, days, price
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      resetPkgForm();
      loadAdminVipPackages();
    } else {
      showToast(data.message, 'error');
    }
  } catch(e) {
    showToast('Gagal menyimpan paket', 'error');
  }
}

function editVipPackage(id) {
  fetch('/api/vip-packages').then(r => r.json()).then(data => {
    if (data.success && data.packages[id]) {
      const pkg = data.packages[id];
      document.getElementById('pkg-edit-id').value = id;
      document.getElementById('pkg-name').value = pkg.name;
      document.getElementById('pkg-days').value = pkg.days;
      document.getElementById('pkg-price').value = pkg.price;
      document.getElementById('pkg-submit-btn').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Perbarui';
      document.getElementById('pkg-cancel-btn').classList.remove('hidden');
    }
  });
}

function resetPkgForm() {
  document.getElementById('pkg-edit-id').value = '';
  document.getElementById('pkg-name').value = '';
  document.getElementById('pkg-days').value = '';
  document.getElementById('pkg-price').value = '';
  document.getElementById('pkg-submit-btn').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Simpan Paket';
  document.getElementById('pkg-cancel-btn').classList.add('hidden');
}

async function deleteVipPackage(id) {
  if (!confirm('Hapus paket ini?')) return;
  try {
    const res = await fetch('/api/admin/vip-packages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, packageId: id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Paket dihapus', 'success');
      loadAdminVipPackages();
    }
  } catch(e) {}
}

// ============ ADMIN: PAYMENT SETTINGS ============
async function loadAdminPaymentSettings() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/payment-settings');
    const data = await res.json();
    if (data.success) {
      paymentSettings = data.settings;
      document.getElementById('admin-qr-img').src = paymentSettings.qrImage || '';
      document.getElementById('payment-note-input').value = paymentSettings.paymentNote || '';
    }
  } catch(e) {}
}

function initQRFileDrop() {
  const dropZone = document.getElementById('qr-file-drop');
  const fileInput = document.getElementById('qr-file-input');
  if (!dropZone || !fileInput) return;
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleQRFileSelect(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleQRFileSelect(e.target.files[0]);
  });
}

function handleQRFileSelect(file) {
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar!', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('File terlalu besar! Maksimal 5MB', 'error');
    return;
  }
  selectedQRFile = file;
  document.getElementById('btn-upload-qr').disabled = false;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('admin-qr-img').src = e.target.result;
  };
  reader.readAsDataURL(file);
  showToast('QR siap diupload', 'info');
}

async function handleUploadQR() {
  if (!selectedQRFile) return showToast('Pilih file QR terlebih dahulu!', 'error');
  
  const btn = document.getElementById('btn-upload-qr');
  const btnText = document.getElementById('btn-upload-qr-text');
  btn.disabled = true;
  btnText.innerText = 'Mengunggah...';
  
  try {
    const base64 = await blobToBase64(selectedQRFile);
    const res = await fetch('/api/admin/payment/upload-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, qrImage: base64 })
    });
    const data = await res.json();
    if (data.success) {
      showToast('QR Code berhasil diupload!', 'success');
      selectedQRFile = null;
      document.getElementById('qr-file-input').value = '';
      document.getElementById('btn-upload-qr').disabled = true;
      paymentSettings.qrImage = base64;
    } else {
      showToast(data.message || 'Gagal upload QR', 'error');
    }
  } catch(e) {
    showToast('Kesalahan koneksi', 'error');
  } finally {
    btn.disabled = false;
    btnText.innerText = 'Upload QR Code';
  }
}

async function handleSavePaymentSettings() {
  if (!isAdminUser) return;
  const paymentNote = document.getElementById('payment-note-input').value.trim();
  try {
    const res = await fetch('/api/admin/payment/save-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, paymentNote })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Pengaturan disimpan!', 'success');
      loadPaymentSettings();
    }
  } catch(e) {}
}

// ============ KLAIM REDEEM ============
async function handleRedeemCodeMain() {
  const code = document.getElementById('redeem-code-input-main').value.trim().toUpperCase();
  if (!code) return showToast('Masukkan kode!', 'error');
  try {
    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, code })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('redeem-code-input-main').value = '';
      updateQuotaDisplay(data);
      loadVerifiedEmails(true);
      loadActiveRedeems(true);
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal redeem', 'error'); }
}

async function loadActiveRedeems(force = false) {
  const now = Date.now();
  if (!force && now - lastRedeemsFetch < CACHE_DURATION.redeems) {
    const cached = getCached('activeRedeems');
    if (cached) { renderActiveRedeems(cached); return; }
  }
  try {
    const [resActive, resClaimed] = await Promise.all([
      fetch('/api/redeems/active'),
      loggedInUsername ? fetch('/api/redeems/claimed?username=' + encodeURIComponent(loggedInUsername)) : Promise.resolve({ json: () => ({ claimedCodes: [] }) })
    ]);
    const dataActive = await resActive.json();
    const dataClaimed = await resClaimed.json();
    claimedRedeemCodes = dataClaimed.claimedCodes || {};
    lastRedeemsFetch = now;
    setCache('activeRedeems', { dataActive, claimedRedeemCodes }, CACHE_DURATION.redeems);
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
      
      const buttonHtml = hasClaimed 
        ? '<span class="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1" style="background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.4);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Sudah</span>'
        : '<button onclick="quickClaimRedeem(\'' + escapeHtml(code) + '\')" class="px-2 py-1 rounded text-[10px] font-bold" style="background: rgba(6,182,212,0.2); color: #67e8f9; border: 1px solid rgba(6,182,212,0.4);">Klaim</button>';
      
      return '<div class="redeem-card"><div class="flex justify-between items-start mb-1.5"><div class="flex-1 min-w-0"><p class="text-xs font-bold text-cyan-300 mono">' + escapeHtml(code) + '</p><p class="text-[10px] text-slate-400">Kuota: ' + quotaPerUser + ' per user | Sisa klaim: ' + remainingClaims + '/' + val.maxClaims + '</p></div>' + buttonHtml + '</div><div class="progress-bar" style="height: 4px;"><div class="progress-fill" style="width: ' + Math.round((val.claimedCount / val.maxClaims) * 100) + '%; background: linear-gradient(90deg, #06b6d4, #a855f7);"></div></div></div>';
    }).filter(Boolean).join('') || '<p class="text-slate-500 italic text-xs text-center py-2">Tidak ada kode aktif</p>';
  } else {
    container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-2">Tidak ada kode redeem aktif</p>';
  }
}

function quickClaimRedeem(code) {
  document.getElementById('redeem-code-input-main').value = code;
  showToast('Kode "' + code + '" siap diklaim', 'info');
  document.getElementById('redeem-code-input-main').focus();
}

// ============ REQUEST FITUR ============
async function handleSubmitFeatureRequest() {
  const title = document.getElementById('feature-request-title').value.trim();
  const description = document.getElementById('feature-request-desc').value.trim();
  if (!title || !description) return showToast('Lengkapi judul dan deskripsi fitur!', 'error');
  if (title.length < 3) return showToast('Judul minimal 3 karakter!', 'error');
  if (description.length < 10) return showToast('Deskripsi minimal 10 karakter!', 'error');
  try {
    const res = await fetch('/api/feature-request/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, title, description })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Request fitur berhasil dikirim!', 'success');
      document.getElementById('feature-request-title').value = '';
      document.getElementById('feature-request-desc').value = '';
      loadUserFeatureRequests();
    } else showToast(data.message || 'Gagal mengirim request', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

async function loadUserFeatureRequests() {
  if (!loggedInUsername) return;
  const container = document.getElementById('user-feature-requests-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-2 animate-pulse">Memuat...</p>';
  try {
    const res = await fetch('/api/feature-request/my?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.requests && data.requests.length > 0) {
      container.innerHTML = data.requests.map(req => {
        const statusBadge = req.status === 'approved' 
          ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background: rgba(16,185,129,0.15); color: #6ee7b7;">✓ Disetujui</span>'
          : req.status === 'rejected'
          ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background: rgba(244,63,94,0.15); color: #fda4af;">✗ Ditolak</span>'
          : '<span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background: rgba(245,158,11,0.15); color: #fbbf24;">⏳ Menunggu</span>';
        return '<div class="feature-request-card"><div class="flex justify-between items-start mb-1"><p class="text-xs font-bold text-emerald-300">' + escapeHtml(req.title) + '</p>' + statusBadge + '</div><p class="text-[11px] text-slate-300 leading-relaxed">' + escapeHtml(req.description) + '</p><p class="text-[9px] text-slate-500 mt-1.5">' + new Date(req.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</p>' + (req.adminNote ? '<p class="text-[10px] text-amber-300 mt-1.5 p-1.5 rounded" style="background: rgba(245,158,11,0.1);">💬 Admin: ' + escapeHtml(req.adminNote) + '</p>' : '') + '</div>';
      }).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-2">Belum ada request fitur</p>';
    }
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-xs text-center py-2">Gagal memuat</p>';
  }
}

async function loadAdminFeatureRequests() {
  if (!isAdminUser) return;
  const container = document.getElementById('admin-feature-requests-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-center py-2 animate-pulse">Memuat request fitur...</p>';
  try {
    const res = await fetch('/api/admin/feature-requests?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (data.success && data.requests && data.requests.length > 0) {
      const pending = data.requests.filter(r => r.status === 'pending');
      const others = data.requests.filter(r => r.status !== 'pending');
      const sorted = [...pending, ...others];
      container.innerHTML = sorted.map(req => {
        const statusColor = req.status === 'approved' ? '#6ee7b7' : req.status === 'rejected' ? '#fda4af' : '#fbbf24';
        const statusText = req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : 'Menunggu';
        return '<div class="p-2.5 rounded-lg animate-slide-up" style="background: rgba(7,4,15,0.6); border: 1px solid rgba(16,185,129,0.2);"><div class="flex justify-between items-start mb-1"><div class="flex-1 min-w-0"><p class="text-xs font-bold text-emerald-300">' + escapeHtml(req.title) + '</p><p class="text-[9px] text-slate-500">Dari: ' + escapeHtml(req.username) + '</p></div><span class="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style="background: rgba(' + (req.status === 'approved' ? '16,185,129' : req.status === 'rejected' ? '244,63,94' : '245,158,11') + ',0.15); color: ' + statusColor + ';">' + statusText + '</span></div><p class="text-[10px] text-slate-300 mb-1.5">' + escapeHtml(req.description) + '</p>' + (req.adminNote ? '<p class="text-[9px] text-amber-300 mb-1.5">Catatan: ' + escapeHtml(req.adminNote) + '</p>' : '') + '<div class="flex gap-1.5 mt-2 pt-1.5 border-t border-slate-800"><input type="text" id="admin-note-' + req.id + '" placeholder="Catatan admin..." class="input-glow" style="flex: 1; padding: 0.4rem 0.6rem; font-size: 0.7rem;"><button onclick="updateFeatureRequestStatus(\'' + req.id + '\', \'approved\')" class="px-2 py-1 rounded text-[9px] font-bold" style="background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.4);">✓</button><button onclick="updateFeatureRequestStatus(\'' + req.id + '\', \'rejected\')" class="px-2 py-1 rounded text-[9px] font-bold" style="background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.4);">✗</button><button onclick="deleteFeatureRequest(\'' + req.id + '\')" class="px-2 py-1 rounded text-[9px] font-bold" style="background: rgba(148,163,184,0.2); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.4);">🗑</button></div></div>';
      }).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Belum ada request fitur</p>';
    }
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-center py-2">Gagal memuat</p>';
  }
}

async function updateFeatureRequestStatus(reqId, status) {
  const noteInput = document.getElementById('admin-note-' + reqId);
  const adminNote = noteInput ? noteInput.value.trim() : '';
  try {
    const res = await fetch('/api/admin/feature-request/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, requestId: reqId, status, adminNote })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Request ' + (status === 'approved' ? 'disetujui' : 'ditolak'), 'success');
      loadAdminFeatureRequests();
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal update', 'error'); }
}

async function deleteFeatureRequest(reqId) {
  if (!confirm('Hapus request ini?')) return;
  try {
    const res = await fetch('/api/admin/feature-request/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, requestId: reqId })
    });
    const data = await res.json();
    if (data.success) { showToast('Request dihapus', 'success'); loadAdminFeatureRequests(); }
  } catch(e) {}
}

// ============ GANTI PASSWORD ============
async function handleChangePassword() {
  const oldPassword = document.getElementById('old-password-input').value;
  const newPassword = document.getElementById('new-password-input').value;
  const confirmPassword = document.getElementById('confirm-password-input').value;
  if (!oldPassword || !newPassword || !confirmPassword) return showToast('Semua field password harus diisi!', 'error');
  if (newPassword.length < 4) return showToast('Password baru minimal 4 karakter!', 'error');
  if (newPassword !== confirmPassword) return showToast('Konfirmasi password tidak cocok!', 'error');
  try {
    const res = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, oldPassword, newPassword })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Password berhasil diubah!', 'success');
      document.getElementById('old-password-input').value = '';
      document.getElementById('new-password-input').value = '';
      document.getElementById('confirm-password-input').value = '';
    } else showToast(data.message || 'Gagal ganti password', 'error');
  } catch (e) { showToast('Kesalahan koneksi', 'error'); }
}

// ============ USERNAME UPDATE ============
async function triggerUpdateUsername() {
  const newUsername = document.getElementById('new-username-input').value.trim();
  if (!newUsername) return showToast('Masukkan username baru!', 'error');
  try {
    const response = await fetch('/api/user/username', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') },
      body: JSON.stringify({ currentUsername: loggedInUsername, newUsername })
    });
    const result = await response.json();
    if (response.ok && result.success) {
      showToast('Username berhasil diubah!', 'success');
      loggedInUsername = result.newUsername;
      localStorage.setItem('savedUsername', loggedInUsername);
      document.getElementById('logged-username').innerText = loggedInUsername;
      document.getElementById('profile-uname').innerText = loggedInUsername;
      document.getElementById('drawer-username').innerText = loggedInUsername;
      document.getElementById('new-username-input').value = '';
    } else showToast(result.message || 'Gagal mengubah username.', 'error');
  } catch (e) { showToast('Kesalahan jaringan', 'error'); }
}

// ============ RIWAYAT GMAIL & COUNTDOWN ============
async function loadVerifiedEmails(force = false) {
  if (!loggedInUsername) return;
  const now = Date.now();
  if (!force && now - lastEmailsFetch < CACHE_DURATION.emails) {
    const cached = getCached('verifiedEmails');
    if (cached) { renderVerifiedEmails(cached); return; }
  }
  const container = document.getElementById('verified-emails-list');
  if (!container) return;
  container.innerHTML = '<p class="text-slate-500 italic text-center py-2 text-xs animate-pulse">⏳ Memuat riwayat...</p>';
  try {
    const res = await fetch('/api/user/my-emails?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (!data.success) {
      container.innerHTML = '<p class="text-rose-400 italic text-center py-2 text-xs">Gagal memuat riwayat</p>';
      return;
    }
    lastEmailsFetch = now;
    setCache('verifiedEmails', data, CACHE_DURATION.emails);
    renderVerifiedEmails(data);
  } catch (e) {
    container.innerHTML = '<p class="text-rose-400 italic text-center py-2 text-xs">Kesalahan koneksi</p>';
  }
}

function renderVerifiedEmails(data) {
  const container = document.getElementById('verified-emails-list');
  if (!container) return;
  updateQuotaStatusCard(data);
  handleCountdown(data);
  const emails = data.activatedEmails || [];
  if (emails.length === 0) {
    container.innerHTML = '<div class="p-3 rounded-xl text-center" style="background: rgba(148,163,184,0.05); border: 1px dashed rgba(148,163,184,0.2);"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" style="margin: 0 auto 0.5rem; display: block;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><p class="text-xs text-slate-400 font-semibold">Belum ada Gmail terverifikasi</p><p class="text-[10px] text-slate-500 mt-0.5">Gmail yang berhasil diverifikasi akan muncul di sini</p></div>';
    return;
  }
  container.innerHTML = emails.map((email, idx) => {
    const isLatest = idx === emails.length - 1;
    const safeEmail = email.replace(/'/g, "\\'");
    return '<div class="p-2.5 rounded-xl animate-slide-up flex items-center justify-between gap-2" style="background: rgba(6,182,212,0.06); border: 1px solid rgba(6,182,212,0.22);"><div class="flex items-center gap-2.5 min-w-0 flex-1"><div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: rgba(6,182,212,0.15);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div class="min-w-0 flex-1"><p class="text-xs font-bold text-white truncate mono">' + escapeHtml(email) + '</p><div class="flex items-center gap-1.5 mt-0.5"><span class="text-[9px] text-emerald-400 font-bold flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-emerald-400"></span> Terverifikasi</span>' + (isLatest ? '<span class="text-[9px] text-amber-300 font-bold">• Terbaru</span>' : '') + '</div></div></div><button onclick="copyEmail(\'' + safeEmail + '\')" class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.25);" title="Copy email"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>';
  }).join('');
}

function updateQuotaStatusCard(data) {
  const total = data.totalQuota || 1;
  const used = data.usedQuota || 0;
  const remain = Math.max(0, total - used);
  document.getElementById('quota-used-display').innerText = used;
  document.getElementById('quota-remain-display').innerText = data.isAdmin || data.isVip ? '∞' : remain;
  document.getElementById('quota-total-display').innerText = data.isAdmin || data.isVip ? '∞' : total;
  const card = document.getElementById('quota-status-card');
  const badge = document.getElementById('quota-status-badge');
  if (data.isAdmin || data.isVip) {
    card.style.background = 'rgba(168,85,247,0.08)';
    card.style.borderColor = 'rgba(168,85,247,0.3)';
    badge.className = 'badge badge-vip';
    badge.innerText = data.isAdmin ? '👑 Admin' : '⭐ VIP';
  } else if (remain <= 0) {
    card.style.background = 'rgba(244,63,94,0.08)';
    card.style.borderColor = 'rgba(244,63,94,0.3)';
    badge.className = 'badge badge-offline';
    badge.innerText = '✗ Habis';
  } else if (remain <= 1) {
    card.style.background = 'rgba(245,158,11,0.08)';
    card.style.borderColor = 'rgba(245,158,11,0.3)';
    badge.className = 'badge badge-admin';
    badge.innerText = '⚠ Terbatas';
  } else {
    card.style.background = 'rgba(6,182,212,0.06)';
    card.style.borderColor = 'rgba(6,182,212,0.25)';
    badge.className = 'badge badge-online';
    badge.innerText = '✓ Tersedia';
  }
}

function handleCountdown(data) {
  const countdownCard = document.getElementById('reset-countdown-card');
  const resetBannerMain = document.getElementById('reset-banner-main');
  const total = data.totalQuota || 1;
  const used = data.usedQuota || 0;
  const remain = Math.max(0, total - used);
  if (quotaCountdownInterval) { clearInterval(quotaCountdownInterval); quotaCountdownInterval = null; }
  if (globalCountdownInterval) { clearInterval(globalCountdownInterval); globalCountdownInterval = null; }
  if (countdownCard) countdownCard.classList.add('hidden');
  if (resetBannerMain) resetBannerMain.classList.add('hidden');
  updateResetTimerDisplay(data);
  const shouldShow = remain <= 0 && !data.isAdmin && !data.isVip && data.nextResetTime > 0;
  if (!shouldShow) return;
  if (countdownCard) countdownCard.classList.remove('hidden');
  if (resetBannerMain) resetBannerMain.classList.remove('hidden');
  userQuotaData = { usedQuota: used, bonusQuota: data.bonusQuota || 0, totalQuota: total, nextResetTime: data.nextResetTime, lastResetTime: data.lastResetTime };
  const nextResetDate = new Date(data.nextResetTime);
  const timeStr = nextResetDate.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const nextResetEl = document.getElementById('next-reset-time');
  if (nextResetEl) nextResetEl.innerText = timeStr;
  const totalDuration = data.nextResetTime - data.lastResetTime;
  function tick() {
    if (!isPageVisible) return;
    const now = Date.now();
    const msLeft = userQuotaData.nextResetTime - now;
    if (msLeft <= 0) {
      clearInterval(quotaCountdownInterval);
      quotaCountdownInterval = null;
      ['countdown-hours', 'countdown-minutes', 'countdown-seconds', 'cd-hours-main', 'cd-minutes-main', 'cd-seconds-main'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '00';
      });
      showToast('🎉 Kuota Anda telah direset! Silakan verifikasi Gmail baru.', 'success', 5000);
      setTimeout(() => { loadVerifiedEmails(true); checkSavedSession(); }, 2000);
      return;
    }
    const hours = Math.floor(msLeft / 3600000);
    const minutes = Math.floor((msLeft % 3600000) / 60000);
    const seconds = Math.floor((msLeft % 60000) / 1000);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const elH = document.getElementById('countdown-hours');
    const elM = document.getElementById('countdown-minutes');
    const elS = document.getElementById('countdown-seconds');
    if (elH) elH.innerText = hh;
    if (elM) elM.innerText = mm;
    if (elS) elS.innerText = ss;
    const elH2 = document.getElementById('cd-hours-main');
    const elM2 = document.getElementById('cd-minutes-main');
    const elS2 = document.getElementById('cd-seconds-main');
    if (elH2) elH2.innerText = hh;
    if (elM2) elM2.innerText = mm;
    if (elS2) elS2.innerText = ss;
    const elapsed = totalDuration - msLeft;
    const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const pf = document.getElementById('reset-progress-fill');
    if (pf) pf.style.width = percent + '%';
  }
  tick();
  quotaCountdownInterval = setInterval(tick, 1000);
}

function updateResetTimerDisplay(data) {
  const total = data.totalQuota || 1;
  const used = data.usedQuota || 0;
  const remain = Math.max(0, total - used);
  const el = document.getElementById('reset-timer-display');
  if (!el) return;
  if (data.isAdmin || data.isVip) { el.innerText = '∞'; el.style.color = '#d8b4fe'; return; }
  if (remain > 0) { el.innerText = '24 Jam'; el.style.color = 'white'; return; }
  if (globalCountdownInterval) clearInterval(globalCountdownInterval);
  function updateStatCard() {
    if (!isPageVisible) return;
    const now = Date.now();
    const msLeft = data.nextResetTime - now;
    if (msLeft <= 0) { clearInterval(globalCountdownInterval); globalCountdownInterval = null; el.innerText = 'Reset!'; return; }
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    el.innerText = h + 'j ' + m + 'm';
    el.style.color = '#fda4af';
  }
  updateStatCard();
  globalCountdownInterval = setInterval(updateStatCard, 60000);
}

function copyEmail(email) {
  navigator.clipboard.writeText(email).then(() => { showToast('Email "' + email + '" tersalin!', 'success'); }).catch(() => { showToast('Gagal copy email', 'error'); });
}

// ============ CHUNKED UPLOAD ============
function initFileDrop() {
  const dropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('admin-video-file');
  if (!dropZone || !fileInput) return;
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileSelect(e.dataTransfer.files[0]); }
  });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
}

function handleFileSelect(file) {
  const info = document.getElementById('file-info');
  const btn = document.getElementById('btn-upload-video');
  if (!file.type.startsWith('video/')) { showToast('File harus berupa video!', 'error'); return; }
  if (file.size > 200 * 1024 * 1024) { showToast('File terlalu besar! Maksimal 200MB', 'error'); return; }
  selectedVideoFile = file;
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  info.innerText = '📁 ' + file.name + ' (' + sizeMB + ' MB)';
  info.classList.remove('hidden');
  btn.disabled = false;
  showToast('Video siap diupload: ' + sizeMB + 'MB', 'info');
}

async function handleUploadVideo() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  if (!selectedVideoFile) return showToast('Pilih video terlebih dahulu!', 'error');
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
  progressContainer.classList.remove('hidden');
  btn.disabled = true;
  btnText.innerText = 'Mengunggah...';
  const startTime = Date.now();
  let uploadedBytes = 0;
  try {
    statusText.innerText = 'Memulai upload...';
    const initRes = await fetch('/api/admin/upload-init', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, uploadId, filename: file.name, totalChunks, fileSize: file.size, fileType: file.type })
    });
    const initData = await initRes.json();
    if (!initData.success) throw new Error(initData.message || 'Gagal init upload');
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkBase64 = await blobToBase64(chunk);
      statusText.innerText = 'Upload chunk ' + (i + 1) + '/' + totalChunks;
      const chunkRes = await fetch('/api/admin/upload-chunk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loggedInUsername, uploadId, chunkIndex: i, chunkData: chunkBase64 })
      });
      const chunkData = await chunkRes.json();
      if (!chunkData.success) throw new Error(chunkData.message || 'Gagal upload chunk ' + i);
      uploadedBytes += chunk.size;
      const percent = Math.round((uploadedBytes / file.size) * 100);
      progressFill.style.width = percent + '%';
      percentText.innerText = percent + '%';
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = (uploadedBytes / 1024 / 1024) / elapsed;
      speedText.innerText = '⚡ ' + speed.toFixed(2) + ' MB/s • ' + (uploadedBytes / 1024 / 1024).toFixed(2) + ' / ' + (file.size / 1024 / 1024).toFixed(2) + ' MB';
    }
    statusText.innerText = 'Menyelesaikan...';
    const finalRes = await fetch('/api/admin/upload-finalize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, uploadId })
    });
    const finalData = await finalRes.json();
    if (!finalData.success) throw new Error(finalData.message || 'Gagal finalize');
    progressFill.style.width = '100%';
    percentText.innerText = '100%';
    statusText.innerText = '✓ Upload berhasil!';
    speedText.innerText = 'Total waktu: ' + ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    showToast('Video berhasil diperbarui!', 'success');
    selectedVideoFile = null;
    document.getElementById('admin-video-file').value = '';
    document.getElementById('file-info').classList.add('hidden');
    fetchFeaturedVideo(true);
    setTimeout(() => { progressContainer.classList.add('hidden'); progressFill.style.width = '0%'; }, 2500);
  } catch (err) {
    showToast('Upload gagal: ' + err.message, 'error');
    statusText.innerText = '✗ Upload gagal';
    progressFill.style.background = 'linear-gradient(90deg, #f43f5e, #dc2626)';
  } finally {
    btn.disabled = false;
    btnText.innerText = 'Upload & Perbarui Video';
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============ QUOTA & VIP ============
function updateQuotaDisplay(data) {
  if (data.isAdmin || data.isVip) document.getElementById('quota-display').innerText = '∞';
  else document.getElementById('quota-display').innerText = (data.usedQuota || 0) + '/' + (1 + (data.bonusQuota || 0));
}
function checkVipStatus(data) {
  const banner = document.getElementById('vip-status-banner');
  if (data.isVip && !data.isAdmin) {
    banner.classList.remove('hidden');
    document.getElementById('vip-expiry-text').innerText = 'Aktif hingga: ' + new Date(data.vipUntil).toLocaleString('id-ID');
  } else {
    banner.classList.add('hidden');
  }
}

// ============ ADMIN ACTIONS ============
async function changeServerState(newState) {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/admin/set-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newState, username: loggedInUsername })
    });
    const data = await res.json();
    if (data.success) {
      updateStatusUI(newState);
      setCache('serverStatus', newState, CACHE_DURATION.status);
      showToast('Server: ' + newState.toUpperCase(), 'success');
    }
  } catch(e) { showToast('Gagal ubah status', 'error'); }
}

async function handleSetVip() {
  if (!isAdminUser) return;
  const targetUser = document.getElementById('vip-target-user').value.trim();
  const days = parseInt(document.getElementById('vip-duration-days').value);
  if (!targetUser || isNaN(days)) return showToast('Lengkapi username dan hari!', 'error');
  try {
    const res = await fetch('/api/admin/set-vip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, targetUser, days })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('vip-target-user').value = '';
      document.getElementById('vip-duration-days').value = '';
      loadAdminVipList();
      loadAllUsers();
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal set VIP', 'error'); }
}

async function loadAdminVipList() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/admin/get-vip-list?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    const container = document.getElementById('admin-vip-list');
    if (data.success && Object.keys(data.vipUsers).length > 0) {
      container.innerHTML = Object.entries(data.vipUsers).map(([uname, val]) => 
        '<div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(7,4,15,0.6); border: 1px solid rgba(245,158,11,0.2);"><div><span class="text-amber-300 font-bold">' + uname + '</span><span class="text-slate-500 block text-[9px]">Exp: ' + new Date(val.vipUntil).toLocaleDateString('id-ID') + '</span></div><button onclick="handleRemoveVip(\'' + uname + '\')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.3);">Hapus</button></div>'
      ).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Tidak ada VIP aktif</p>';
    }
  } catch(e) {}
}

async function handleRemoveVip(targetUser) {
  if (!confirm('Cabut VIP untuk ' + targetUser + '?')) return;
  try {
    const res = await fetch('/api/admin/remove-vip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, targetUser })
    });
    const data = await res.json();
    if (data.success) { showToast('VIP dicabut', 'success'); loadAdminVipList(); loadAllUsers(); }
  } catch(e) {}
}

// ============ CREATE VIP ACCOUNT ============
async function handleCreateVipAccount() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  const vipUsername = document.getElementById('vip-create-username').value.trim().toLowerCase();
  const vipPassword = document.getElementById('vip-create-password').value.trim();
  const vipDays = parseInt(document.getElementById('vip-create-days').value);
  if (!vipUsername || !vipPassword || isNaN(vipDays)) return showToast('Lengkapi semua field!', 'error');
  if (vipPassword.length < 4) return showToast('Password minimal 4 karakter!', 'error');
  if (vipDays < 1) return showToast('Masa aktif minimal 1 hari!', 'error');
  try {
    const res = await fetch('/api/admin/create-vip-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, vipUsername, vipPassword, vipDays })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('vip-create-username').value = '';
      document.getElementById('vip-create-password').value = '';
      document.getElementById('vip-create-days').value = '';
      loadVipAccounts();
      loadAllUsers();
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal membuat akun VIP', 'error'); }
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
        const statusBadge = isActive 
          ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background: rgba(16,185,129,0.15); color: #6ee7b7;">AKTIF</span>'
          : '<span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background: rgba(244,63,94,0.15); color: #fda4af;">EXPIRED</span>';
        return '<div class="vip-account-card"><div class="flex justify-between items-start mb-1.5"><div class="flex-1 min-w-0"><p class="text-xs font-bold text-white mono truncate">' + escapeHtml(uname) + '</p><p class="text-[10px] text-slate-400 mono">Pwd: ' + escapeHtml(val.password) + '</p></div>' + statusBadge + '</div><div class="flex items-center justify-between text-[10px]"><span class="text-amber-300">⭐ s/d ' + new Date(val.vipUntil).toLocaleDateString('id-ID') + '</span><div class="flex gap-1"><button onclick="copyVipCredentials(\'' + escapeHtml(uname) + '\', \'' + escapeHtml(val.password) + '\')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(6,182,212,0.15); color: #67e8f9; border: 1px solid rgba(6,182,212,0.3);">📋 Copy</button><button onclick="deleteVipAccount(\'' + escapeHtml(uname) + '\')" class="delete-btn">🗑 Hapus</button></div></div></div>';
      }).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Belum ada akun VIP</p>';
    }
  } catch(e) {}
}

function copyVipCredentials(username, password) {
  const text = 'Username: ' + username + '\\nPassword: ' + password;
  navigator.clipboard.writeText(text).then(() => { showToast('Kredensial VIP tersalin!', 'success'); });
}

async function deleteVipAccount(vipUsername) {
  if (!confirm('Hapus akun VIP ' + vipUsername + '?')) return;
  try {
    const res = await fetch('/api/admin/delete-vip-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, vipUsername })
    });
    const data = await res.json();
    if (data.success) { showToast('Akun VIP dihapus', 'success'); loadVipAccounts(); loadAllUsers(); }
    else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal hapus akun VIP', 'error'); }
}

// ============ CEK USER TERDAFTAR ============
async function loadAllUsers() {
  if (!isAdminUser) return showToast('Akses ditolak!', 'error');
  const container = document.getElementById('all-users-list');
  container.innerHTML = '<p class="text-slate-500 italic text-center py-2 animate-pulse">⏳ Memuat daftar user...</p>';
  try {
    const res = await fetch('/api/admin/get-all-users?username=' + encodeURIComponent(loggedInUsername));
    const data = await res.json();
    if (!data.success) {
      container.innerHTML = '<p class="text-rose-400 italic text-center py-2">Gagal: ' + (data.message || 'Error') + '</p>';
      return;
    }
    cachedUserList = data.users || [];
    document.getElementById('stat-total').innerText = data.stats.total;
    document.getElementById('stat-admins').innerText = data.stats.admins;
    document.getElementById('stat-vips').innerText = data.stats.vips;
    document.getElementById('stat-reset').innerText = data.stats.resetDue;
    renderUserList();
    showToast('Berhasil memuat ' + data.stats.total + ' user', 'success');
  } catch (e) {
    container.innerHTML = '<p class="text-rose-400 italic text-center py-2">Kesalahan koneksi</p>';
    showToast('Gagal memuat daftar user', 'error');
  }
}

function setUserFilter(filter) {
  currentUserFilter = filter;
  document.querySelectorAll('.user-filter-btn').forEach(btn => {
    const isActive = btn.dataset.filter === filter;
    if (isActive) { btn.style.background = 'rgba(168,85,247,0.25)'; btn.style.borderColor = 'rgba(168,85,247,0.6)'; btn.style.color = 'white'; }
    else { btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; }
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
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-slate-500 italic text-center py-3">Tidak ada user yang cocok.</p>';
    return;
  }
  const now = Date.now();
  container.innerHTML = filtered.map(u => {
    let badgeClass = 'badge-user';
    let badgeText = '👤 User';
    let borderColor = 'rgba(148,163,184,0.25)';
    if (u.isAdmin) { badgeClass = 'badge-admin'; badgeText = '👑 Admin'; borderColor = 'rgba(245,158,11,0.4)'; }
    else if (u.isVip) { badgeClass = 'badge-vip'; badgeText = '⭐ VIP'; borderColor = 'rgba(168,85,247,0.45)'; }
    let quotaText = '';
    let quotaColor = '#67e8f9';
    if (u.isAdmin) { quotaText = '∞ Unlimited'; quotaColor = '#fbbf24'; }
    else if (u.isVip) { quotaText = '⭐ Unlimited (VIP)'; quotaColor = '#d8b4fe'; }
    else { quotaText = u.usedQuota + '/' + u.totalQuota + ' (+' + u.bonusQuota + ' bonus)'; quotaColor = u.usedQuota >= u.totalQuota ? '#fda4af' : '#67e8f9'; }
    let resetText = '';
    if (u.isResetDue) resetText = '🔄 Reset Tersedia';
    else if (u.nextResetTime > now) { const msLeft = u.nextResetTime - now; const hoursLeft = Math.floor(msLeft / 3600000); const minsLeft = Math.floor((msLeft % 3600000) / 60000); resetText = '⏱ ' + hoursLeft + 'j ' + minsLeft + 'm lagi'; }
    else resetText = '✓ Baru saja direset';
    let vipText = '';
    if (u.isVip && u.vipUntil) vipText = '⭐ VIP s/d ' + new Date(u.vipUntil).toLocaleDateString('id-ID');
    const safeUser = u.username.replace(/'/g, "\\'");
    return '<div class="p-2.5 rounded-lg animate-slide-up" style="background: rgba(7,4,15,0.6); border: 1px solid ' + borderColor + ';"><div class="flex justify-between items-start gap-2 mb-1.5"><div class="flex-1 min-w-0"><div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-white mono text-[12px]">' + escapeHtml(u.username) + '</span><span class="badge ' + badgeClass + '" style="font-size: 0.6rem; padding: 0.15rem 0.5rem;">' + badgeText + '</span></div><p class="text-slate-400 text-[10px] truncate mt-0.5">📧 ' + escapeHtml(u.email) + '</p></div></div><div class="grid grid-cols-2 gap-1.5 text-[10px]"><div class="p-1.5 rounded" style="background: rgba(6,182,212,0.06);"><p class="text-slate-500 text-[9px] uppercase font-bold">Kuota</p><p class="mono font-bold" style="color: ' + quotaColor + ';">' + quotaText + '</p></div><div class="p-1.5 rounded" style="background: rgba(168,85,247,0.06);"><p class="text-slate-500 text-[9px] uppercase font-bold">Reset</p><p class="mono font-bold text-purple-300">' + resetText + '</p></div></div>' + (vipText ? '<p class="text-[10px] text-amber-300 mt-1.5 font-semibold">' + vipText + '</p>' : '') + (u.activatedEmails && u.activatedEmails.length > 0 ? '<details class="mt-1.5"><summary class="text-[10px] text-cyan-300 cursor-pointer hover:text-cyan-200">📨 ' + u.activatedEmails.length + ' email diaktivasi</summary><div class="mt-1 space-y-0.5 pl-2">' + u.activatedEmails.slice(0, 10).map(e => '<p class="text-[9px] text-slate-400 mono truncate">• ' + escapeHtml(e) + '</p>').join('') + (u.activatedEmails.length > 10 ? '<p class="text-[9px] text-slate-500 italic">... dan ' + (u.activatedEmails.length - 10) + ' lainnya</p>' : '') + '</div></details>' : '') + '<div class="flex gap-1.5 mt-2 pt-2 border-t border-slate-800"><button onclick="quickSetVip(\'' + safeUser + '\')" class="flex-1 py-1 rounded text-[10px] font-bold transition" style="background: rgba(168,85,247,0.15); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.3);">⭐ Set VIP</button><button onclick="copyUsername(\'' + safeUser + '\')" class="flex-1 py-1 rounded text-[10px] font-bold transition" style="background: rgba(6,182,212,0.15); color: #67e8f9; border: 1px solid rgba(6,182,212,0.3);">📋 Copy</button>' + (u.isAdmin && u.username === loggedInUsername ? '' : '<button onclick="deleteUserAccount(\'' + safeUser + '\', ' + (u.isAdmin ? 'true' : 'false') + ')" class="flex-1 py-1 rounded text-[10px] font-bold transition" style="background: rgba(244,63,94,0.15); color: #fda4af; border: 1px solid rgba(244,63,94,0.3);">🗑 Hapus</button>') + '</div></div>';
  }).join('');
}

async function deleteUserAccount(targetUsername, isTargetAdmin) {
  const confirmText = isTargetAdmin ? '⚠️ HAPUS AKUN ADMIN "' + targetUsername + '"?\\n\\nAkun ini akan dihapus permanen!' : 'Hapus akun "' + targetUsername + '"?';
  if (!confirm(confirmText)) return;
  if (isTargetAdmin) {
    const secondConfirm = prompt('Ketik "HAPUS" untuk konfirmasi hapus akun admin:');
    if (secondConfirm !== 'HAPUS') { showToast('Penghapusan dibatalkan', 'info'); return; }
  }
  try {
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, targetUsername })
    });
    const data = await res.json();
    if (data.success) { showToast('Akun "' + targetUsername + '" berhasil dihapus!', 'success'); loadAllUsers(); }
    else showToast(data.message || 'Gagal menghapus akun', 'error');
  } catch(e) { showToast('Kesalahan koneksi', 'error'); }
}

function quickSetVip(username) {
  document.getElementById('vip-target-user').value = username;
  document.getElementById('vip-duration-days').focus();
  showToast('Username "' + username + '" siap di-set VIP', 'info');
  document.getElementById('vip-target-user').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function copyUsername(username) {
  navigator.clipboard.writeText(username).then(() => { showToast('Username "' + username + '" tersalin!', 'success'); });
}

// ============ GLOBAL CHAT ============
function updateChatBadge() {
  const badge = document.getElementById('chat-unread-badge');
  if (unreadChatCount > 0) { badge.textContent = unreadChatCount > 99 ? '99+' : unreadChatCount; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
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
        lastChatMessageId = latestId;
        lastChatFetch = now;
      }
    }
  } catch(e) {}
}

async function loadGlobalChat(force = false) {
  if (!loggedInUsername || !isPageVisible) return;
  const now = Date.now();
  if (!force && now - lastChatFetch < CACHE_DURATION.chat) {
    const cached = getCached('globalChat');
    if (cached) { renderGlobalChat(cached); return; }
  }
  const container = document.getElementById('chat-messages');
  try {
    const res = await fetch('/api/chat/messages');
    const data = await res.json();
    lastChatFetch = now;
    setCache('globalChat', data, CACHE_DURATION.chat);
    renderGlobalChat(data);
  } catch(e) {
    container.innerHTML = '<p class="text-rose-400 italic text-xs text-center py-3">Gagal memuat chat</p>';
  }
}

function renderGlobalChat(data) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  if (!data.success || !data.messages) { container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3">Belum ada pesan</p>'; return; }
  const entries = Object.entries(data.messages).sort((a,b) => a[1].timestamp - b[1].timestamp);
  if (entries.length === 0) { container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3">Belum ada pesan. Jadilah yang pertama!</p>'; return; }
  if (entries.length > 0) lastChatMessageId = entries[entries.length - 1][0];
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  container.innerHTML = entries.map(([id, msg]) => {
    const isMe = msg.username === loggedInUsername;
    const isAdmin = msg.isAdmin;
    const isVip = msg.isVip;
    let bubbleClass = isMe ? 'chat-bubble-me' : 'chat-bubble-other';
    if (isAdmin) bubbleClass += ' chat-bubble-admin';
    else if (isVip) bubbleClass += ' chat-bubble-vip';
    let roleIcon = '';
    if (isAdmin) roleIcon = '👑 ';
    else if (isVip) roleIcon = '⭐ ';
    else roleIcon = '👤 ';
    const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const isToday = new Date(msg.timestamp).toDateString() === new Date().toDateString();
    const timeStr = isToday ? time : date + ' ' + time;
    const deleteBtn = isAdminUser ? '<button onclick="deleteChatMessage(\'' + id + '\')" class="text-[9px] opacity-50 hover:opacity-100 ml-1" title="Hapus">🗑</button>' : '';
    return '<div class="chat-bubble ' + bubbleClass + '"><div class="chat-meta">' + roleIcon + '<span>' + escapeHtml(msg.username) + '</span>' + (isAdmin ? '<span class="text-amber-300">ADMIN</span>' : '') + (isVip && !isAdmin ? '<span class="text-purple-300">VIP</span>' : '') + deleteBtn + '</div><div>' + escapeHtml(msg.message) + '</div><div class="chat-timestamp">' + timeStr + '</div></div>';
  }).join('');
  if (wasAtBottom || container.scrollTop === 0) container.scrollTop = container.scrollHeight;
  const uniqueUsers = new Set(entries.slice(-50).map(e => e[1].username)).size;
  document.getElementById('chat-online-count').innerText = '👥 ' + uniqueUsers + ' user aktif';
}

async function sendChatMessage() {
  if (!loggedInUsername) return showToast('Harus login dulu!', 'error');
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, message })
    });
    const data = await res.json();
    if (data.success) { lastChatFetch = 0; await loadGlobalChat(true); }
    else { showToast(data.message || 'Gagal kirim pesan', 'error'); input.value = message; }
  } catch(e) { showToast('Kesalahan koneksi', 'error'); input.value = message; }
}

async function deleteChatMessage(messageId) {
  if (!isAdminUser) return;
  if (!confirm('Hapus pesan ini?')) return;
  try {
    const res = await fetch('/api/chat/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: loggedInUsername, messageId })
    });
    const data = await res.json();
    if (data.success) { showToast('Pesan dihapus', 'success'); lastChatFetch = 0; loadGlobalChat(true); }
  } catch(e) {}
}

// ============ ANNOUNCEMENTS ============
async function loadUserAnnouncements(force = false) {
  const now = Date.now();
  if (!force && now - lastAnnouncementsFetch < CACHE_DURATION.announcements) {
    const cached = getCached('userAnnouncements');
    if (cached) { renderUserAnnouncements(cached); return; }
  }
  try {
    const res = await fetch('/api/announcements');
    const data = await res.json();
    lastAnnouncementsFetch = now;
    setCache('userAnnouncements', data, CACHE_DURATION.announcements);
    renderUserAnnouncements(data);
  } catch(e) {}
}

function renderUserAnnouncements(data) {
  const container = document.getElementById('user-announcement-container');
  if (!container) return;
  if (data.success && Object.keys(data.announcements).length > 0) {
    const entries = Object.entries(data.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
    container.innerHTML = entries.map(([id, val]) => 
      '<div class="p-3 rounded-xl animate-slide-up" style="background: rgba(168,85,247,0.06); border: 1px solid rgba(168,85,247,0.18);"><div class="flex justify-between items-start mb-1.5"><span class="text-cyan-300 font-bold text-xs">' + escapeHtml(val.title) + '</span><span class="text-[9px] text-slate-500 mono">' + new Date(val.timestamp).toLocaleDateString('id-ID') + '</span></div><p class="text-slate-300 whitespace-pre-line text-[11px] leading-relaxed">' + escapeHtml(val.content) + '</p></div>'
    ).join('');
  } else {
    container.innerHTML = '<p class="text-slate-500 italic text-xs text-center py-3">Belum ada informasi</p>';
  }
}

async function loadAdminAnnouncements() {
  if (!isAdminUser) return;
  try {
    const res = await fetch('/api/announcements');
    const data = await res.json();
    const container = document.getElementById('admin-info-list');
    if (data.success && Object.keys(data.announcements).length > 0) {
      const entries = Object.entries(data.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
      container.innerHTML = entries.map(([id, val]) => 
        '<div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(7,4,15,0.6); border: 1px solid rgba(245,158,11,0.2);"><div class="truncate mr-2 flex-1"><span class="text-amber-300 font-bold block truncate">' + escapeHtml(val.title) + '</span></div><div class="flex gap-1 shrink-0"><button onclick="editAnnouncement(\'' + id + '\', \'' + encodeURIComponent(val.title) + '\', \'' + encodeURIComponent(val.content) + '\')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(6,182,212,0.2); color: #67e8f9;">Edit</button><button onclick="deleteAnnouncement(\'' + id + '\')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(244,63,94,0.2); color: #fda4af;">×</button></div></div>'
      ).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Belum ada info</p>';
    }
  } catch(e) {}
}

async function handleSaveAnnouncement() {
  if (!isAdminUser) return;
  const id = document.getElementById('info-edit-id').value;
  const title = document.getElementById('info-title').value.trim();
  const content = document.getElementById('info-content').value.trim();
  if (!title || !content) return showToast('Lengkapi judul & isi!', 'error');
  const endpoint = id ? '/api/admin/update-announcement' : '/api/admin/create-announcement';
  try {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, id, title, content })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      resetInfoForm();
      loadAdminAnnouncements();
      lastAnnouncementsFetch = 0;
      loadUserAnnouncements(true);
    } else showToast(data.message, 'error');
  } catch(e) { showToast('Gagal simpan', 'error'); }
}

function editAnnouncement(id, encTitle, encContent) {
  document.getElementById('info-edit-id').value = id;
  document.getElementById('info-title').value = decodeURIComponent(encTitle);
  document.getElementById('info-content').value = decodeURIComponent(encContent);
  document.getElementById('info-submit-btn').innerText = 'Perbarui Info';
  document.getElementById('info-cancel-btn').classList.remove('hidden');
}

function resetInfoForm() {
  document.getElementById('info-edit-id').value = '';
  document.getElementById('info-title').value = '';
  document.getElementById('info-content').value = '';
  document.getElementById('info-submit-btn').innerText = 'Publikasikan';
  document.getElementById('info-cancel-btn').classList.add('hidden');
}

async function deleteAnnouncement(id) {
  if (!confirm('Hapus informasi ini?')) return;
  try {
    const res = await fetch('/api/admin/delete-announcement', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Info dihapus', 'success');
      loadAdminAnnouncements();
      lastAnnouncementsFetch = 0;
      loadUserAnnouncements(true);
    }
  } catch(e) {}
}

// ============ REDEEM (ADMIN) ============
async function handleCreateRedeem() {
  if (!isAdminUser) return;
  const code = document.getElementById('gen-code').value.trim().toUpperCase();
  const quotaPerUser = parseInt(document.getElementById('gen-quota-per-user').value);
  const maxClaims = parseInt(document.getElementById('gen-max-claims').value);
  if (!code || isNaN(quotaPerUser) || isNaN(maxClaims)) return showToast('Lengkapi semua field!', 'error');
  if (quotaPerUser < 1) return showToast('Kuota per user minimal 1!', 'error');
  if (maxClaims < 1) return showToast('Maksimal klaim minimal 1!', 'error');
  try {
    const res = await fetch('/api/admin/create-redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, code, quotaPerUser, maxClaims })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('gen-code').value = '';
      document.getElementById('gen-quota-per-user').value = '';
      document.getElementById('gen-max-claims').value = '';
      loadAdminRedeems();
      lastRedeemsFetch = 0;
      loadActiveRedeems(true);
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
      container.innerHTML = Object.entries(data.redeems).map(([code, val]) => 
        '<div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(7,4,15,0.6); border: 1px solid rgba(245,158,11,0.2);"><div><span class="text-amber-300 font-bold mono">' + code + '</span><span class="text-slate-500 block text-[9px]">Kuota: ' + (val.quotaPerUser || 1) + '/user | Klaim: ' + val.claimedCount + '/' + val.maxClaims + '</span></div><button onclick="handleDeleteRedeem(\'' + code + '\')" class="px-2 py-1 rounded text-[10px]" style="background: rgba(244,63,94,0.2); color: #fda4af;">×</button></div>'
      ).join('');
    } else {
      container.innerHTML = '<p class="text-slate-500 italic text-center py-2">Belum ada kode</p>';
    }
  } catch(e) {}
}

async function handleDeleteRedeem(code) {
  if (!confirm('Hapus kode ' + code + '?')) return;
  try {
    const res = await fetch('/api/admin/delete-redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, code })
    });
    const data = await res.json();
    if (data.success) { showToast('Kode dihapus', 'success'); loadAdminRedeems(); lastRedeemsFetch = 0; loadActiveRedeems(true); }
  } catch(e) {}
}

// ============ GENERATOR ACTIONS ============
async function handleSendEmail() {
  const email = document.getElementById('target-email').value.trim();
  if (!email) return showToast('Masukkan email target!', 'error');
  const btn = document.getElementById('btn-send');
  const sendText = document.getElementById('send-text');
  btn.disabled = true;
  sendText.innerText = 'Mengirim...';
  const resultBox = document.getElementById('result-box');
  const resultText = document.getElementById('result-text');
  resultBox.classList.remove('hidden');
  resultText.innerText = '⏳ Memproses...';
  try {
    const res = await fetch('/api/magiclink', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUsername, email })
    });
    const data = await res.json();
    if (data.success) {
      sendText.innerText = 'Kirim Magic Link';
      currentResultText = JSON.stringify(data.result, null, 2);
      resultText.innerText = currentResultText;
      showToast('Magic link terkirim!', 'success');
      if (!isAdminUser && data.quotaInfo) updateQuotaDisplay(data.quotaInfo);
      loadVerifiedEmails(true);
    } else {
      sendText.innerText = 'Kirim Magic Link';
      currentResultText = 'Error: ' + data.message;
      resultText.innerText = currentResultText;
      showToast(data.message, 'error');
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
  if (!email || !magicUrl) return showToast('Email dan URL wajib diisi!', 'error');
  const resultBox = document.getElementById('result-box');
  const resultText = document.getElementById('result-text');
  resultBox.classList.remove('hidden');
  resultText.innerText = '⏳ Memverifikasi...';
  try {
    const res = await fetch('/api/verif', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, url: magicUrl, username: loggedInUsername })
    });
    const data = await res.json();
    currentResultText = JSON.stringify(data, null, 2);
    resultText.innerText = currentResultText;
    if (data.success || !data.error) showToast('Verifikasi selesai!', 'success');
    else showToast(data.error || 'Verifikasi gagal', 'error');
  } catch (err) {
    currentResultText = 'Error: ' + err.message;
    resultText.innerText = currentResultText;
    showToast('Gagal verifikasi', 'error');
  }
}

function copyResult() {
  if (!currentResultText) return;
  navigator.clipboard.writeText(currentResultText).then(() => showToast('Tersalin ke clipboard!', 'success'));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function handleLogout() {
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
initQRFileDrop();
initPaymentFileDrop();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const drawer = document.getElementById('nav-drawer');
    if (drawer.classList.contains('open')) toggleMenu();
    closePaymentModal();
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
      if (size > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
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

    } else if (parsedUrl.pathname === '/api/vip-packages' && req.method === 'GET') {
      const packages = await getVipPackagesFromDb();
      jsonResponse(res, 200, { success: true, packages });

    } else if (parsedUrl.pathname === '/api/payment-settings' && req.method === 'GET') {
      const settings = await getPaymentSettingsFromDb();
      jsonResponse(res, 200, { success: true, settings });

    } else if (parsedUrl.pathname === '/api/orders/create' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, orderId, packageId, packageName, days, price, proofImage } = JSON.parse(body);
      
      const cleanUser = username ? username.toLowerCase() : '';
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });

      if (!orderId || !packageId || !proofImage) {
        return jsonResponse(res, 400, { success: false, message: 'Data pesanan tidak lengkap!' });
      }

      await saveOrderToDb(orderId, {
        id: orderId,
        username: cleanUser,
        packageId,
        packageName,
        days: parseInt(days),
        price: parseInt(price),
        status: 'pending',
        proofImage,
        adminNote: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      jsonResponse(res, 200, { success: true, message: 'Pesanan berhasil dibuat!' });

    } else if (parsedUrl.pathname === '/api/orders/my' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      if (!username) return jsonResponse(res, 400, { success: false, message: 'Username diperlukan' });

      const allOrders = await getOrdersFromDb();
      const cleanUser = username.toLowerCase();
      const myOrders = Object.values(allOrders)
        .filter(o => o.username === cleanUser)
        .sort((a, b) => b.createdAt - a.createdAt);

      jsonResponse(res, 200, { success: true, orders: myOrders });

    } else if (parsedUrl.pathname === '/api/admin/orders' && req.method === 'GET') {
      const username = parsedUrl.searchParams.get('username');
      const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      const allOrders = await getOrdersFromDb();
      const orders = Object.values(allOrders).sort((a, b) => b.createdAt - a.createdAt);
      jsonResponse(res, 200, { success: true, orders });

    } else if (parsedUrl.pathname === '/api/admin/orders/confirm' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, orderId, status, adminNote } = JSON.parse(body);
      
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      if (!['success', 'failed', 'process'].includes(status)) {
        return jsonResponse(res, 400, { success: false, message: 'Status tidak valid!' });
      }

      const orderObj = await getOrderFromDb(orderId);
      if (!orderObj) return jsonResponse(res, 404, { success: false, message: 'Pesanan tidak ditemukan!' });

      orderObj.status = status;
      orderObj.adminNote = adminNote || '';
      orderObj.updatedAt = Date.now();
      await saveOrderToDb(orderId, orderObj);

      // Jika sukses, aktifkan VIP user
      if (status === 'success') {
        const targetUser = await getUserFromDb(orderObj.username);
        if (targetUser) {
          const now = Date.now();
          const currentVip = targetUser.vipUntil && targetUser.vipUntil > now ? targetUser.vipUntil : now;
          targetUser.vipUntil = currentVip + (orderObj.days * 24 * 60 * 60 * 1000);
          await saveUserToDb(orderObj.username, targetUser);
        }
      }

      jsonResponse(res, 200, { 
        success: true, 
        message: status === 'success' ? 'Pesanan dikonfirmasi & VIP diaktifkan!' : 'Pesanan ditolak' 
      });

    } else if (parsedUrl.pathname === '/api/admin/orders/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, orderId } = JSON.parse(body);
      
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      await removeOrderFromDb(orderId);
      jsonResponse(res, 200, { success: true, message: 'Pesanan dihapus!' });

    } else if (parsedUrl.pathname === '/api/admin/vip-packages/save' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, packageId, name, days, price } = JSON.parse(body);
      
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      if (!name || !days || price === undefined) {
        return jsonResponse(res, 400, { success: false, message: 'Data tidak lengkap!' });
      }

      const packages = await getVipPackagesFromDb();
      const id = packageId || ('vip_' + Date.now());
      
      packages[id] = {
        id,
        name: name.trim(),
        days: parseInt(days),
        price: parseInt(price),
        active: true
      };

      await saveVipPackagesToDb(packages);
      jsonResponse(res, 200, { success: true, message: 'Paket VIP disimpan!' });

    } else if (parsedUrl.pathname === '/api/admin/vip-packages/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, packageId } = JSON.parse(body);
      
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      const packages = await getVipPackagesFromDb();
      delete packages[packageId];
      await saveVipPackagesToDb(packages);
      
      jsonResponse(res, 200, { success: true, message: 'Paket dihapus!' });

    } else if (parsedUrl.pathname === '/api/admin/payment/upload-qr' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, qrImage } = JSON.parse(body);
      
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      const settings = await getPaymentSettingsFromDb();
      settings.qrImage = qrImage;
      await savePaymentSettingsToDb(settings);
      
      jsonResponse(res, 200, { success: true, message: 'QR Code berhasil diupload!' });

    } else if (parsedUrl.pathname === '/api/admin/payment/save-settings' && req.method === 'POST') {
      const body = await readBody(req);
      const { adminUsername, paymentNote } = JSON.parse(body);
      
      const adminObj = await getUserFromDb(adminUsername.toLowerCase());
      if (!adminObj || !adminObj.isAdmin) {
        return jsonResponse(res, 403, { success: false, message: 'Akses ditolak!' });
      }

      const settings = await getPaymentSettingsFromDb();
      settings.paymentNote = paymentNote || '';
      await savePaymentSettingsToDb(settings);
      
      jsonResponse(res, 200, { success: true, message: 'Pengaturan disimpan!' });

    } else if (parsedUrl.pathname === '/api/redeems/active' && req.method === 'GET') {
      const allRedeems = await getAllRedeemsFromDb();
      const activeRedeems = {};
      for (const [code, val] of Object.entries(allRedeems)) {
        const remainingClaims = val.maxClaims - val.claimedCount;
        if (remainingClaims > 0) {
          activeRedeems[code] = { quotaPerUser: val.quotaPerUser || 1, maxClaims: val.maxClaims, claimedCount: val.claimedCount };
        }
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
      if (!title || !description) return jsonResponse(res, 400, { success: false, message: 'Judul dan deskripsi harus diisi!' });
      if (title.length < 3 || title.length > 100) return jsonResponse(res, 400, { success: false, message: 'Judul 3-100 karakter!' });
      if (description.length < 10 || description.length > 1000) return jsonResponse(res, 400, { success: false, message: 'Deskripsi 10-1000 karakter!' });
      const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      await saveFeatureRequestToDb(reqId, { id: reqId, username: cleanUser, title: title.trim(), description: description.trim(), status: 'pending', timestamp: Date.now(), adminNote: '' });
      jsonResponse(res, 200, { success: true, message: 'Request fitur berhasil dikirim!' });

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
      reqObj.status = status;
      reqObj.adminNote = adminNote || '';
      reqObj.updatedAt = Date.now();
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
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const lastReset = userObj.lastResetTime || now;
      const nextReset = lastReset + twentyFourHours;
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      if (now - lastReset >= twentyFourHours) {
        userObj.activatedEmails = [];
        userObj.lastResetTime = now;
        await saveUserToDb(cleanUser, userObj);
        return jsonResponse(res, 200, { success: true, activatedEmails: [], usedQuota: 0, bonusQuota: userObj.bonusQuota || 0, totalQuota: 1 + (userObj.bonusQuota || 0), lastResetTime: now, nextResetTime: now + twentyFourHours, isVip: isVipActive, isAdmin: !!userObj.isAdmin, resetJustNow: true });
      }
      jsonResponse(res, 200, { success: true, activatedEmails: userObj.activatedEmails || [], usedQuota: userObj.activatedEmails ? userObj.activatedEmails.length : 0, bonusQuota: userObj.bonusQuota || 0, totalQuota: 1 + (userObj.bonusQuota || 0), lastResetTime: lastReset, nextResetTime: nextReset, isVip: isVipActive, isAdmin: !!userObj.isAdmin, resetJustNow: false });

    } else if (parsedUrl.pathname === '/api/user/change-password' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, oldPassword, newPassword } = JSON.parse(body);
      if (!username || !oldPassword || !newPassword) return jsonResponse(res, 400, { success: false, message: 'Semua field harus diisi!' });
      if (newPassword.length < 4) return jsonResponse(res, 400, { success: false, message: 'Password baru minimal 4 karakter!' });
      const cleanUser = username.toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan' });
      if (userObj.password !== oldPassword) return jsonResponse(res, 401, { success: false, message: 'Password lama salah!' });
      userObj.password = newPassword;
      await saveUserToDb(cleanUser, userObj);
      jsonResponse(res, 200, { success: true, message: 'Password berhasil diubah!' });

    } else if (parsedUrl.pathname === '/api/chat/messages' && req.method === 'GET') {
      const messages = await getGlobalChatFromDb();
      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      for (const [id, msg] of Object.entries(messages)) {
        if (now - msg.timestamp > threeDays) {
          await deleteGlobalChatMessageFromDb(id);
          delete messages[id];
        }
      }
      jsonResponse(res, 200, { success: true, messages });

    } else if (parsedUrl.pathname === '/api/chat/send' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, message } = JSON.parse(body);
      if (!username || !message) return jsonResponse(res, 400, { success: false, message: 'Username dan pesan harus diisi!' });
      const cleanUser = username.toLowerCase();
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 403, { success: false, message: 'User tidak valid!' });
      const trimmedMsg = message.trim().substring(0, 500);
      if (!trimmedMsg) return jsonResponse(res, 400, { success: false, message: 'Pesan tidak boleh kosong!' });
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
      if (!cleanVipUser || !vipPassword || !vipDays) return jsonResponse(res, 400, { success: false, message: 'Lengkapi semua field!' });
      if (vipDays < 1 || vipDays > 3650) return jsonResponse(res, 400, { success: false, message: 'Masa aktif 1-3650 hari!' });
      const existingUser = await getUserFromDb(cleanVipUser);
      if (existingUser) return jsonResponse(res, 400, { success: false, message: 'Username sudah terdaftar!' });
      const now = Date.now();
      const vipUntil = now + (vipDays * 24 * 60 * 60 * 1000);
      await saveUserToDb(cleanVipUser, { password: vipPassword, email: 'vip@am-premium.local', isAdmin: false, activatedEmails: [], bonusQuota: 0, lastResetTime: now, vipUntil: vipUntil, isVipAccount: true, createdBy: adminUsername.toLowerCase(), createdAt: now });
      const vipAccId = 'vip_' + now + '_' + Math.random().toString(36).substring(2, 8);
      await saveVipAccountToDb(vipAccId, { username: cleanVipUser, password: vipPassword, vipUntil: vipUntil, createdBy: adminUsername.toLowerCase(), createdAt: now });
      jsonResponse(res, 200, { success: true, message: 'Akun VIP "' + cleanVipUser + '" berhasil dibuat untuk ' + vipDays + ' hari!', username: cleanVipUser, vipUntil: vipUntil });

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
      if (cleanTarget === adminUsername.toLowerCase()) return jsonResponse(res, 400, { success: false, message: 'Tidak dapat menghapus akun sendiri!' });
      if (cleanTarget === 'adminbaguss') return jsonResponse(res, 400, { success: false, message: 'Akun admin utama tidak dapat dihapus!' });
      const targetUser = await getUserFromDb(cleanTarget);
      if (!targetUser) return jsonResponse(res, 404, { success: false, message: 'User tidak ditemukan!' });
      await deleteUserFromDb(cleanTarget);
      const vipAccounts = await getVipAccountsFromDb();
      for (const [id, acc] of Object.entries(vipAccounts)) {
        if (acc.username === cleanTarget) await removeVipAccountFromDb(id);
      }
      jsonResponse(res, 200, { success: true, message: 'Akun "' + cleanTarget + '" berhasil dihapus!', deletedUser: cleanTarget });

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
        return { username: uname, email: udata.email || '-', isAdmin: !!udata.isAdmin, isVip: !!isVip, vipUntil: udata.vipUntil || 0, usedQuota: usedQuota, bonusQuota: bonusQuota, totalQuota: 1 + bonusQuota, lastResetTime: lastReset, nextResetTime: nextReset, isResetDue: isResetDue, activatedEmails: udata.activatedEmails || [], isVipAccount: !!udata.isVipAccount };
      });
      userList.sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
        if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
        return a.username.localeCompare(b.username);
      });
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
      const now = Date.now();
      const currentVip = targetObj.vipUntil && targetObj.vipUntil > now ? targetObj.vipUntil : now;
      targetObj.vipUntil = currentVip + (days * 24 * 60 * 60 * 1000);
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
      if (targetObj) {
        targetObj.vipUntil = 0;
        await saveUserToDb(cleanTarget, targetObj);
      }
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
      if (!code || !quotaPerUser || !maxClaims) return jsonResponse(res, 400, { success: false, message: 'Lengkapi semua field!' });
      if (quotaPerUser < 1 || maxClaims < 1) return jsonResponse(res, 400, { success: false, message: 'Kuota dan maks klaim minimal 1!' });
      const existingCode = await getRedeemFromDb(code);
      if (existingCode) return jsonResponse(res, 400, { success: false, message: 'Kode redeem sudah ada!' });
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
      if (redeemObj.claimedUsers && redeemObj.claimedUsers.includes(cleanUser)) return jsonResponse(res, 400, { success: false, message: 'Anda sudah pernah klaim kode ini!' });
      if (redeemObj.claimedCount >= redeemObj.maxClaims) return jsonResponse(res, 400, { success: false, message: 'Kuota klaim kode habis!' });
      const rewardQuota = redeemObj.quotaPerUser || 1;
      if (!userObj.bonusQuota) userObj.bonusQuota = 0;
      userObj.bonusQuota += rewardQuota;
      redeemObj.claimedCount += 1;
      if (!redeemObj.claimedUsers) redeemObj.claimedUsers = [];
      redeemObj.claimedUsers.push(cleanUser);
      await saveUserToDb(cleanUser, userObj);
      await saveRedeemToDb(code, redeemObj);
      jsonResponse(res, 200, { success: true, message: 'Berhasil klaim! Anda dapat ' + rewardQuota + ' kuota bonus.', usedQuota: userObj.activatedEmails ? userObj.activatedEmails.length : 0, bonusQuota: userObj.bonusQuota, isVip: userObj.vipUntil && userObj.vipUntil > Date.now(), isAdmin: userObj.isAdmin });

    } else if (parsedUrl.pathname === '/api/auth/session' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, token } = JSON.parse(body);
      if (!username || !token) return jsonResponse(res, 400, { success: false });
      const cleanUser = username.toLowerCase();
      const existingUser = await getUserFromDb(cleanUser);
      if (!existingUser) return jsonResponse(res, 404, { success: false });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (!existingUser.lastResetTime) existingUser.lastResetTime = now;
      if (now - existingUser.lastResetTime >= twentyFourHours) {
        existingUser.activatedEmails = [];
        existingUser.lastResetTime = now;
        await saveUserToDb(cleanUser, existingUser);
      }
      const isVipActive = existingUser.vipUntil && existingUser.vipUntil > now;
      const usedCount = existingUser.activatedEmails ? existingUser.activatedEmails.length : 0;
      jsonResponse(res, 200, { success: true, username: cleanUser, isAdmin: existingUser.isAdmin, usedQuota: usedCount, bonusQuota: existingUser.bonusQuota || 0, isVip: isVipActive, vipUntil: existingUser.vipUntil || 0, serverStatus: currentServerStatus });

    } else if (parsedUrl.pathname === '/api/auth' && req.method === 'POST') {
      const body = await readBody(req);
      const { mode, username, password, email, deviceToken } = JSON.parse(body);
      const cleanUser = username.trim().toLowerCase();
      let existingUser = await getUserFromDb(cleanUser);
      if (mode === 'register') {
        if (cleanUser === 'adminbaguss' || existingUser) return jsonResponse(res, 400, { success: false, message: 'Username tidak tersedia!' });
        const newDeviceToken = deviceToken || ('dev_' + Math.random().toString(36).substring(2) + Date.now());
        await saveUserToDb(cleanUser, { password, email, isAdmin: false, activatedEmails: [], bonusQuota: 0, lastResetTime: Date.now(), vipUntil: 0, deviceToken: newDeviceToken });
        const fakeAuthToken = 'token_' + Math.random().toString(36).substring(2) + Date.now();
        return jsonResponse(res, 200, { success: true, message: 'Registrasi berhasil!', username: cleanUser, isAdmin: false, usedQuota: 0, bonusQuota: 0, isVip: false, serverStatus: currentServerStatus, deviceToken: newDeviceToken, token: fakeAuthToken });
      } else {
        if (existingUser && existingUser.password === password) {
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000;
          if (!existingUser.lastResetTime) existingUser.lastResetTime = now;
          if (now - existingUser.lastResetTime >= twentyFourHours) {
            existingUser.activatedEmails = [];
            existingUser.lastResetTime = now;
            await saveUserToDb(cleanUser, existingUser);
          }
          const isVipActive = existingUser.vipUntil && existingUser.vipUntil > now;
          const usedCount = existingUser.activatedEmails ? existingUser.activatedEmails.length : 0;
          const fakeAuthToken = 'token_' + Math.random().toString(36).substring(2) + Date.now();
          return jsonResponse(res, 200, { success: true, message: 'Login berhasil!', username: cleanUser, isAdmin: existingUser.isAdmin, usedQuota: usedCount, bonusQuota: existingUser.bonusQuota || 0, isVip: isVipActive, vipUntil: existingUser.vipUntil || 0, serverStatus: currentServerStatus, token: fakeAuthToken });
        }
        return jsonResponse(res, 401, { success: false, message: 'Username atau password salah!' });
      }

    } else if (parsedUrl.pathname === '/api/magiclink' && req.method === 'POST') {
      const body = await readBody(req);
      const { username, email } = JSON.parse(body);
      const cleanUser = username ? username.toLowerCase() : '';
      const userObj = await getUserFromDb(cleanUser);
      if (!userObj) return jsonResponse(res, 400, { success: false, message: 'User tidak ditemukan.' });
      if (currentServerStatus !== 'online' && !userObj.isAdmin) return jsonResponse(res, 403, { success: false, message: 'Server sedang offline.' });
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - (userObj.lastResetTime || now) >= twentyFourHours) {
        userObj.activatedEmails = [];
        userObj.lastResetTime = now;
      }
      if (!userObj.activatedEmails) userObj.activatedEmails = [];
      if (!userObj.bonusQuota) userObj.bonusQuota = 0;
      const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
      const maxAllowed = 1 + userObj.bonusQuota;
      if (!userObj.isAdmin && !isVipActive) {
        if (!userObj.activatedEmails.includes(email) && userObj.activatedEmails.length >= maxAllowed) {
          return jsonResponse(res, 403, { success: false, message: 'Kuota aktivasi Anda habis!' });
        }
      }
      const result = await am.magiclink(email);
      if (!userObj.isAdmin && !isVipActive && !userObj.activatedEmails.includes(email)) {
        userObj.activatedEmails.push(email);
        await saveUserToDb(cleanUser, userObj);
      }
      jsonResponse(res, 200, { success: true, result, quotaInfo: { usedQuota: userObj.activatedEmails.length, bonusQuota: userObj.bonusQuota } });

    } else if (parsedUrl.pathname === '/api/verif' && req.method === 'POST') {
      const body = await readBody(req);
      const { email, url: verifyUrl, username } = JSON.parse(body);
      let userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
      if (currentServerStatus !== 'online' && (!userObj || !userObj.isAdmin)) return jsonResponse(res, 403, { error: 'Server sedang offline.' });
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
      jsonResponse(res, 500, { success: false, message: err.message || 'Internal server error' });
    }
  }
});

server.listen(PORT, () => {
  console.log('\\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 AM Premium Banggus v4.0 (VIP Store & Payment)        ║');
  console.log('║  📡 http://localhost:' + PORT + '                                  ║');
  console.log('║  💾 Optimasi: Cache 30-60s, Lazy Load, Visibility API   ║');
  console.log('║  📦 Chunked Upload Ready (>200MB)                        ║');
  console.log('║  🛒 Fitur Baru: Beli VIP Premium                         ║');
  console.log('║  💳 Pembayaran QRIS + Upload Bukti                       ║');
  console.log('║  ✅ Konfirmasi Admin → Auto VIP                          ║');
  console.log('║  ⚙️  Admin bisa atur harga & masa aktif VIP              ║');
  console.log('║  📋 Halaman Pesanan Saya                                 ║');
  console.log('║  🎁 Redeem Code (Fixed Quota per User)                   ║');
  console.log('║  💬 Global Chat (Polling 15s, hemat kuota)               ║');
  console.log('║  ⭐ VIP Account Generator                                ║');
  console.log('║  💡 Request Fitur Baru (User → Admin)                    ║');
  console.log('║  🛡️ Panel Admin Terpisah dari Profil                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\\n');
});