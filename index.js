const http = require('http');
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

let serverStatus = 'online'; 

const am = {
  async magiclink(email) {
    if (!email.includes("@") || !email.includes(".")) throw new Error("Invalid email.");
    const { data } = await go.get('/api/am', {
      query: {
        action: 'send',
        apikey: config.apikey,
        email: email
      }
    });
    return data;
  },
   
  async verif(email, url) {
    const { data } = await go.get('/api/am', {
      query: {
        action: 'verif',
        apikey: config.apikey,
        email: email,
        url: url
      }
    });
    return data;
  }
};

async function getUserFromDb(username) {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `users/${username}`));
  if (snapshot.exists()) return snapshot.val();
  return null;
}

async function saveUserToDb(username, userData) {
  await set(ref(db, `users/${username}`), userData);
}

async function getRedeemFromDb(code) {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `redeems/${code}`));
  if (snapshot.exists()) return snapshot.val();
  return null;
}

async function saveRedeemToDb(code, redeemData) {
  await set(ref(db, `redeems/${code}`), redeemData);
}

async function removeRedeemFromDb(code) {
  await set(ref(db, `redeems/${code}`), null);
}

async function getAllRedeemsFromDb() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `redeems`));
  if (snapshot.exists()) return snapshot.val();
  return {};
}

async function getAllAnnouncementsFromDb() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `announcements`));
  if (snapshot.exists()) return snapshot.val();
  return {};
}

async function saveAnnouncementToDb(id, announcementData) {
  await set(ref(db, `announcements/${id}`), announcementData);
}

async function removeAnnouncementFromDb(id) {
  await set(ref(db, `announcements/${id}`), null);
}

async function getAllUsersFromDb() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `users`));
  if (snapshot.exists()) return snapshot.val();
  return {};
}

async function getVideoFromDb() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `settings/featuredVideo`));
  if (snapshot.exists()) return snapshot.val();
  return 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-lights-31910-large.mp4';
}

async function saveVideoToDb(videoUrl) {
  await set(ref(db, `settings/featuredVideo`), videoUrl);
}

// Database helper untuk Presets
async function getAllPresetsFromDb() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `presets`));
  if (snapshot.exists()) return snapshot.val();
  return {};
}

async function getPresetFromDb(id) {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `presets/${id}`));
  if (snapshot.exists()) return snapshot.val();
  return null;
}

async function savePresetToDb(id, presetData) {
  await set(ref(db, `presets/${id}`), presetData);
}

async function removePresetFromDb(id) {
  await set(ref(db, `presets/${id}`), null);
}

// Database helper untuk Penarikan Saldo (Withdrawals)
async function getAllWithdrawalsFromDb() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `withdrawals`));
  if (snapshot.exists()) return snapshot.val();
  return {};
}

async function getWithdrawalFromDb(id) {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `withdrawals/${id}`));
  if (snapshot.exists()) return snapshot.val();
  return null;
}

async function saveWithdrawalToDb(id, wdData) {
  await set(ref(db, `withdrawals/${id}`), wdData);
}

async function initAdmin() {
  const adminData = await getUserFromDb('adminbaguss');
  if (!adminData) {
    await saveUserToDb('adminbaguss', {
      password: 'baguss',
      isAdmin: true,
      isCreator: true,
      activatedEmails: [],
      bonusQuota: 0,
      lastResetTime: Date.now(),
      vipUntil: 0,
      balance: 0,
      hasWithdrawn100: false,
      creatorStatus: 'approved'
    });
  }
}
initAdmin();

// ==========================================
// KODE HTML UI MODERN & FITUR HAPUS PRESET
// ==========================================
const htmlTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AM Premium Banggus</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        html, body {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
            margin: 0;
            padding: 0;
            background-color: #0b0614;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 1.125rem;
        }
        .mono { font-family: 'JetBrains Mono', monospace; }
        
        .phone-wrapper {
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 1.25rem;
            position: relative;
            box-sizing: border-box;
            overflow-x: hidden;
        }

        .glass-panel {
            background: rgba(18, 12, 30, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(168, 85, 247, 0.15);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.05);
            border-radius: 1.75rem;
            padding: 1.5rem;
        }
        .input-glow {
            background: rgba(12, 8, 22, 0.9);
            border: 1px solid rgba(168, 85, 247, 0.2);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 9999px;
            padding: 0.85rem 1.25rem;
            font-size: 0.95rem;
        }
        .input-glow:focus {
            border-color: rgba(168, 85, 247, 0.8);
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.25);
            outline: none;
        }
        .cyber-btn {
            background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
            box-shadow: 0 10px 25px -5px rgba(168, 85, 247, 0.4);
            transition: all 0.3s ease;
            border-radius: 9999px;
            padding-top: 0.95rem;
            padding-bottom: 0.95rem;
            font-size: 0.95rem;
        }
        .cyber-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px -5px rgba(168, 85, 247, 0.6);
        }
        .cyber-btn-green {
            background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
            box-shadow: 0 10px 25px -5px rgba(34, 197, 94, 0.4);
            transition: all 0.3s ease;
            border-radius: 9999px;
            padding-top: 0.95rem;
            padding-bottom: 0.95rem;
            font-size: 0.95rem;
        }
        .cyber-btn-green:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px -5px rgba(34, 197, 94, 0.6);
        }
        @keyframes pulseGlow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
        }
        .glow-bg {
            animation: pulseGlow 6s infinite ease-in-out;
        }
        
        #nav-drawer {
            transition: transform 0.3s ease-in-out;
            transform: translateX(100%);
            width: 100%;
            max-width: 360px;
            padding: 1.75rem;
        }
        #nav-drawer.open {
            transform: translateX(0%);
        }
    </style>
</head>
<body class="min-h-screen text-slate-100 selection:bg-purple-500 selection:text-white">

    <div class="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none glow-bg"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none glow-bg"></div>

    <div class="phone-wrapper z-10">
        
        <!-- HEADER -->
        <header class="w-full flex items-center justify-between py-3 px-2 border-b border-purple-500/10 mb-4">
            <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-base">⚡</div>
                <span id="app-title-header" class="font-extrabold text-sm tracking-tight bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent cursor-pointer" onclick="switchView('generator')">UPGRADE AM MENJADI PREMIUM</span>
            </div>
            <button id="header-menu-btn" onclick="toggleMenu()" class="group relative p-3 rounded-2xl bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/60 text-slate-200 transition-all duration-300 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hidden" style="width: 3.25rem; height: 3.25rem;">
                <div class="flex flex-col justify-between items-center h-5 w-5 py-0.5 transition-transform duration-300 group-hover:scale-110">
                    <span class="w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_8px_#c084fc]"></span>
                    <span class="w-3.5 h-2 bg-purple-400 rounded-full shadow-[0_0_8px_#c084fc] transition-all duration-300 group-hover:w-5"></span>
                    <span class="w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_8px_#c084fc]"></span>
                </div>
            </button>
        </header>

        <!-- MENU DRAWER SLIDE SAMPING -->
        <div id="nav-drawer" class="fixed inset-y-0 right-0 z-50 bg-[#0b0614]/95 backdrop-blur-xl border-l border-purple-500/20 flex flex-col justify-between shadow-2xl">
            <div class="space-y-6">
                <div class="flex items-center justify-between pb-4 border-b border-purple-500/20">
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-black uppercase tracking-widest text-purple-400">MENU DASBOARD</h3>
                    </div>
                    <button onclick="toggleMenu()" class="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/30 flex items-center justify-center text-slate-300 hover:text-white text-base">✕</button>
                </div>

                <nav class="space-y-3 text-sm font-semibold">
                    <button onclick="switchView('generator')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left">
                        Generator Utama
                    </button>
                    <button onclick="switchView('presets')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left">
                        Vidio Preset
                    </button>
                    <button id="menu-creator-upload" onclick="switchView('creator-upload')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left hidden">
                        Post Preset
                    </button>
                    <button id="menu-wallet" onclick="switchView('wallet')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left hidden">
                        Penarikan Saldo
                    </button>
                    <button onclick="switchView('profile')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left">
                        Halaman Akun & Profil
                    </button>
                    <button onclick="switchView('guide')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left">
                        Panduan Penggunaan
                    </button>
                    <button onclick="switchView('announcement')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left">
                        Informasi & Pengumuman
                    </button>
                </nav>
            </div>

            <div class="pt-5 border-t border-purple-500/20 space-y-3">
                <div id="drawer-user-info" class="text-xs text-slate-300 truncate">
                    Status: <span id="drawer-status-role" class="text-purple-400 font-bold">Belum Login</span>
                </div>
                <button onclick="handleLogout()" id="drawer-logout-btn" class="w-full py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold hover:bg-rose-500/20 transition hidden">
                    Keluar / Logout
                </button>
            </div>
        </div>
        <div id="drawer-overlay" onclick="toggleMenu()" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden"></div>

        <div class="w-full my-auto py-2 space-y-4">
            
            <div id="offline-banner" class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center hidden">
                🔴 Server sedang dalam mode OFFLINE. Fitur premium dinonaktifkan.
            </div>

            <!-- VIEW 1: AUTHENTICATION -->
            <div id="auth-view" class="glass-panel space-y-5">
                <div class="text-center space-y-1">
                    <h1 class="text-xl font-extrabold tracking-tight text-white">Selamat Datang</h1>
                    <p class="text-xs text-slate-400">Silakan masuk atau daftar untuk mengakses sistem</p>
                </div>
                
                <div class="relative flex rounded-full bg-[#07040d] p-1.5 border border-purple-500/20">
                    <div id="tab-indicator" class="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-300 shadow-lg shadow-purple-500/20"></div>
                    <button onclick="switchAuthTab('login')" id="tab-login-btn" class="relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-full transition-colors text-white">LOGIN</button>
                    <button onclick="switchAuthTab('register')" id="tab-reg-btn" class="relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-full transition-colors text-slate-400 hover:text-white">REGISTER</button>
                </div>

                <div class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="text-[11px] font-bold uppercase tracking-wider text-purple-300 pl-2">Username ID</label>
                        <input type="text" id="auth-username" placeholder="Masukkan username unik..." class="input-glow w-full text-slate-200 font-medium placeholder:text-slate-600">
                    </div>

                    <div class="space-y-1.5">
                        <label class="text-[11px] font-bold uppercase tracking-wider text-purple-300 pl-2">Security Password</label>
                        <input type="password" id="auth-password" placeholder="••••••••" class="input-glow w-full text-slate-200 font-medium placeholder:text-slate-600">
                    </div>

                    <div id="email-field-container" class="space-y-1.5 hidden transition-all duration-300">
                        <label class="text-[11px] font-bold uppercase tracking-wider text-purple-300 pl-2">Recovery Email</label>
                        <input type="email" id="auth-email" placeholder="Masukan Gmail Anda" class="input-glow w-full text-slate-200 font-medium placeholder:text-slate-600">
                        <p class="text-[10px] text-amber-400/90 pl-2 pt-0.5">⚠️ Setiap perangkat/HP hanya diizinkan membuat 1 akun.</p>
                    </div>
                </div>

                <button onclick="handleAuthAction()" id="auth-submit-btn" class="cyber-btn w-full text-white font-extrabold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span id="auth-btn-text">Masuk ke Terminal</span>
                </button>
            </div>

            <!-- VIEW 2: HALAMAN UTAMA / GENERATOR -->
            <div id="terminal-view" class="space-y-4 hidden">
                
                <!-- BANNER VIDEO UTAMA -->
                <div class="w-full h-44 rounded-2xl overflow-hidden relative border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.2)] bg-black">
                    <video id="main-display-video" src="" autoplay loop muted playsinline class="w-full h-full object-cover"></video>
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0b0614] via-transparent to-transparent opacity-60 pointer-events-none"></div>
                </div>

                <!-- INFO USER & STATUS KECIL -->
                <div class="glass-panel py-3 px-4 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 text-slate-300 truncate">
                        <div class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                        <span class="truncate">ID: <strong id="logged-username" class="text-white font-bold"></strong></span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <div id="server-status-indicator" class="px-2.5 py-1 rounded-full border text-[10px] flex items-center gap-1.5 font-semibold">
                            <span id="server-dot" class="w-1.5 h-1.5 rounded-full"></span>
                            <span id="server-status-text">Checking...</span>
                        </div>
                        <span id="role-badge" class="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold">User</span>
                    </div>
                </div>

                <div id="vip-status-banner" class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/40 hidden flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xl">👑</span>
                        <div>
                            <p class="text-xs font-extrabold text-amber-400">VIP Premium Member</p>
                            <p id="vip-expiry-text" class="text-[10px] text-slate-300">Aktif hingga: -</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full uppercase">ACTIVE</span>
                </div>

                <div class="glass-panel py-3 px-4 flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs">⚡</div>
                        <div>
                            <p class="text-xs font-bold text-slate-200" id="quota-title-label">Activation Quota</p>
                            <p class="text-[10px] text-slate-400">Reset otomatis 24 Jam</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 text-purple-300 text-xs font-extrabold bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20 mono">
                        <span id="quota-display">0/3</span>
                    </div>
                </div>

                <!-- FORM GENERATOR UTAMA -->
                <div class="glass-panel space-y-3.5">
                    <div class="space-y-1.5">
                        <label class="text-xs font-bold text-purple-300 flex items-center gap-2 pl-1">
                            <span>✉️</span> Kirim ke Alight Motion
                        </label>
                        <input type="email" id="target-email" placeholder="contoh@gmail.com" class="input-glow w-full text-slate-200">
                    </div>

                    <button id="btn-send" onclick="handleSendEmail()" class="cyber-btn w-full text-white font-extrabold flex items-center justify-center gap-2">
                        <span id="send-icon">🚀</span> <span id="send-text">Kirim</span>
                    </button>

                    <div class="space-y-3 pt-2">
                        <label class="text-xs font-bold text-emerald-400 flex items-center gap-2 pl-1">
                            <span>✅</span> Verifikasi
                        </label>
                        <input type="text" id="magic-url" placeholder="https://alight-creative.firebaseapp.com/_..." class="input-glow w-full text-emerald-300 font-medium text-xs placeholder:text-slate-600">
                    </div>

                    <button onclick="handleActivate()" class="cyber-btn-green w-full text-slate-950 font-extrabold flex items-center justify-center gap-2">
                        <span>✓</span> Verifikasi
                    </button>
                </div>

                <div id="result-box" class="input-glow p-3 text-xs hidden text-purple-300 break-all bg-purple-950/20 border-purple-500/30 mono rounded-2xl">
                    <p id="result-text"></p>
                </div>
            </div>

            <!-- VIEW: FEED PRESET VIDEO -->
            <div id="section-presets" class="glass-panel space-y-4 hidden">
                <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <h2 class="text-xs font-extrabold text-purple-400 uppercase tracking-wider">Vidio Preset</h2>
                    <button onclick="switchView('generator')" class="text-xs text-slate-400 hover:text-white underline">← Kembali</button>
                </div>
                <div id="preset-feed-container" class="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                    <p class="text-slate-500 italic text-xs">Memuat daftar preset...</p>
                </div>
            </div>

            <!-- VIEW: UPLOAD POST PRESET (CREATOR) -->
            <div id="section-creator-upload" class="glass-panel space-y-4 hidden">
                <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <h2 class="text-xs font-extrabold text-amber-400 uppercase tracking-wider">Upload Preset</h2>
                    <button onclick="switchView('generator')" class="text-xs text-slate-400 hover:text-white underline">← Kembali</button>
                </div>
                <div class="space-y-3 text-xs">
                    <div class="space-y-1">
                        <label class="text-purple-300 font-bold">Judul / Keterangan Preset:</label>
                        <input type="text" id="preset-title-input" placeholder="Cth: Preset Jedag Jedug AM Kece" class="input-glow w-full text-slate-200 text-xs">
                    </div>
                    <div class="space-y-1">
                        <label class="text-purple-300 font-bold">Link Tautan Preset (XML / Alight Link):</label>
                        <input type="text" id="preset-link-input" placeholder="https://..." class="input-glow w-full text-slate-200 text-xs">
                    </div>
                    <div class="space-y-1">
                        <label class="text-purple-300 font-bold">File Video Preview (.mp4):</label>
                        <input type="file" id="preset-video-file" accept="video/*" class="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer">
                    </div>
                    <button onclick="handleUploadPreset()" id="btn-upload-preset" class="cyber-btn w-full text-white font-extrabold uppercase tracking-wider mt-2">Posting Preset</button>
                </div>
            </div>

            <!-- VIEW: SALDO & PENARIKAN (CREATOR) -->
            <div id="section-wallet" class="glass-panel space-y-4 hidden">
                <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <h2 class="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">Penarikan Saldo</h2>
                    <button onclick="switchView('generator')" class="text-xs text-slate-400 hover:text-white underline">← Kembali</button>
                </div>

                <div class="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-center">
                    <p class="text-xs text-slate-300 font-bold">Saldo Tersedia:</p>
                    <p id="creator-balance-display" class="text-2xl font-black text-emerald-400 mono">Rp 0</p>
                    <p class="text-[10px] text-slate-400">Setiap upload & share link preset otomatis masuk Rp 50.</p>
                </div>

                <div class="space-y-3 pt-2">
                    <p class="text-xs font-bold text-purple-300">Form Tarik Saldo (DANA):</p>
                    <div class="space-y-1.5 text-xs">
                        <label class="text-slate-300">Nominal Penarikan:</label>
                        <select id="wd-amount-select" class="input-glow w-full text-slate-200 text-xs">
                            <option value="20000">Rp 20.000 (Minimal Tukar)</option>
                        </select>
                    </div>
                    <div class="space-y-1.5 text-xs">
                        <label class="text-slate-300">Nomor DANA:</label>
                        <input type="text" id="wd-dana-phone" placeholder="08xxxxxxxxxx" class="input-glow w-full text-slate-200 text-xs">
                    </div>
                    <div class="space-y-1.5 text-xs">
                        <label class="text-slate-300">Atas Nama DANA:</label>
                        <input type="text" id="wd-dana-name" placeholder="Nama pemilik akun DANA..." class="input-glow w-full text-slate-200 text-xs">
                    </div>
                    <button onclick="handleRequestWithdrawal()" class="cyber-btn-green w-full text-slate-950 font-extrabold text-xs uppercase tracking-wider mt-2">Ajukan Penarikan Saldo</button>
                </div>
            </div>

            <!-- VIEW 3: HALAMAN PROFIL KHUSUS AKUN -->
            <div id="section-profile" class="glass-panel space-y-5 hidden">
                <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <h2 class="text-xs font-extrabold text-purple-400 uppercase tracking-wider">Halaman Akun & Profil</h2>
                    <button onclick="switchView('generator')" class="text-xs text-slate-400 hover:text-white underline">← Kembali</button>
                </div>
                
                <div class="space-y-2 text-xs text-slate-300 p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20">
                    <p>Username Anda: <strong id="profile-uname" class="text-white font-bold"></strong></p>
                    <p>Tipe Keanggotaan: <strong id="profile-role" class="text-purple-400">Standard User</strong></p>
                    <p>Status Creator: <strong id="profile-creator-status" class="text-amber-400">Belum Aktif</strong></p>
                    <div id="creator-register-container" class="pt-2">
                        <button id="btn-register-creator" onclick="handleRegisterCreator()" class="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full text-xs transition">Daftar Menjadi Creator</button>
                    </div>
                    <p>Sisa Kuota Aktif: <strong id="profile-quota" class="text-cyan-400">0</strong></p>
                </div>

                <!-- UBAH USERNAME -->
                <div class="space-y-2 pt-2 border-t border-purple-500/10">
                    <label class="text-[11px] font-bold uppercase tracking-wider text-purple-300 pl-1">Ganti Username Akun</label>
                    <div class="flex gap-2">
                        <input type="text" id="new-username-input" placeholder="Username baru..." class="input-glow flex-1 px-4 py-2.5 text-slate-200 text-xs">
                        <button onclick="triggerUpdateUsername()" class="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full text-xs transition">Simpan</button>
                    </div>
                </div>

                <!-- KLAIM KODE REDEEM -->
                <div class="space-y-2 pt-2 border-t border-purple-500/10">
                    <label class="text-[11px] font-bold uppercase tracking-wider text-purple-300 pl-1">Klaim Kode Redeem Kuota</label>
                    <div class="flex gap-2">
                        <input type="text" id="redeem-code-input" placeholder="KODE-XXXX..." class="input-glow flex-1 px-4 py-2.5 text-purple-300 font-bold uppercase tracking-widest text-xs">
                        <button onclick="handleRedeemCode()" class="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full text-xs transition">Klaim</button>
                    </div>
                </div>

                <!-- ADMIN CONTROL PANEL -->
                <div id="admin-control-panel" class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3.5 hidden">
                    <p class="text-xs font-extrabold text-amber-400 flex items-center gap-2">
                        <span>👑</span> Admin Master Control Panel
                    </p>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="changeServerState('online')" class="py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-full text-[11px] text-emerald-300 font-bold transition">🟢 Online</button>
                        <button onclick="changeServerState('offline')" class="py-2.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 rounded-full text-[11px] text-rose-300 font-bold transition">🔴 Offline</button>
                    </div>

                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <p class="text-[11px] text-amber-300 font-bold">Ubah Video Tampilan Utama (Upload File):</p>
                        <input type="file" id="admin-video-file" accept="video/*" class="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer">
                        <button onclick="handleUploadVideo()" id="btn-upload-video" class="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-full text-xs transition">Upload & Perbarui Video</button>
                    </div>

                    <!-- KONFIRMASI / KELOLA PENDAFTARAN CREATOR -->
                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <div class="flex justify-between items-center text-[11px] text-amber-300 font-bold">
                            <span>Permintaan Pendaftaran Creator:</span>
                            <button onclick="loadAdminCreatorRequests()" class="text-slate-400 hover:text-white underline">Refresh</button>
                        </div>
                        <div id="admin-creator-requests-list" class="space-y-1.5 max-h-32 overflow-y-auto text-[11px]">
                            <p class="text-slate-500 italic">Memuat list pendaftar...</p>
                        </div>
                    </div>

                    <!-- ADMIN LIST PENARIKAN SALDO -->
                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <div class="flex justify-between items-center text-[11px] text-amber-300 font-bold">
                            <span>List Penarikan Saldo (Withdrawals):</span>
                            <button onclick="loadAdminWithdrawals()" class="text-slate-400 hover:text-white underline">Refresh</button>
                        </div>
                        <div id="admin-withdrawals-list" class="space-y-1.5 max-h-36 overflow-y-auto text-[11px]">
                            <p class="text-slate-500 italic">Memuat list penarikan...</p>
                        </div>
                    </div>

                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <p class="text-[11px] text-amber-300 font-bold">Pengaturan VIP User (Jumlah Hari):</p>
                        <input type="text" id="vip-target-user" placeholder="Username Target..." class="input-glow w-full px-4 py-2.5 text-slate-200 text-xs">
                        <div class="flex gap-2">
                            <input type="number" id="vip-duration-days" placeholder="Jumlah Hari (Cth: 30)" class="input-glow flex-1 px-4 py-2.5 text-slate-200 text-xs">
                            <button onclick="handleSetVip()" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-full text-[11px] transition">Set VIP</button>
                        </div>
                        <div class="flex justify-between items-center text-[10px] text-amber-300 pt-0.5">
                            <span>List Akun VIP Aktif:</span>
                            <button onclick="loadAdminVipList()" class="text-slate-400 hover:text-white underline">Refresh</button>
                        </div>
                        <div id="admin-vip-list" class="space-y-1.5 max-h-28 overflow-y-auto text-[11px]">
                            <p class="text-slate-500 italic">Memuat list VIP...</p>
                        </div>
                    </div>

                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <p class="text-[11px] text-amber-300 font-bold">Buat Kode Redeem Random:</p>
                        <input type="text" id="gen-code" placeholder="Nama Kode (Cth: BONUSRAYA)" class="input-glow w-full px-4 py-2.5 text-slate-200 uppercase text-xs">
                        <div class="grid grid-cols-2 gap-2">
                            <input type="number" id="gen-total-quota" placeholder="Total Kuota" class="input-glow px-4 py-2.5 text-slate-200 text-xs">
                            <input type="number" id="gen-max-claims" placeholder="Maks Orang" class="input-glow px-4 py-2.5 text-slate-200 text-xs">
                        </div>
                        <button onclick="handleCreateRedeem()" class="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-full text-xs transition">Generate Kode Redeem</button>
                    </div>

                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <div class="flex justify-between items-center text-[10px] text-amber-300">
                            <span>Daftar Kode Aktif:</span>
                            <button onclick="loadAdminRedeems()" class="text-slate-400 hover:text-white underline">Refresh</button>
                        </div>
                        <div id="admin-redeem-list" class="space-y-1.5 max-h-28 overflow-y-auto text-[11px]">
                            <p class="text-slate-500 italic">Memuat...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VIEW 4: HALAMAN PANDUAN PENGGUNAAN -->
            <div id="section-guide" class="glass-panel space-y-4 hidden">
                <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <h2 class="text-xs font-extrabold text-purple-400 uppercase tracking-wider">Panduan Cara Menggunakan</h2>
                    <button onclick="switchView('generator')" class="text-xs text-slate-400 hover:text-white underline">← Kembali</button>
                </div>
                <ol class="list-decimal list-inside space-y-2.5 text-xs text-slate-300 leading-relaxed">
                    <li>Pastikan Anda sudah berhasil masuk ke dalam sistem menggunakan akun Anda.</li>
                    <li>Beralih ke menu <strong>Generator Utama</strong> untuk mulai memproses token.</li>
                    <li>Masukkan email target Google/Gmail Anda pada kolom yang telah disediakan.</li>
                    <li>Klik tombol <strong>Send</strong> untuk memicu token verifikasi.</li>
                    <li>Salin tautan Magic Link yang masuk ke email Anda, lalu tempel (*paste*) pada kolom URL.</li>
                    <li>Klik tombol hijau <strong>Verify</strong> dan proses selesai dengan sempurna!</li>
                    <li>Nikmati fitur <strong>Vidio Preset</strong> untuk melihat dan mengunduh karya sesama pengguna.</li>
                </ol>
            </div>

            <!-- VIEW 5: HALAMAN INFORMASI & PENGUMUMAN -->
            <div id="section-announcement" class="glass-panel space-y-4 hidden">
                <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <h2 class="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">Informasi & Pengumuman Resmi</h2>
                    <button onclick="switchView('generator')" class="text-xs text-slate-400 hover:text-white underline">← Kembali</button>
                </div>
                
                <div id="user-announcement-container" class="space-y-3 max-h-72 overflow-y-auto text-xs pr-1">
                    <p class="text-slate-500 italic">Memuat informasi...</p>
                </div>

                <div id="admin-announcement-panel" class="space-y-3 pt-3 border-t border-purple-500/20 hidden">
                    <p class="text-xs font-extrabold text-amber-400">Panel Tambah/Edit Pengumuman (Admin)</p>
                    <input type="hidden" id="info-edit-id" value="">
                    <input type="text" id="info-title" placeholder="Judul Informasi" class="input-glow w-full px-4 py-2.5 text-slate-200 text-xs">
                    <textarea id="info-content" placeholder="Isi pesan informasi..." class="input-glow w-full px-4 py-2.5 text-slate-200 h-24 resize-none text-xs rounded-2xl"></textarea>
                    <div class="flex gap-2">
                        <button id="info-submit-btn" onclick="handleSaveAnnouncement()" class="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full text-xs transition">Publikasikan Info</button>
                        <button id="info-cancel-btn" onclick="resetInfoForm()" class="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full text-xs hidden">Batal</button>
                    </div>
                    <div id="admin-info-list" class="space-y-1.5 max-h-28 overflow-y-auto text-[11px] pt-1">
                        <p class="text-slate-500 italic">Memuat list kelola info...</p>
                    </div>
                </div>
            </div>

            <div class="text-center pt-1">
                <p class="text-[10px] text-slate-500 tracking-wider font-medium">AM Premium • By Banggus</p>
            </div>
        </div>
    </div>

    <script>
        let currentAuthMode = 'login';
        let loggedInUsername = '';
        let isAdminUser = false;
        let isCreatorUser = false;
        let currentBalance = 0;
        let hasWithdrawn100 = false;
        let creatorStatus = 'none';

        function toggleMenu() {
            const drawer = document.getElementById('nav-drawer');
            const overlay = document.getElementById('drawer-overlay');
            drawer.classList.toggle('open');
            overlay.classList.toggle('hidden');
        }

        function switchView(viewName) {
            toggleMenu(); 
            
            document.getElementById('terminal-view').classList.add('hidden');
            document.getElementById('section-profile').classList.add('hidden');
            document.getElementById('section-guide').classList.add('hidden');
            document.getElementById('section-announcement').classList.add('hidden');
            document.getElementById('section-presets').classList.add('hidden');
            document.getElementById('section-creator-upload').classList.add('hidden');
            document.getElementById('section-wallet').classList.add('hidden');

            if (viewName === 'generator') {
                document.getElementById('terminal-view').classList.remove('hidden');
            } else if (viewName === 'profile') {
                document.getElementById('section-profile').classList.remove('hidden');
            } else if (viewName === 'guide') {
                document.getElementById('section-guide').classList.remove('hidden');
            } else if (viewName === 'announcement') {
                document.getElementById('section-announcement').classList.remove('hidden');
                loadUserAnnouncements();
            } else if (viewName === 'presets') {
                document.getElementById('section-presets').classList.remove('hidden');
                loadPresetFeed();
            } else if (viewName === 'creator-upload') {
                document.getElementById('section-creator-upload').classList.remove('hidden');
            } else if (viewName === 'wallet') {
                document.getElementById('section-wallet').classList.remove('hidden');
                updateWalletUI();
            }
        }

        async function fetchServerStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                updateStatusUI(data.status);
            } catch(e) {}
        }

        async function fetchFeaturedVideo() {
            try {
                const res = await fetch('/api/video');
                const data = await res.json();
                if (data.success && data.videoUrl) {
                    const videoEl = document.getElementById('main-display-video');
                    if (videoEl && videoEl.src !== data.videoUrl) {
                        videoEl.src = data.videoUrl;
                    }
                }
            } catch(e) {}
        }

        function updateStatusUI(status) {
            const ind = document.getElementById('server-status-indicator');
            const dot = document.getElementById('server-dot');
            const txt = document.getElementById('server-status-text');
            const offlineBanner = document.getElementById('offline-banner');

            if (!ind || !dot || !txt) return;

            if (status === 'online') {
                ind.className = "px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] flex items-center gap-1.5 font-semibold";
                dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse";
                txt.innerText = "Online";
                if (offlineBanner) offlineBanner.classList.add('hidden');
            } else {
                ind.className = "px-2.5 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px] flex items-center gap-1.5 font-semibold";
                dot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
                txt.innerText = "Offline";
                if (offlineBanner && !isAdminUser) offlineBanner.classList.remove('hidden');
            }
        }

        fetchServerStatus();
        fetchFeaturedVideo();
        setInterval(fetchServerStatus, 5000);
        setInterval(fetchFeaturedVideo, 10000);

        function switchAuthTab(mode) {
            currentAuthMode = mode;
            const loginBtn = document.getElementById('tab-login-btn');
            const regBtn = document.getElementById('tab-reg-btn');
            const indicator = document.getElementById('tab-indicator');
            const emailField = document.getElementById('email-field-container');
            const btnText = document.getElementById('auth-btn-text');

            if(mode === 'login') {
                indicator.style.transform = 'translateX(0%)';
                loginBtn.className = "relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-full transition-colors text-white";
                regBtn.className = "relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-full transition-colors text-slate-400 hover:text-white";
                emailField.classList.add('hidden');
                btnText.innerText = "Masuk ke Terminal";
            } else {
                indicator.style.transform = 'translateX(100%)';
                regBtn.className = "relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-full transition-colors text-white";
                loginBtn.className = "relative z-10 flex-1 py-2.5 text-xs font-bold tracking-wider rounded-full transition-colors text-slate-400 hover:text-white";
                emailField.classList.remove('hidden');
                btnText.innerText = "Daftar Akun Baru";
            }
        }

        async function handleAuthAction() {
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            const email = document.getElementById('auth-email').value.trim();

            if (!username || !password) return alert('Username dan password wajib diisi!');

            let deviceToken = localStorage.getItem('am_device_token');
            if (currentAuthMode === 'register' && deviceToken) {
                return alert('Perangkat/HP ini sudah pernah mendaftarkan akun sebelumnya!');
            }

            try {
                const res = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: currentAuthMode, username, password, email, deviceToken })
                });
                const data = await res.json();

                if (data.success) {
                    if (currentAuthMode === 'register' && data.deviceToken) {
                        localStorage.setItem('am_device_token', data.deviceToken);
                    }
                    if (data.token) {
                        localStorage.setItem('authToken', data.token);
                        localStorage.setItem('savedUsername', data.username);
                    }
                    alert(data.message);
                    applyUserSessionData(data);
                } else {
                    alert('Gagal: ' + data.message);
                }
            } catch (err) {
                alert('Terjadi kesalahan koneksi server.');
            }
        }

        function applyUserSessionData(data) {
            loggedInUsername = data.username;
            isAdminUser = data.isAdmin;
            isCreatorUser = data.isCreator || data.isAdmin;
            currentBalance = data.balance || 0;
            hasWithdrawn100 = data.hasWithdrawn100 || false;
            creatorStatus = data.creatorStatus || 'none';

            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('terminal-view').classList.remove('hidden');
            
            document.getElementById('header-menu-btn').classList.remove('hidden');
            document.getElementById('logged-username').innerText = data.username;
            
            document.getElementById('profile-uname').innerText = data.username;
            document.getElementById('profile-role').innerText = data.isAdmin ? 'Admin Master' : (data.isVip ? 'VIP Member' : 'Standard User');
            
            let statusText = 'Belum Aktif';
            if (isCreatorUser) statusText = 'Aktif (Creator)';
            else if (creatorStatus === 'pending') statusText = 'Menunggu Konfirmasi Admin';
            else if (creatorStatus === 'rejected') statusText = 'Ditolak Admin';
            document.getElementById('profile-creator-status').innerText = statusText;

            const regCreatorContainer = document.getElementById('creator-register-container');
            if (isCreatorUser || isAdminUser || creatorStatus === 'pending') {
                regCreatorContainer.classList.add('hidden');
            } else {
                regCreatorContainer.classList.remove('hidden');
                const btnReg = document.getElementById('btn-register-creator');
                if (creatorStatus === 'rejected') {
                    btnReg.innerText = 'Daftar Ulang Menjadi Creator';
                } else {
                    btnReg.innerText = 'Daftar Menjadi Creator';
                }
            }

            let quotaLimit = isCreatorUser ? 10 : 3;
            document.getElementById('quota-title-label').innerText = isCreatorUser ? 'Creator Quota (Max 10)' : 'Activation Quota';
            document.getElementById('profile-quota').innerText = data.isAdmin || data.isVip ? 'Unlimited' : (quotaLimit + (data.bonusQuota || 0) - data.usedQuota);

            document.getElementById('drawer-status-role').innerText = data.username + ' (' + (data.isAdmin ? 'Admin' : 'User') + ')';
            document.getElementById('drawer-logout-btn').classList.remove('hidden');

            if (isCreatorUser) {
                document.getElementById('menu-creator-upload').classList.remove('hidden');
                document.getElementById('menu-wallet').classList.remove('hidden');
            } else {
                document.getElementById('menu-creator-upload').classList.add('hidden');
                document.getElementById('menu-wallet').classList.add('hidden');
            }

            updateQuotaDisplay(data);
            checkVipStatus(data);
            loadUserAnnouncements();
            updateStatusUI(data.serverStatus);
            fetchFeaturedVideo();

            if(data.isAdmin) {
                document.getElementById('role-badge').className = "px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-extrabold";
                document.getElementById('role-badge').innerText = "👑 Admin Master";
                document.getElementById('admin-control-panel').classList.remove('hidden');
                document.getElementById('admin-announcement-panel').classList.remove('hidden');
                loadAdminRedeems();
                loadAdminAnnouncements();
                loadAdminVipList();
                loadAdminCreatorRequests();
                loadAdminWithdrawals();
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
                if (data.success) {
                    applyUserSessionData(data);
                }
            } catch (e) {}
        }
        checkSavedSession();

        async function handleRegisterCreator() {
            try {
                const res = await fetch('/api/user/register-creator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    creatorStatus = 'pending';
                    document.getElementById('profile-creator-status').innerText = 'Menunggu Konfirmasi Admin';
                    document.getElementById('creator-register-container').classList.add('hidden');
                } else {
                    alert(data.message);
                }
            } catch(e) {
                alert('Terjadi kesalahan jaringan.');
            }
        }

        async function triggerUpdateUsername() {
            const newUsername = document.getElementById('new-username-input').value.trim();
            if (!newUsername) return alert('Masukkan username baru!');
            await handleUpdateUsername(newUsername);
        }

        async function handleUpdateUsername(newUsername) {
            try {
                const response = await fetch('/api/user/username', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '')
                    },
                    body: JSON.stringify({ currentUsername: loggedInUsername, newUsername })
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    alert('Username berhasil diubah!');
                    loggedInUsername = result.newUsername;
                    localStorage.setItem('savedUsername', loggedInUsername);
                    document.getElementById('logged-username').innerText = loggedInUsername;
                    document.getElementById('profile-uname').innerText = loggedInUsername;
                    document.getElementById('new-username-input').value = '';
                } else {
                    alert(result.message || 'Gagal mengubah username.');
                }
            } catch (error) {
                alert('Terjadi kesalahan jaringan.');
            }
        }

        async function handleUploadVideo() {
            if (!isAdminUser) return alert('Akses ditolak! Hanya admin.');
            const fileInput = document.getElementById('admin-video-file');
            const file = fileInput.files[0];
            if (!file) return alert('Silakan pilih file video terlebih dahulu!');

            const uploadBtn = document.getElementById('btn-upload-video');
            uploadBtn.innerText = "Mengunggah & Mengonversi...";
            uploadBtn.disabled = true;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async function () {
                const base64Video = reader.result;
                try {
                    const res = await fetch('/api/admin/set-video', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUsername, videoUrl: base64Video })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('Video berhasil diperbarui dan disiarkan ke semua user!');
                        fileInput.value = '';
                        fetchFeaturedVideo();
                    } else {
                        alert(data.message || 'Gagal mengunggah video.');
                    }
                } catch(e) {
                    alert('Terjadi kesalahan koneksi.');
                } finally {
                    uploadBtn.innerText = "Upload & Perbarui Video";
                    uploadBtn.disabled = false;
                }
            };
        }

        async function handleAdminCreatorAction(targetUser, actionType) {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/admin/creator-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, targetUser, actionType })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    loadAdminCreatorRequests();
                } else {
                    alert(data.message);
                }
            } catch(e) {
                alert('Gagal memproses aksi creator.');
            }
        }

        async function loadAdminCreatorRequests() {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/admin/creator-requests?username=' + encodeURIComponent(loggedInUsername));
                const data = await res.json();
                const container = document.getElementById('admin-creator-requests-list');
                container.innerHTML = '';

                if (data.success && Object.keys(data.requests).length > 0) {
                    for (let [uname, val] of Object.entries(data.requests)) {
                        container.innerHTML += \`
                            <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-xl border border-amber-500/20">
                                <div>
                                    <span class="text-amber-300 font-bold">@\${uname}</span>
                                    <span class="text-slate-400 block text-[9px]">Status: Pendaftar Creator</span>
                                </div>
                                <div class="flex gap-1">
                                    <button onclick="handleAdminCreatorAction('\${uname}', 'approve')" class="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg border border-emerald-500/30 text-[10px] font-bold">Terima</button>
                                    <button onclick="handleAdminCreatorAction('\${uname}', 'reject')" class="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg border border-rose-500/30 text-[10px] font-bold">Tolak</button>
                                </div>
                            </div>
                        \`;
                    }
                } else {
                    container.innerHTML = '<p class="text-slate-500 italic">Tidak ada pendaftar creator baru.</p>';
                }
            } catch(e) {}
        }

        async function handleUploadPreset() {
            const title = document.getElementById('preset-title-input').value.trim();
            const link = document.getElementById('preset-link-input').value.trim();
            const videoFile = document.getElementById('preset-video-file').files[0];

            if (!title || !link || !videoFile) {
                return alert('Judul, link preset, dan file video wajib diisi!');
            }

            const btn = document.getElementById('btn-upload-preset');
            btn.innerText = "Mengunggah Preset...";
            btn.disabled = true;

            const readerVideo = new FileReader();
            readerVideo.readAsDataURL(videoFile);
            readerVideo.onload = async function() {
                const videoBase64 = readerVideo.result;
                try {
                    const res = await fetch('/api/presets/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUsername, title, link, videoUrl: videoBase64 })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('Preset berhasil diposting! Saldo Rp 50 otomatis masuk ke akun Anda.');
                        document.getElementById('preset-title-input').value = '';
                        document.getElementById('preset-link-input').value = '';
                        document.getElementById('preset-video-file').value = '';
                        if (data.newBalance !== undefined) {
                            currentBalance = data.newBalance;
                        }
                        switchView('presets');
                    } else {
                        alert(data.message || 'Gagal memposting preset.');
                    }
                } catch(e) {
                    alert('Terjadi kesalahan jaringan.');
                } finally {
                    btn.innerText = "Posting Preset";
                    btn.disabled = false;
                }
            };
        }

        // FITUR HAPUS VIDEO PRESET
        async function handleDeletePreset(presetId) {
            if (!confirm('Apakah Anda yakin ingin menghapus video preset ini?')) return;

            try {
                const res = await fetch('/api/presets/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, presetId })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Video preset berhasil dihapus.');
                    loadPresetFeed();
                } else {
                    alert(data.message || 'Gagal menghapus preset.');
                }
            } catch(e) {
                alert('Terjadi kesalahan jaringan.');
            }
        }

        function updateWalletUI() {
            document.getElementById('creator-balance-display').innerText = 'Rp ' + currentBalance.toLocaleString('id-ID');
            const selectEl = document.getElementById('wd-amount-select');
            selectEl.innerHTML = '';
            
            if (!hasWithdrawn100) {
                selectEl.innerHTML += \`<option value="100">Rp 100 (Penarikan Kreator Baru - 1x)</option>\`;
            }
            selectEl.innerHTML += \`<option value="20000">Rp 20.000 (Minimal Tukar)</option>\`;
        }

        async function handleRequestWithdrawal() {
            const amount = parseInt(document.getElementById('wd-amount-select').value);
            const danaPhone = document.getElementById('wd-dana-phone').value.trim();
            const danaName = document.getElementById('wd-dana-name').value.trim();

            if (!danaPhone || !danaName || isNaN(amount)) {
                return alert('Nomor DANA dan Atas Nama wajib diisi!');
            }

            if (amount === 100 && hasWithdrawn100) {
                return alert('Opsi penarikan Rp 100 hanya bisa digunakan 1x dan sudah kedaluwarsa!');
            }

            if (amount === 20000 && currentBalance < 20000) {
                return alert('Saldo Anda belum mencapai Rp 20.000 untuk melakukan penarikan ini!');
            }

            try {
                const res = await fetch('/api/wallet/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, amount, danaPhone, danaName })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Pengajuan penarikan saldo berhasil dikirim ke admin dan saldo Anda telah dipotong secara otomatis!');
                    currentBalance = data.newBalance;
                    hasWithdrawn100 = data.hasWithdrawn100;
                    document.getElementById('wd-dana-phone').value = '';
                    document.getElementById('wd-dana-name').value = '';
                    updateWalletUI();
                } else {
                    alert(data.message);
                }
            } catch(e) {
                alert('Terjadi kesalahan jaringan.');
            }
        }

        async function loadAdminWithdrawals() {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/admin/withdrawals?username=' + encodeURIComponent(loggedInUsername));
                const data = await res.json();
                const container = document.getElementById('admin-withdrawals-list');
                container.innerHTML = '';

                if (data.success && Object.keys(data.withdrawals).length > 0) {
                    for (let [wid, val] of Object.entries(data.withdrawals)) {
                        let statusBadge = '';
                        if (val.status === 'pending') {
                            statusBadge = \`<span class="text-amber-400">Pending</span>\`;
                        } else if (val.status === 'approved') {
                            statusBadge = \`<span class="text-emerald-400">Diterima</span>\`;
                        } else {
                            statusBadge = \`<span class="text-rose-400">Ditolak</span>\`;
                        }

                        container.innerHTML += \`
                            <div class="bg-slate-900/80 p-2.5 rounded-xl border border-amber-500/20 space-y-1">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-amber-300 font-bold">@\${val.username}</span>
                                    <span>\${statusBadge}</span>
                                </div>
                                <p class="text-[11px] text-slate-200">Nominal: <strong class="text-emerald-400">Rp \{val.amount.toLocaleString('id-ID')}</strong></p>
                                <p class="text-[10px] text-slate-300">DANA: \${val.danaPhone} (a.n \${val.danaName})</p>
                                \${val.status === 'pending' ? \`
                                    <div class="flex gap-2 pt-1">
                                        <button onclick="handleAdminWithdrawalAction('\${wid}', 'approve')" class="flex-1 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg border border-emerald-500/30 text-[10px] font-bold">Terima</button>
                                        <button onclick="handleAdminWithdrawalAction('\${wid}', 'reject')" class="flex-1 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg border border-rose-500/30 text-[10px] font-bold">Tolak</button>
                                    </div>
                                \` : ''}
                            </div>
                        \`;
                    }
                } else {
                    container.innerHTML = '<p class="text-slate-500 italic">Tidak ada list penarikan saldo.</p>';
                }
            } catch(e) {}
        }

        async function handleAdminWithdrawalAction(wdId, action) {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/admin/withdrawal-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, wdId, action })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    loadAdminWithdrawals();
                } else {
                    alert(data.message);
                }
            } catch(e) {
                alert('Terjadi kesalahan.');
            }
        }

        async function loadPresetFeed() {
            try {
                const res = await fetch('/api/presets');
                const data = await res.json();
                const container = document.getElementById('preset-feed-container');
                container.innerHTML = '';

                if (data.success && Object.keys(data.presets).length > 0) {
                    const entries = Object.entries(data.presets).sort((a,b) => b[1].timestamp - a[1].timestamp);
                    for (let [id, val] of entries) {
                        const isLiked = val.likes && val.likes[loggedInUsername];
                        const likeCount = val.likes ? Object.keys(val.likes).length : 0;
                        
                        let commentsHtml = '';
                        if (val.comments) {
                            for (let [cid, cval] of Object.entries(val.comments)) {
                                commentsHtml += \`<div class="bg-slate-900/60 p-2 rounded-xl text-[11px] mb-1"><strong>\${cval.username}:</strong> \${cval.text}</div>\`;
                            }
                        }

                        // Cek apakah user yang login adalah creator pemilik preset ini atau admin
                        const canDelete = isAdminUser || (isCreatorUser && val.creator.toLowerCase() === loggedInUsername.toLowerCase());

                        container.innerHTML += \`
                            <div class="glass-panel space-y-3 p-4 border border-purple-500/30 relative">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="font-bold text-purple-300">@\${val.creator}</span>
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] text-slate-400">\${new Date(val.timestamp).toLocaleDateString()}</span>
                                        \${canDelete ? \`<button onclick="handleDeletePreset('\${id}')" class="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold transition">🗑️ Hapus</button>\` : ''}
                                    </div>
                                </div>
                                <p class="text-xs font-semibold text-white">\${val.title}</p>
                                
                                <div class="w-full h-48 rounded-xl overflow-hidden bg-black relative">
                                    <video src="\${val.videoUrl}" controls loop playsinline class="w-full h-full object-cover"></video>
                                </div>

                                <div class="flex items-center justify-between pt-1">
                                    <a href="\${val.link}" target="_blank" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold text-xs transition">🔗 Unduh Link Preset</a>
                                    <button onclick="handleLikePreset('\${id}')" class="px-3 py-2 rounded-full border \${isLiked ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-900 border-purple-500/30 text-slate-300'} text-xs font-bold transition">
                                        ❤️ Like (\${likeCount})
                                    </button>
                                </div>

                                <div class="border-t border-purple-500/10 pt-2 space-y-2">
                                    <p class="text-[11px] font-bold text-purple-300">Komentar:</p>
                                    <div class="max-h-24 overflow-y-auto space-y-1">\${commentsHtml || '<p class="text-[10px] text-slate-500 italic">Belum ada komentar.</p>'}</div>
                                    <div class="flex gap-2 pt-1">
                                        <input type="text" id="comment-input-\${id}" placeholder="Tulis komentar..." class="input-glow flex-1 px-3 py-2 text-xs">
                                        <button onclick="handlePostComment('\${id}')" class="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-xs font-bold">Kirim</button>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }
                } else {
                    container.innerHTML = '<p class="text-slate-500 italic text-xs">Belum ada preset yang dibagikan.</p>';
                }
            } catch(e) {}
        }

        async function handleLikePreset(presetId) {
            try {
                const res = await fetch('/api/presets/like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, presetId })
                });
                const data = await res.json();
                if (data.success) {
                    loadPresetFeed();
                }
            } catch(e) {}
        }

        async function handlePostComment(presetId) {
            const input = document.getElementById('comment-input-' + presetId);
            const text = input.value.trim();
            if (!text) return;

            try {
                const res = await fetch('/api/presets/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, presetId, text })
                });
                const data = await res.json();
                if (data.success) {
                    input.value = '';
                    loadPresetFeed();
                } else {
                    alert(data.message);
                }
            } catch(e) {}
        }

        function updateQuotaDisplay(data) {
            let quotaLimit = (data.isCreator || data.isAdmin) ? 10 : 3;
            if(data.isAdmin || data.isVip) {
                document.getElementById('quota-display').innerText = "UNLIMITED";
            } else {
                document.getElementById('quota-display').innerText = data.usedQuota + "/" + quotaLimit + " (+" + data.bonusQuota + ")";
            }
        }

        function checkVipStatus(data) {
            const banner = document.getElementById('vip-status-banner');
            const expiryText = document.getElementById('vip-expiry-text');
            if (data.isVip && !data.isAdmin) {
                banner.classList.remove('hidden');
                expiryText.innerText = "Aktif hingga: " + new Date(data.vipUntil).toLocaleString();
            } else {
                banner.classList.add('hidden');
            }
        }

        async function changeServerState(newState) {
            if (!isAdminUser) return alert('Akses ditolak!');
            try {
                const res = await fetch('/api/admin/set-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newState, username: loggedInUsername })
                });
                const data = await res.json();
                if(data.success) {
                    updateStatusUI(newState);
                    alert('Status server diubah: ' + newState.toUpperCase());
                }
            } catch(e) { alert('Gagal mengubah status server.'); }
        }

        async function handleSetVip() {
            if (!isAdminUser) return;
            const targetUser = document.getElementById('vip-target-user').value.trim();
            const days = parseInt(document.getElementById('vip-duration-days').value);
            if (!targetUser || isNaN(days)) return alert('Username dan jumlah hari wajib diisi!');

            try {
                const res = await fetch('/api/admin/set-vip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, targetUser, days })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    document.getElementById('vip-target-user').value = '';
                    document.getElementById('vip-duration-days').value = '';
                    loadAdminVipList();
                } else { alert(data.message); }
            } catch(e) { alert('Gagal mengatur status VIP.'); }
        }

        async function loadAdminVipList() {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/admin/get-vip-list?username=' + encodeURIComponent(loggedInUsername));
                const data = await res.json();
                const container = document.getElementById('admin-vip-list');
                container.innerHTML = '';

                if (data.success && Object.keys(data.vipUsers).length > 0) {
                    for (let [uname, val] of Object.entries(data.vipUsers)) {
                        container.innerHTML += \`
                            <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-xl border border-amber-500/20">
                                <div>
                                    <span class="text-amber-300 font-bold">\${uname}</span>
                                    <span class="text-slate-400 block text-[9px]">Expired: \${new Date(val.vipUntil).toLocaleDateString()}</span>
                                </div>
                                <button onclick="handleRemoveVip('\${uname}')" class="px-2 py-1 bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 rounded-lg border border-rose-500/30 text-[10px]">Hapus</button>
                            </div>
                        \`;
                    }
                } else {
                    container.innerHTML = '<p class="text-slate-500 italic">Tidak ada akun VIP aktif.</p>';
                }
            } catch(e) {}
        }

        async function handleRemoveVip(targetUser) {
            if (!confirm('Cabut status VIP untuk user ' + targetUser + '?')) return;
            try {
                const res = await fetch('/api/admin/remove-vip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, targetUser })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Status VIP berhasil dicabut.');
                    loadAdminVipList();
                }
            } catch(e) {}
        }

        async function loadUserAnnouncements() {
            try {
                const res = await fetch('/api/announcements');
                const data = await res.json();
                const container = document.getElementById('user-announcement-container');
                container.innerHTML = '';

                if (data.success && Object.keys(data.announcements).length > 0) {
                    const entries = Object.entries(data.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
                    for (let [id, val] of entries) {
                        container.innerHTML += \`
                            <div class="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                                <div class="flex justify-between items-center text-cyan-300 font-bold text-xs">
                                    <span>\${val.title}</span>
                                    <span class="text-[9px] text-slate-400 font-mono">\${new Date(val.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p class="text-slate-300 whitespace-pre-line text-[11px] leading-relaxed">\${val.content}</p>
                            </div>
                        \`;
                    }
                } else {
                    container.innerHTML = '<p class="text-slate-500 italic">Belum ada informasi terbaru.</p>';
                }
            } catch(e) {}
        }

        async function loadAdminAnnouncements() {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/announcements');
                const data = await res.json();
                const container = document.getElementById('admin-info-list');
                container.innerHTML = '';

                if (data.success && Object.keys(data.announcements).length > 0) {
                    const entries = Object.entries(data.announcements).sort((a,b) => b[1].timestamp - a[1].timestamp);
                    for (let [id, val] of entries) {
                        container.innerHTML += \`
                            <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-xl border border-amber-500/20">
                                <div class="truncate mr-2">
                                    <span class="text-amber-300 font-bold block truncate">\${val.title}</span>
                                    <span class="text-slate-400 truncate block text-[9px]">\${val.content.substring(0, 30)}...</span>
                                </div>
                                <div class="flex gap-1 shrink-0">
                                    <button onclick="editAnnouncement('\${id}', '\${encodeURIComponent(val.title)}', '\${encodeURIComponent(val.content)}')" class="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 rounded-lg border border-sky-500/30 text-[10px]">Edit</button>
                                    <button onclick="deleteAnnouncement('\${id}')" class="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg border border-rose-500/30 text-[10px]">Hapus</button>
                                </div>
                            </div>
                        \`;
                    }
                } else {
                    container.innerHTML = '<p class="text-slate-500 italic">Belum ada informasi.</p>';
                }
            } catch(e) {}
        }

        async function handleSaveAnnouncement() {
            if (!isAdminUser) return;
            const id = document.getElementById('info-edit-id').value;
            const title = document.getElementById('info-title').value.trim();
            const content = document.getElementById('info-content').value.trim();
            if (!title || !content) return alert('Judul dan isi informasi wajib diisi!');

            const endpoint = id ? '/api/admin/update-announcement' : '/api/admin/create-announcement';
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, id, title, content })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    resetInfoForm();
                    loadAdminAnnouncements();
                    loadUserAnnouncements();
                }
            } catch(e) {}
        }

        function editAnnouncement(id, encTitle, encContent) {
            document.getElementById('info-edit-id').value = id;
            document.getElementById('info-title').value = decodeURIComponent(encTitle);
            document.getElementById('info-content').value = decodeURIComponent(encContent);
            document.getElementById('info-submit-btn').innerText = "Perbarui Info";
            document.getElementById('info-cancel-btn').classList.remove('hidden');
        }

        function resetInfoForm() {
            document.getElementById('info-edit-id').value = '';
            document.getElementById('info-title').value = '';
            document.getElementById('info-content').value = '';
            document.getElementById('info-submit-btn').innerText = "Publikasikan Info";
            document.getElementById('info-cancel-btn').classList.add('hidden');
        }

        async function deleteAnnouncement(id) {
            if (!confirm('Hapus informasi ini?')) return;
            try {
                await fetch('/api/admin/delete-announcement', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, id })
                });
                loadAdminAnnouncements();
                loadUserAnnouncements();
            } catch(e) {}
        }

        async function handleCreateRedeem() {
            if (!isAdminUser) return;
            const code = document.getElementById('gen-code').value.trim().toUpperCase();
            const totalQuota = parseInt(document.getElementById('gen-total-quota').value);
            const maxClaims = parseInt(document.getElementById('gen-max-claims').value);
            if (!code || isNaN(totalQuota) || isNaN(maxClaims)) return alert('Semua field wajib diisi!');

            try {
                const res = await fetch('/api/admin/create-redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, code, totalQuota, maxClaims })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    document.getElementById('gen-code').value = '';
                    document.getElementById('gen-total-quota').value = '';
                    document.getElementById('gen-max-claims').value = '';
                    loadAdminRedeems();
                } else { alert(data.message); }
            } catch(e) {}
        }

        async function loadAdminRedeems() {
            if (!isAdminUser) return;
            try {
                const res = await fetch('/api/admin/get-redeems?username=' + encodeURIComponent(loggedInUsername));
                const data = await res.json();
                const listContainer = document.getElementById('admin-redeem-list');
                listContainer.innerHTML = '';

                if(data.success && Object.keys(data.redeems).length > 0) {
                    for(let [code, val] of Object.entries(data.redeems)) {
                        listContainer.innerHTML += \`
                            <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-xl border border-amber-500/20">
                                <div>
                                    <span class="text-amber-300 font-bold">\${code}</span>
                                    <span class="text-slate-400 block text-[9px]">Kuota: \${val.totalQuota} | Klaim: \${val.claimedCount}/\${val.maxClaims}</span>
                                </div>
                                <button onclick="handleDeleteRedeem('\${code}')" class="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg border border-rose-500/30 text-[10px]">Hapus</button>
                            </div>
                        \`;
                    }
                } else {
                    listContainer.innerHTML = '<p class="text-slate-500 italic">Belum ada kode aktif.</p>';
                }
            } catch(e) {}
        }

        async function handleDeleteRedeem(code) {
            if(!confirm('Hapus kode redeem ' + code + '?')) return;
            try {
                await fetch('/api/admin/delete-redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, code })
                });
                loadAdminRedeems();
            } catch(e) {}
        }

        async function handleRedeemCode() {
            const code = document.getElementById('redeem-code-input').value.trim().toUpperCase();
            if (!code) return alert('Masukkan kode redeem!');

            try {
                const res = await fetch('/api/redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, code })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    document.getElementById('redeem-code-input').value = '';
                    updateQuotaDisplay(data);
                } else { alert(data.message); }
            } catch(e) {}
        }

        async function handleSendEmail() {
            const email = document.getElementById('target-email').value.trim();
            const sendText = document.getElementById('send-text');
            const sendIcon = document.getElementById('send-icon');
            const resultBox = document.getElementById('result-box');
            const resultText = document.getElementById('result-text');

            if (!email) return alert('Harap masukkan email target!');

            sendText.innerText = "Mengirim...";
            sendIcon.innerText = "⏳";
            resultBox.classList.remove('hidden');
            resultText.innerText = "⏳ Pending...";

            try {
                const res = await fetch('/api/magiclink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, email })
                });
                const data = await res.json();

                if(data.success) {
                    sendText.innerText = "KIRIM";
                    sendIcon.innerText = "🚀";
                    resultText.innerText = JSON.stringify(data.result, null, 2);
                    if(!isAdminUser && data.quotaInfo) {
                        updateQuotaDisplay(data.quotaInfo);
                    }
                } else {
                    sendText.innerText = "Gagal";
                    sendIcon.innerText = "✕";
                    resultText.innerText = "Error: " + data.message;
                    alert(data.message);
                }
            } catch (err) {
                sendText.innerText = "Gagal";
                sendIcon.innerText = "✕";
                resultText.innerText = "Error: " + err.message;
            }
        }

        async function handleActivate() {
            const email = document.getElementById('target-email').value;
            const magicUrl = document.getElementById('magic-url').value;
            const resultBox = document.getElementById('result-box');
            const resultText = document.getElementById('result-text');

            if (!email || !magicUrl) return alert('Email dan URL wajib diisi!');

            resultBox.classList.remove('hidden');
            resultText.innerText = "Memverifikasi token aktivasi...";

            try {
                const res = await fetch('/api/verif', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, url: magicUrl, username: loggedInUsername })
                });
                const data = await res.json();
                resultText.innerText = JSON.stringify(data, null, 2);
            } catch (err) {
                resultText.innerText = "Error: " + err.message;
            }
        }

        function handleLogout() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('savedUsername');
            sessionStorage.clear();
            window.location.reload();
        }
    </script>
</body>
</html>
`;

// ==========================================
// SERVER HTTP LOCALHOST
// ==========================================
const PORT = 3001;

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlTemplate);
  } else if (parsedUrl.pathname === '/api/status') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: serverStatus }));
  } else if (parsedUrl.pathname === '/api/video') {
    res.setHeader('Content-Type', 'application/json');
    const videoUrl = await getVideoFromDb();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, videoUrl }));
  } else if (parsedUrl.pathname === '/api/announcements') {
    res.setHeader('Content-Type', 'application/json');
    const announcements = await getAllAnnouncementsFromDb();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, announcements }));
  } else if (parsedUrl.pathname === '/api/presets' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const presets = await getAllPresetsFromDb();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, presets }));
  } else if (parsedUrl.pathname === '/api/user/register-creator' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'User tidak ditemukan.' }));
          return;
        }
        userObj.creatorStatus = 'pending';
        await saveUserToDb(username.toLowerCase(), userObj);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Berhasil mengajukan pendaftaran creator. Menunggu konfirmasi admin.' }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan server.' }));
      }
    });
  } else if (parsedUrl.pathname === '/api/admin/creator-requests' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const username = parsedUrl.searchParams.get('username');
    const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
    if (!userObj || !userObj.isAdmin) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false }));
      return;
    }
    const allUsers = await getAllUsersFromDb();
    const requests = {};
    for (let [uname, udata] of Object.entries(allUsers)) {
      if (udata.creatorStatus === 'pending') {
        requests[uname] = udata;
      }
    }
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, requests }));
  } else if (parsedUrl.pathname === '/api/admin/creator-action' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, targetUser, actionType } = JSON.parse(body);
        const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!adminObj || !adminObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak.' }));
          return;
        }

        const targetObj = await getUserFromDb(targetUser.toLowerCase());
        if (!targetObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'User target tidak ditemukan.' }));
          return;
        }

        if (actionType === 'approve') {
          targetObj.isCreator = true;
          targetObj.creatorStatus = 'approved';
          if (targetObj.balance === undefined) targetObj.balance = 0;
          if (targetObj.hasWithdrawn100 === undefined) targetObj.hasWithdrawn100 = false;
        } else {
          targetObj.isCreator = false;
          targetObj.creatorStatus = 'rejected';
        }

        await saveUserToDb(targetUser.toLowerCase(), targetObj);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: `Berhasil ${actionType === 'approve' ? 'menerima' : 'menolak'} creator @${targetUser}!` }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/presets/upload' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, title, link, videoUrl } = JSON.parse(body);
        const cleanUser = username ? username.toLowerCase() : '';
        const userObj = cleanUser ? await getUserFromDb(cleanUser) : null;
        if (!userObj || (!userObj.isCreator && !userObj.isAdmin)) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak! Hanya creator yang dapat memposting preset.' }));
          return;
        }

        const presetId = 'preset_' + Date.now();
        const presetData = {
          creator: cleanUser,
          title,
          link,
          videoUrl,
          timestamp: Date.now(),
          likes: {},
          comments: {}
        };
        await savePresetToDb(presetId, presetData);

        if (userObj.balance === undefined) userObj.balance = 0;
        userObj.balance += 50;
        await saveUserToDb(cleanUser, userObj);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Preset berhasil diposting.', newBalance: userObj.balance }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan server.' }));
      }
    });
  } else if (parsedUrl.pathname === '/api/presets/delete' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, presetId } = JSON.parse(body);
        const cleanUser = username ? username.toLowerCase() : '';
        const userObj = cleanUser ? await getUserFromDb(cleanUser) : null;

        if (!userObj || (!userObj.isCreator && !userObj.isAdmin)) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak! Hanya creator.' }));
          return;
        }

        const presetObj = await getPresetFromDb(presetId);
        if (!presetObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'Preset tidak ditemukan.' }));
          return;
        }

        // Cek apakah preset milik user tersebut atau user adalah admin
        if (!userObj.isAdmin && presetObj.creator.toLowerCase() !== cleanUser) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Anda hanya dapat menghapus preset milik Anda sendiri.' }));
          return;
        }

        await removePresetFromDb(presetId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Preset berhasil dihapus.' }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan server.' }));
      }
    });
  } else if (parsedUrl.pathname === '/api/wallet/withdraw' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, amount, danaPhone, danaName } = JSON.parse(body);
        const cleanUser = username ? username.toLowerCase() : '';
        const userObj = cleanUser ? await getUserFromDb(cleanUser) : null;

        if (!userObj || (!userObj.isCreator && !userObj.isAdmin)) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Hanya creator yang dapat menarik saldo.' }));
          return;
        }

        if (amount === 100) {
          if (userObj.hasWithdrawn100) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Pilihan Rp 100 sudah pernah digunakan dan otomatis hilang.' }));
            return;
          }
          userObj.hasWithdrawn100 = true;
          if ((userObj.balance || 0) < 100) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Saldo Anda tidak mencukupi untuk penarikan ini.' }));
            return;
          }
          userObj.balance -= 100;
        } else if (amount === 20000) {
          if ((userObj.balance || 0) < 20000) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Saldo belum mencapai minimal Rp 20.000.' }));
            return;
          }
          userObj.balance -= 20000;
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Nominal penarikan tidak valid.' }));
          return;
        }

        await saveUserToDb(cleanUser, userObj);

        const wdId = 'wd_' + Date.now();
        const wdData = {
          username: cleanUser,
          amount,
          danaPhone,
          danaName,
          status: 'pending',
          timestamp: Date.now()
        };
        await saveWithdrawalToDb(wdId, wdData);

        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          newBalance: userObj.balance || 0, 
          hasWithdrawn100: userObj.hasWithdrawn100 
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan.' }));
      }
    });
  } else if (parsedUrl.pathname === '/api/admin/withdrawals' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const username = parsedUrl.searchParams.get('username');
    const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
    if (!userObj || !userObj.isAdmin) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false }));
      return;
    }
    const withdrawals = await getAllWithdrawalsFromDb();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, withdrawals }));
  } else if (parsedUrl.pathname === '/api/admin/withdrawal-action' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, wdId, action } = JSON.parse(body);
        const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!adminObj || !adminObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak.' }));
          return;
        }

        const wdObj = await getWithdrawalFromDb(wdId);
        if (!wdObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'Data penarikan tidak ditemukan.' }));
          return;
        }

        if (action === 'approve') {
          wdObj.status = 'approved';
        } else {
          wdObj.status = 'rejected';
          const targetUserObj = await getUserFromDb(wdObj.username);
          if (targetUserObj) {
            targetUserObj.balance = (targetUserObj.balance || 0) + wdObj.amount;
            await saveUserToDb(wdObj.username, targetUserObj);
          }
        }

        await saveWithdrawalToDb(wdId, wdObj);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: `Berhasil ${action === 'approve' ? 'menerima' : 'menolak'} penarikan!` }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/presets/like' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, presetId } = JSON.parse(body);
        if (!username || !presetId) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false }));
          return;
        }
        const cleanUser = username.toLowerCase();
        const presetObj = await getPresetFromDb(presetId);
        if (!presetObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false }));
          return;
        }

        if (!presetObj.likes) presetObj.likes = {};
        if (presetObj.likes[cleanUser]) {
          delete presetObj.likes[cleanUser];
        } else {
          presetObj.likes[cleanUser] = true;
        }

        await savePresetToDb(presetId, presetObj);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/presets/comment' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, presetId, text } = JSON.parse(body);
        if (!username || !presetId || !text) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Data tidak lengkap.' }));
          return;
        }
        const presetObj = await getPresetFromDb(presetId);
        if (!presetObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'Preset tidak ditemukan.' }));
          return;
        }

        if (!presetObj.comments) presetObj.comments = {};
        const commentId = 'comm_' + Date.now();
        presetObj.comments[commentId] = {
          username: username.toLowerCase(),
          text,
          timestamp: Date.now()
        };

        await savePresetToDb(presetId, presetObj);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/user/username' && req.method === 'PUT') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { currentUsername, newUsername } = JSON.parse(body);
        const cleanOld = currentUsername.toLowerCase();
        const cleanNew = newUsername.trim().toLowerCase();

        const existingUser = await getUserFromDb(cleanNew);
        if (existingUser) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Username sudah digunakan.' }));
          return;
        }

        const userData = await getUserFromDb(cleanOld);
        await saveUserToDb(cleanNew, userData);
        await set(ref(db, `users/${cleanOld}`), null);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, newUsername: cleanNew }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/admin/set-status' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { status, username } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }
        serverStatus = status;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/admin/set-video' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, videoUrl } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak.' }));
          return;
        }
        await saveVideoToDb(videoUrl);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/auth' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { mode, username, password, email, deviceToken } = JSON.parse(body);
        const cleanUname = username ? username.trim().toLowerCase() : '';

        if (!cleanUname || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Username dan password wajib diisi.' }));
          return;
        }

        let userObj = await getUserFromDb(cleanUname);

        if (mode === 'register') {
          if (userObj) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Username sudah digunakan.' }));
            return;
          }
          const generatedDeviceToken = 'dev_' + Math.random().toString(36).substring(2) + Date.now();
          userObj = {
            password,
            isAdmin: false,
            isCreator: false,
            creatorStatus: 'none',
            activatedEmails: [],
            bonusQuota: 0,
            usedQuota: 0,
            lastResetTime: Date.now(),
            vipUntil: 0,
            balance: 0,
            hasWithdrawn100: false,
            deviceToken: generatedDeviceToken
          };
          await saveUserToDb(cleanUname, userObj);

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'Registrasi berhasil!',
            username: cleanUname,
            isAdmin: false,
            isCreator: false,
            creatorStatus: 'none',
            usedQuota: 0,
            bonusQuota: 0,
            balance: 0,
            hasWithdrawn100: false,
            serverStatus,
            token: 'token_' + cleanUname + '_' + Date.now(),
            deviceToken: generatedDeviceToken
          }));
        } else {
          if (!userObj || userObj.password !== password) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Username atau password salah.' }));
            return;
          }

          let now = Date.now();
          if (now - userObj.lastResetTime > 24 * 60 * 60 * 1000) {
            userObj.usedQuota = 0;
            userObj.lastResetTime = now;
            await saveUserToDb(cleanUname, userObj);
          }

          const isVip = userObj.vipUntil && userObj.vipUntil > now;

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'Login berhasil!',
            username: cleanUname,
            isAdmin: userObj.isAdmin || false,
            isCreator: userObj.isCreator || false,
            creatorStatus: userObj.creatorStatus || 'none',
            usedQuota: userObj.usedQuota || 0,
            bonusQuota: userObj.bonusQuota || 0,
            balance: userObj.balance || 0,
            hasWithdrawn100: userObj.hasWithdrawn100 || false,
            isVip,
            vipUntil: userObj.vipUntil || 0,
            serverStatus,
            token: 'token_' + cleanUname + '_' + Date.now()
          }));
        }
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan server.' }));
      }
    });
  } else if (parsedUrl.pathname === '/api/auth/session' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username } = JSON.parse(body);
        const cleanUname = username ? username.trim().toLowerCase() : '';
        const userObj = await getUserFromDb(cleanUname);

        if (!userObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false }));
          return;
        }

        let now = Date.now();
        if (now - userObj.lastResetTime > 24 * 60 * 60 * 1000) {
          userObj.usedQuota = 0;
          userObj.lastResetTime = now;
          await saveUserToDb(cleanUname, userObj);
        }

        const isVip = userObj.vipUntil && userObj.vipUntil > now;

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          username: cleanUname,
          isAdmin: userObj.isAdmin || false,
          isCreator: userObj.isCreator || false,
          creatorStatus: userObj.creatorStatus || 'none',
          usedQuota: userObj.usedQuota || 0,
          bonusQuota: userObj.bonusQuota || 0,
          balance: userObj.balance || 0,
          hasWithdrawn100: userObj.hasWithdrawn100 || false,
          isVip,
          vipUntil: userObj.vipUntil || 0,
          serverStatus
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false }));
      }
    });
  } else if (parsedUrl.pathname === '/api/magiclink' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, email } = JSON.parse(body);
        const cleanUname = username ? username.toLowerCase() : '';
        const userObj = cleanUname ? await getUserFromDb(cleanUname) : null;

        if (!userObj) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'User session tidak valid.' }));
          return;
        }

        let now = Date.now();
        if (now - userObj.lastResetTime > 24 * 60 * 60 * 1000) {
          userObj.usedQuota = 0;
          userObj.lastResetTime = now;
        }

        const isVip = userObj.vipUntil && userObj.vipUntil > now;
        let quotaLimit = (userObj.isCreator || userObj.isAdmin) ? 10 : 3;

        if (!userObj.isAdmin && !isVip) {
          let maxAllowed = quotaLimit + (userObj.bonusQuota || 0);
          if (userObj.usedQuota >= maxAllowed) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Kuota aktivasi Anda habis hari ini.' }));
            return;
          }
        }

        const result = await am.magiclink(email);

        if (!userObj.isAdmin && !isVip) {
          userObj.usedQuota = (userObj.usedQuota || 0) + 1;
          await saveUserToDb(cleanUname, userObj);
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          result,
          quotaInfo: {
            usedQuota: userObj.usedQuota,
            bonusQuota: userObj.bonusQuota || 0,
            isCreator: userObj.isCreator
          }
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
  } else if (parsedUrl.pathname === '/api/verif' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { email, url } = JSON.parse(body);
        const result = await am.verif(email, url);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
  } else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, code } = JSON.parse(body);
        const cleanUname = username ? username.toLowerCase() : '';
        const userObj = cleanUname ? await getUserFromDb(cleanUname) : null;
        const redeemObj = await getRedeemFromDb(code);

        if (!userObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'User tidak ditemukan.' }));
          return;
        }

        if (!redeemObj) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'Kode redeem tidak valid.' }));
          return;
        }

        if (redeemObj.claimedBy && redeemObj.claimedBy[cleanUname]) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Anda sudah pernah mengklaim kode ini.' }));
          return;
        }

        if (redeemObj.claimedCount >= redeemObj.maxClaims) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Kode redeem sudah habis.' }));
          return;
        }

        if (!redeemObj.claimedBy) redeemObj.claimedBy = {};
        redeemObj.claimedBy[cleanUname] = true;
        redeemObj.claimedCount = (redeemObj.claimedCount || 0) + 1;
        await saveRedeemToDb(code, redeemObj);

        userObj.bonusQuota = (userObj.bonusQuota || 0) + redeemObj.totalQuota;
        await saveUserToDb(cleanUname, userObj);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Berhasil klaim! Mendapatkan tambahan kuota ${redeemObj.totalQuota}.`,
          usedQuota: userObj.usedQuota || 0,
          bonusQuota: userObj.bonusQuota || 0
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan.' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});