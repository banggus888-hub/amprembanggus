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
  return 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-lights-31910-large.mp4'; // Default video
}

async function saveVideoToDb(videoUrl) {
  await set(ref(db, `settings/featuredVideo`), videoUrl);
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
}
initAdmin();

// ==========================================
// KODE HTML UI MODERN & FITUR UBAH VIDEO
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
            <!-- Tombol Menu Modern -->
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
                        <h3 class="text-sm font-black uppercase tracking-widest text-purple-400">Navigasi Fokus</h3>
                    </div>
                    <button onclick="toggleMenu()" class="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/30 flex items-center justify-center text-slate-300 hover:text-white text-base">✕</button>
                </div>

                <nav class="space-y-3 text-sm font-semibold">
                    <button onclick="switchView('generator')" class="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-slate-300 transition text-left">
                        Generator Utama
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
                
                <!-- BANNER VIDEO UTAMA (BISA DIUBAH ADMIN) -->
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
                            <p class="text-xs font-bold text-slate-200">Activation Quota</p>
                            <p class="text-[10px] text-slate-400">Reset otomatis 24 Jam</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 text-purple-300 text-xs font-extrabold bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20 mono">
                        <span id="quota-display">0/3</span>
                    </div>
                </div>

                <!-- FORM GENERATOR UTAMA -->
                <div class="glass-panel space-y-3.5">
                    
                    <!-- Kirim ke Alight Motion -->
                    <div class="space-y-1.5">
                        <label class="text-xs font-bold text-purple-300 flex items-center gap-2 pl-1">
                            <span>✉️</span> Kirim ke Alight Motion
                        </label>
                        <input type="email" id="target-email" placeholder="contoh@gmail.com" class="input-glow w-full text-slate-200">
                    </div>

                    <button id="btn-send" onclick="handleSendEmail()" class="cyber-btn w-full text-white font-extrabold flex items-center justify-center gap-2">
                        <span id="send-icon">🚀</span> <span id="send-text">Kirim</span>
                    </button>

                    <!-- Verify Section -->
                    <div class="space-y-3 pt-2">
                        <label class="text-xs font-bold text-emerald-400 flex items-center gap-2 pl-1">
                            <span>✅</span> Verifikasi
                        </label>
                        
                        <input type="text" id="magic-url" placeholder="https://alight-creative.firebaseapp.com/_..." class="input-glow w-full text-emerald-300 font-medium text-xs placeholder:text-slate-600">
                    </div>

                    <button onclick="handleActivate()" class="cyber-btn-green w-full text-slate-950 font-extrabold flex items-center justify-center gap-2">
                        <span>✓</span> Verify
                    </button>
                </div>

                <div id="result-box" class="input-glow p-3 text-xs hidden text-purple-300 break-all bg-purple-950/20 border-purple-500/30 mono rounded-2xl">
                    <p id="result-text"></p>
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

                    <!-- FITUR UBAH VIDEO KHUSUS ADMIN -->
                    <div class="border-t border-amber-500/20 pt-3 space-y-2">
                        <p class="text-[11px] text-amber-300 font-bold">Ubah Video Tampilan Utama (Upload File):</p>
                        <input type="file" id="admin-video-file" accept="video/*" class="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer">
                        <button onclick="handleUploadVideo()" id="btn-upload-video" class="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-full text-xs transition">Upload & Perbarui Video</button>
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

                <!-- ADMIN KELOLA INFORMASI -->
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

            if (viewName === 'generator') {
                document.getElementById('terminal-view').classList.remove('hidden');
            } else if (viewName === 'profile') {
                document.getElementById('section-profile').classList.remove('hidden');
            } else if (viewName === 'guide') {
                document.getElementById('section-guide').classList.remove('hidden');
            } else if (viewName === 'announcement') {
                document.getElementById('section-announcement').classList.remove('hidden');
                loadUserAnnouncements();
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
                    loggedInUsername = data.username;
                    isAdminUser = data.isAdmin;

                    document.getElementById('auth-view').classList.add('hidden');
                    document.getElementById('terminal-view').classList.remove('hidden');
                    
                    document.getElementById('header-menu-btn').classList.remove('hidden');
                    document.getElementById('logged-username').innerText = data.username;
                    
                    document.getElementById('profile-uname').innerText = data.username;
                    document.getElementById('profile-role').innerText = data.isAdmin ? 'Admin Master' : (data.isVip ? 'VIP Member' : 'Standard User');
                    document.getElementById('profile-quota').innerText = data.isAdmin || data.isVip ? 'Unlimited' : (3 + (data.bonusQuota || 0) - data.usedQuota);

                    document.getElementById('drawer-status-role').innerText = data.username + ' (' + (data.isAdmin ? 'Admin' : 'User') + ')';
                    document.getElementById('drawer-logout-btn').classList.remove('hidden');

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
                    }
                } else {
                    alert('Gagal: ' + data.message);
                }
            } catch (err) {
                alert('Terjadi kesalahan koneksi server.');
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
                    loggedInUsername = data.username;
                    isAdminUser = data.isAdmin;

                    document.getElementById('auth-view').classList.add('hidden');
                    document.getElementById('terminal-view').classList.remove('hidden');
                    
                    document.getElementById('header-menu-btn').classList.remove('hidden');
                    document.getElementById('logged-username').innerText = data.username;
                    
                    document.getElementById('profile-uname').innerText = data.username;
                    document.getElementById('profile-role').innerText = data.isAdmin ? 'Admin Master' : (data.isVip ? 'VIP Member' : 'Standard User');
                    document.getElementById('profile-quota').innerText = data.isAdmin || data.isVip ? 'Unlimited' : (3 + (data.bonusQuota || 0) - data.usedQuota);

                    document.getElementById('drawer-status-role').innerText = data.username + ' (' + (data.isAdmin ? 'Admin' : 'User') + ')';
                    document.getElementById('drawer-logout-btn').classList.remove('hidden');

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
                    }
                }
            } catch (e) {}
        }
        checkSavedSession();

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
                console.error('Terjadi kesalahan:', error);
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
                    alert('Terjadi kesalahan koneksi saat mengunggah video.');
                } finally {
                    uploadBtn.innerText = "Upload & Perbarui Video";
                    uploadBtn.disabled = false;
                }
            };
            reader.onerror = function() {
                alert('Gagal membaca file.');
                uploadBtn.innerText = "Upload & Perbarui Video";
                uploadBtn.disabled = false;
            };
        }

        function updateQuotaDisplay(data) {
            if(data.isAdmin || data.isVip) {
                document.getElementById('quota-display').innerText = "UNLIMITED";
            } else {
                document.getElementById('quota-display').innerText = data.usedQuota + "/3 (+" + data.bonusQuota + ")";
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
            } catch(e) { alert('Gagal mencabut VIP.'); }
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
                } else { alert(data.message); }
            } catch(e) { alert('Gagal menyimpan informasi.'); }
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
                const res = await fetch('/api/admin/delete-announcement', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, id })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Informasi berhasil dihapus.');
                    loadAdminAnnouncements();
                    loadUserAnnouncements();
                }
            } catch(e) { alert('Gagal menghapus informasi.'); }
        }

        async function handleCreateRedeem() {
            if (!isAdminUser) return;
            const code = document.getElementById('gen-code').value.trim().toUpperCase();
            const totalQuota = parseInt(document.getElementById('gen-total-quota').value);
            const maxClaims = parseInt(document.getElementById('gen-max-claims').value);

            if (!code || isNaN(totalQuota) || isNaN(maxClaims)) return alert('Semua field redeem wajib diisi!');

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
            } catch(e) { alert('Gagal membuat kode.'); }
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
                const res = await fetch('/api/admin/delete-redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, code })
                });
                const data = await res.json();
                if(data.success) {
                    alert('Kode berhasil dihapus.');
                    loadAdminRedeems();
                }
            } catch(e) { alert('Gagal menghapus kode.'); }
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
            } catch(e) { alert('Gagal memproses redeem.'); }
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
            resultText.innerText = "Mengirim request ...";

            try {
                const res = await fetch('/api/magiclink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, email })
                });
                const data = await res.json();

                if(data.success) {
                    sendText.innerText = "Send";
                    sendIcon.innerText = "📤";
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
  const queryUsername = parsedUrl.searchParams.get('username');

  let isRequesterAdmin = false;
  if (queryUsername) {
    const userDoc = await getUserFromDb(queryUsername.toLowerCase());
    if (userDoc && userDoc.isAdmin) isRequesterAdmin = true;
  }

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
  } else if (parsedUrl.pathname === '/api/user/username' && req.method === 'PUT') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { currentUsername, newUsername } = JSON.parse(body);
        if (!currentUsername || !newUsername) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Username lama dan baru diperlukan.' }));
          return;
        }

        const cleanOld = currentUsername.toLowerCase();
        const cleanNew = newUsername.trim().toLowerCase();

        const existingUser = await getUserFromDb(cleanNew);
        if (existingUser) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Username sudah digunakan oleh akun lain.' }));
          return;
        }

        const userData = await getUserFromDb(cleanOld);
        if (!userData) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'User tidak ditemukan.' }));
          return;
        }

        await saveUserToDb(cleanNew, userData);
        await set(ref(db, `users/${cleanOld}`), null);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, newUsername: cleanNew }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Terjadi kesalahan pada server.' }));
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
        res.end(JSON.stringify({ success: true, status: serverStatus }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
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
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak! Hanya admin.' }));
          return;
        }
        if (!videoUrl) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Data video kosong.' }));
          return;
        }

        await saveVideoToDb(videoUrl);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Video berhasil diperbarui.' }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Kesalahan server saat menyimpan video.' }));
      }
    });
  } else if (parsedUrl.pathname === '/api/admin/set-vip' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, targetUser, days } = JSON.parse(body);
        const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!adminObj || !adminObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Akses ditolak.' }));
          return;
        }

        const cleanTarget = targetUser.toLowerCase();
        const targetObj = await getUserFromDb(cleanTarget);
        if (!targetObj) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'User target tidak ditemukan!' }));
          return;
        }

        const vipExpiry = Date.now() + (days * 24 * 60 * 60 * 1000);
        targetObj.vipUntil = vipExpiry;
        await saveUserToDb(cleanTarget, targetObj);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: `Sukses memberikan VIP ke ${cleanTarget} selama ${days} hari!` }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/admin/get-vip-list') {
    res.setHeader('Content-Type', 'application/json');
    const username = parsedUrl.searchParams.get('username');
    const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
    if (!userObj || !userObj.isAdmin) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false }));
      return;
    }

    const allUsers = await getAllUsersFromDb();
    const vipUsers = {};
    const now = Date.now();

    for (let [uname, udata] of Object.entries(allUsers)) {
      if (udata.vipUntil && udata.vipUntil > now) {
        vipUsers[uname] = { vipUntil: udata.vipUntil };
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, vipUsers }));
  } else if (parsedUrl.pathname === '/api/admin/remove-vip' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, targetUser } = JSON.parse(body);
        const adminObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!adminObj || !adminObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }

        const cleanTarget = targetUser.toLowerCase();
        const targetObj = await getUserFromDb(cleanTarget);
        if (targetObj) {
          targetObj.vipUntil = 0;
          await saveUserToDb(cleanTarget, targetObj);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/admin/create-announcement' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, title, content } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }

        const id = 'info_' + Date.now();
        await saveAnnouncementToDb(id, { title, content, timestamp: Date.now() });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Informasi berhasil dipublikasikan!' }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/admin/update-announcement' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, id, title, content } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }

        await saveAnnouncementToDb(id, { title, content, timestamp: Date.now() });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Informasi diperbarui!' }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/admin/delete-announcement' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, id } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }
        await removeAnnouncementFromDb(id);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/admin/create-redeem' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, code, totalQuota, maxClaims } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }

        const existingCode = await getRedeemFromDb(code);
        if (existingCode) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Kode redeem sudah ada!' }));
          return;
        }

        const redeemData = {
          totalQuota: totalQuota,
          maxClaims: maxClaims,
          claimedCount: 0,
          claimedUsers: []
        };
        await saveRedeemToDb(code, redeemData);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: `Kode ${code} berhasil dibuat!` }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/admin/get-redeems') {
    res.setHeader('Content-Type', 'application/json');
    const username = parsedUrl.searchParams.get('username');
    const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
    if (!userObj || !userObj.isAdmin) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false }));
      return;
    }
    const redeems = await getAllRedeemsFromDb();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, redeems }));
  } else if (parsedUrl.pathname === '/api/admin/delete-redeem' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, code } = JSON.parse(body);
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (!userObj || !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false }));
          return;
        }
        await removeRedeemFromDb(code);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body);
        const { username } = parsedBody;
        const userObj = username ? await getUserFromDb(username.toLowerCase()) : null;

        if (serverStatus !== 'online' && (!userObj || !userObj.isAdmin)) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Pembuatan gagal: Server sedang offline. Fitur premium dinonaktifkan untuk user biasa & VIP.' }));
          return;
        }

        const { code } = parsedBody;
        const cleanUser = username.toLowerCase();
        const redeemObj = await getRedeemFromDb(code);

        if (!userObj || !redeemObj) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'User atau Kode Redeem tidak valid!' }));
          return;
        }

        if (redeemObj.claimedUsers && redeemObj.claimedUsers.includes(cleanUser)) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Anda sudah pernah klaim kode ini!' }));
          return;
        }

        if (redeemObj.claimedCount >= redeemObj.maxClaims) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Kuota kode redeem sudah habis terpakai!' }));
          return;
        }

        const remainingClaims = redeemObj.maxClaims - redeemObj.claimedCount;
        const remainingTotalQuota = redeemObj.totalQuota - (redeemObj.distributedQuota || 0);
        let rewardQuota = Math.round(remainingTotalQuota / remainingClaims);
        if (rewardQuota < 1) rewardQuota = 1;

        if (!userObj.bonusQuota) userObj.bonusQuota = 0;
        userObj.bonusQuota += rewardQuota;

        redeemObj.claimedCount += 1;
        if (!redeemObj.distributedQuota) redeemObj.distributedQuota = 0;
        redeemObj.distributedQuota += rewardQuota;
        if (!redeemObj.claimedUsers) redeemObj.claimedUsers = [];
        redeemObj.claimedUsers.push(cleanUser);

        await saveUserToDb(cleanUser, userObj);
        await saveRedeemToDb(code, redeemObj);

        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          message: `Berhasil klaim! Anda mendapatkan bonus ${rewardQuota} kuota.`,
          usedQuota: userObj.activatedEmails ? userObj.activatedEmails.length : 0,
          bonusQuota: userObj.bonusQuota
        }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/auth/session' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, token } = JSON.parse(body);
        if (!username || !token) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false }));
          return;
        }
        const cleanUser = username.toLowerCase();
        const existingUser = await getUserFromDb(cleanUser);
        if (!existingUser) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false }));
          return;
        }

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

        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          username: cleanUser, 
          isAdmin: existingUser.isAdmin, 
          usedQuota: usedCount,
          bonusQuota: existingUser.bonusQuota || 0,
          isVip: isVipActive,
          vipUntil: existingUser.vipUntil || 0,
          serverStatus
        }));
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
        const cleanUser = username.trim().toLowerCase();
        let existingUser = await getUserFromDb(cleanUser);

        if (mode === 'register') {
          if (cleanUser === 'adminbagus' || existingUser) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'Username tidak tersedia atau sudah terdaftar!' }));
            return;
          }

          const newDeviceToken = deviceToken || ('dev_' + Math.random().toString(36).substring(2) + Date.now());
          const newUserData = { 
            password, 
            email, 
            isAdmin: false, 
            activatedEmails: [], 
            bonusQuota: 0, 
            lastResetTime: Date.now(),
            vipUntil: 0,
            deviceToken: newDeviceToken
          };
          await saveUserToDb(cleanUser, newUserData);
          
          const fakeAuthToken = 'token_' + Math.random().toString(36).substring(2) + Date.now();

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Registrasi berhasil!', 
            username: cleanUser, 
            isAdmin: false, 
            usedQuota: 0, 
            bonusQuota: 0,
            isVip: false,
            serverStatus,
            deviceToken: newDeviceToken,
            token: fakeAuthToken
          }));
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

            res.writeHead(200);
            res.end(JSON.stringify({ 
              success: true, 
              message: 'Login berhasil!', 
              username: cleanUser, 
              isAdmin: existingUser.isAdmin, 
              usedQuota: usedCount,
              bonusQuota: existingUser.bonusQuota || 0,
              isVip: isVipActive,
              vipUntil: existingUser.vipUntil || 0,
              serverStatus,
              token: fakeAuthToken
            }));
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ success: false, message: 'Username atau password salah!' }));
          }
        }
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
    });
  } else if (parsedUrl.pathname === '/api/magiclink' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, email } = JSON.parse(body);
        const cleanUser = username ? username.toLowerCase() : '';
        const userObj = await getUserFromDb(cleanUser);

        if (!userObj) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'User tidak ditemukan.' }));
          return;
        }

        if (serverStatus !== 'online' && !userObj.isAdmin) {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Pembuatan gagal: Server sedang offline. Fitur premium dinonaktifkan untuk user biasa & VIP.' }));
          return;
        }

        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (now - (userObj.lastResetTime || now) >= twentyFourHours) {
          userObj.activatedEmails = [];
          userObj.lastResetTime = now;
        }

        if (!userObj.activatedEmails) userObj.activatedEmails = [];
        if (!userObj.bonusQuota) userObj.bonusQuota = 0;

        const isVipActive = userObj.vipUntil && userObj.vipUntil > now;
        const maxAllowed = 3 + userObj.bonusQuota;

        if (!userObj.isAdmin && !isVipActive) {
          if (!userObj.activatedEmails.includes(email) && userObj.activatedEmails.length >= maxAllowed) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Kuota aktivasi Anda habis! Gunakan kode redeem atau upgrade VIP.' }));
            return;
          }
        }

        const result = await am.magiclink(email);

        if (!userObj.isAdmin && !isVipActive && !userObj.activatedEmails.includes(email)) {
          userObj.activatedEmails.push(email);
          await saveUserToDb(cleanUser, userObj);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          result, 
          quotaInfo: { usedQuota: userObj.activatedEmails.length, bonusQuota: userObj.bonusQuota } 
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
  } else if (parsedUrl.pathname === '/api/verif' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { email, url: verifyUrl, username } = JSON.parse(body);

        let userObj = username ? await getUserFromDb(username.toLowerCase()) : null;
        if (serverStatus !== 'online' && (!userObj || !userObj.isAdmin)) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: 'Pembuatan gagal: Server sedang offline. Fitur premium dinonaktifkan untuk user biasa & VIP.' }));
          return;
        }

        if (!email || !verifyUrl) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Parameter email dan url diperlukan.' }));
          return;
        }

        const result = await am.verif(email, verifyUrl);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Endpoint tidak ditemukan.');
  }
});

server.listen(PORT, () => {
  console.log(`Server web AM Premium berjalan di: http://localhost:${PORT}`);
});