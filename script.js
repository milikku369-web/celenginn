// FIREBASE CONFIGURATION & INITIALIZATION
const firebaseConfig = {
    apiKey: "AIzaSyDVFoMedduyW951hA1a9FOpt4whm0NIFI",
    authDomain: "tabungin-app-74a2f.firebaseapp.com",
    projectId: "tabungin-app-74a2f",
    storageBucket: "tabungin-app-74a2f.firebasestorage.app",
    messagingSenderId: "291986020648",
    appId: "1:291986020648:web:3f74bb239afc7e3872181d",
    measurementId: "G-8X433506J"
};

// Inisialisasi Firebase & Firestore
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
const COLLECTION_NAME = "user_savings";

// PRESET IMAGES
const PRESET_IMAGES = {
    mac: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
    iphone: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&auto=format&fit=crop&q=80',
    motor: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&auto=format&fit=crop&q=80',
    sepatu: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
    konser: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
    mobil: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80',
    rumah: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80',
    kamera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80',
    liburan: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
};

// MASTER GAMIFIKASI & BADGES
const BADGES_DEFINITIONS = [
    {
        id: 'badge_first_deposit',
        icon: 'fa-rocket',
        title: 'Langkah Pertama 🚀',
        desc: 'Melakukan setoran tabungan untuk pertama kali.',
        color: 'from-amber-500 to-orange-500',
        check: () => savingsData.some(s => s.history && s.history.some(tx => tx.type === 'deposit'))
    },
    {
        id: 'badge_active_saver',
        icon: 'fa-piggy-bank',
        title: 'Master Celengan 🐷',
        desc: 'Memiliki minimal 3 celengan tabungan aktif.',
        color: 'from-pink-500 to-rose-500',
        check: () => savingsData.length >= 3
    },
    {
        id: 'badge_goal_reached',
        icon: 'fa-circle-check',
        title: 'Impian Terwujud 🎯',
        desc: 'Mencapai target 100% pada minimal 1 tabungan.',
        color: 'from-emerald-500 to-teal-500',
        check: () => savingsData.some(s => calculatePercentage(s) >= 100)
    },
    {
        id: 'badge_consistent_depositer',
        icon: 'fa-fire',
        title: 'Konsisten Menabung 🔥',
        desc: 'Telah mencatatkan total 5 transaksi setoran.',
        color: 'from-rose-500 to-red-600',
        check: () => {
            let count = 0;
            savingsData.forEach(s => {
                if (s.history) count += s.history.filter(tx => tx.type === 'deposit').length;
            });
            return count >= 5;
        }
    },
    {
        id: 'badge_millionaire',
        icon: 'fa-gem',
        title: 'Miliarder Muda 💎',
        desc: 'Total terkumpul melebihi Rp 5.000.000.',
        color: 'from-blue-500 to-indigo-600',
        check: () => {
            let total = 0;
            savingsData.forEach(s => { total += calculateTerkumpul(s); });
            return total >= 5000000;
        }
    }
];

// GLOBAL APP STATE & USER AUTH STATE
let savingsData = [];
let currentDetailId = null;
let activeTab = 'berlangsung';
let currentSortField = 'nama';
let currentSortOrder = 'asc';
let currentTxType = 'deposit';
let editingTxId = null;
let selectedTxIdForModal = null;
let savingsChartInstance = null;

// USER MANAGEMENT STATE
let currentUser = localStorage.getItem('tabungin_username') || '';
let currentAuthMode = 'login';
let deleteAccountTimer = null;

// STATE KEAMANAN LOGIN
let loginAttempts = parseInt(localStorage.getItem('tabungin_login_attempts') || '0');
let lockUntil = parseInt(localStorage.getItem('tabungin_lock_until') || '0');

// PREFERENSI TAMPILAN
let currentFont = localStorage.getItem('tabungin_font') || 'sans';
let currentAccentColor = localStorage.getItem('tabungin_accent_color') || 'blue';

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initFontAndColor();
    closeModalUsername();
    closeModalChangePassword();
    closeModalBadges();
    updateUserUI();
    await loadStorage();
    initBrowserNotifications();

    const targetInput = document.getElementById('inputTargetAmount');
    if (targetInput) {
        targetInput.addEventListener('input', calculateSavingsTargetSimulation);
    }
});

// VALIDASI SESI KEAMANAN OTOMATIS
async function validateUserSession() {
    if (!currentUser || !db) return true;

    try {
        const docRef = db.collection(COLLECTION_NAME).doc(currentUser);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            showToast("Akun kamu telah dihapus dari sistem!");
            forceLogoutSystem();
            return false;
        }

        const data = docSnap.data();
        if (data.isDeleted) {
            const deleteTime = data.deletedAt?.toMillis() || 0;
            const now = Date.now();
            const hoursPassed = (now - deleteTime) / (1000 * 60 * 60);

            if (hoursPassed >= 24) {
                await docRef.delete();
                showToast("Masa pemulihan 24 jam telah berakhir. Akun dihapus permanen.");
                forceLogoutSystem();
                return false;
            } else {
                const remainingHours = Math.ceil(24 - hoursPassed);
                if (confirm(`Akun ini sedang dalam proses penghapusan (Sisa waktu pemulihan: ${remainingHours} jam).\n\nApakah kamu ingin memulihkan akun ini kembali?`)) {
                    await docRef.update({
                        isDeleted: false,
                        deletedAt: null
                    });
                    showToast("Akun berhasil dipulihkan kembali! 🎉");
                    return true;
                } else {
                    forceLogoutSystem();
                    return false;
                }
            }
        }
        return true;
    } catch (err) {
        console.warn("Gagal memvalidasi sesi akun:", err);
        return true;
    }
}

function forceLogoutSystem() {
    localStorage.removeItem('tabungin_username');
    currentUser = '';
    savingsData = [];
    
    closeModalSavings();
    closeModalTransaction();
    closeModalChangePassword();
    closeModalReminder();
    
    updateUserUI();
    showView('home');
    loadStorage();
}

// GAMIFIKASI & BADGES SYSTEM
function evaluateBadges() {
    let unlockedCount = 0;
    BADGES_DEFINITIONS.forEach(b => {
        if (b.check()) unlockedCount++;
    });

    const indicator = document.getElementById('badgeCountIndicator');
    if (indicator) {
        if (unlockedCount > 0) {
            indicator.innerText = unlockedCount;
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }
}

function openModalBadges() {
    document.getElementById('topMenu')?.classList.add('hidden');
    renderBadgesList();
    document.getElementById('modalBadges')?.classList.remove('hidden');
}

function closeModalBadges() {
    document.getElementById('modalBadges')?.classList.add('hidden');
}

function renderBadgesList() {
    const container = document.getElementById('badgesGridContainer');
    if (!container) return;

    container.innerHTML = BADGES_DEFINITIONS.map(b => {
        const isUnlocked = b.check();
        return `
            <div class="p-3.5 rounded-2xl border ${isUnlocked ? 'bg-gradient-to-br ' + b.color + ' text-white border-transparent shadow-lg' : 'bg-gray-50 dark:bg-[#14141c] border-gray-200 dark:border-gray-800 opacity-60'} flex flex-col justify-between text-center transition">
                <div>
                    <div class="w-10 h-10 rounded-xl ${isUnlocked ? 'bg-white/20' : 'bg-gray-200 dark:bg-[#20202c] text-gray-400 dark:text-gray-500'} flex items-center justify-center mx-auto mb-2 text-lg">
                        <i class="fa-solid ${b.icon}"></i>
                    </div>
                    <h4 class="font-bold text-xs ${isUnlocked ? 'text-white' : 'text-gray-800 dark:text-gray-200'}">${b.title}</h4>
                    <p class="text-[10px] ${isUnlocked ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'} mt-1 leading-snug">${b.desc}</p>
                </div>
                <div class="mt-3">
                    <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${isUnlocked ? 'bg-white/30 text-white' : 'bg-gray-200 dark:bg-[#20202c] text-gray-500 dark:text-gray-400'}">
                        ${isUnlocked ? 'TERBUKA 🎉' : 'TERKUNCI 🔒'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

async function getPublicIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (err) {
        return "unknown_ip";
    }
}

// AUTHENTICATION & USER MANAGEMENT
function openModalUsername() {
    switchAuthMode('login');
    document.getElementById('topMenu')?.classList.add('hidden');
    document.getElementById('modalUsername')?.classList.remove('hidden');
}

function closeModalUsername() {
    document.getElementById('modalUsername')?.classList.add('hidden');
}

function openModalChangePassword() {
    document.getElementById('topMenu')?.classList.add('hidden');
    if (document.getElementById('inputOldPassword')) document.getElementById('inputOldPassword').value = '';
    if (document.getElementById('inputNewPassword')) document.getElementById('inputNewPassword').value = '';
    document.getElementById('modalChangePassword')?.classList.remove('hidden');
    startDeleteAccountCooldown();
}

function closeModalChangePassword() {
    document.getElementById('modalChangePassword')?.classList.add('hidden');
    if (deleteAccountTimer) {
        clearInterval(deleteAccountTimer);
        deleteAccountTimer = null;
    }
}

function startDeleteAccountCooldown() {
    const btn = document.getElementById('btnDeleteAccount');
    if (!btn) return;
    if (deleteAccountTimer) clearInterval(deleteAccountTimer);

    let timeLeft = 20;
    btn.disabled = true;
    btn.className = "w-full py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed font-semibold rounded-xl text-xs transition";
    btn.innerText = `Hapus Akun Permanen (${timeLeft}s)`;

    deleteAccountTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            btn.innerText = `Hapus Akun Permanen (${timeLeft}s)`;
        } else {
            clearInterval(deleteAccountTimer);
            deleteAccountTimer = null;
            btn.disabled = false;
            btn.className = "w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-md transition cursor-pointer";
            btn.innerText = "Hapus Akun Permanen";
        }
    }, 1000);
}

async function handleSoftDeleteAccount() {
    if (!currentUser) return showToast("Kamu belum login!");

    if (!confirm("Konfirmasi Penghapusan Akun:\n\nApakah kamu yakin ingin menghapus akun ini? Akun akan disembunyikan dan dapat dipulihkan dalam kurun waktu 24 jam sebelum terhapus permanen.")) return;

    if (!db) return showToast("Koneksi database Firebase belum siap!");

    try {
        const docRef = db.collection(COLLECTION_NAME).doc(currentUser);
        await docRef.update({
            isDeleted: true,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast("Akun telah ditandai untuk dihapus (pemulihan 24 jam).");
        forceLogoutSystem();
    } catch (err) {
        showToast("Gagal memproses penghapusan akun!");
    }
}

async function handleChangePasswordSubmit(e) {
    if (e) e.preventDefault();
    if (!currentUser) return showToast("Kamu belum login!");

    const isValid = await validateUserSession();
    if (!isValid) return;

    const oldPassword = document.getElementById('inputOldPassword')?.value || "";
    const newPassword = document.getElementById('inputNewPassword')?.value || "";

    if (!oldPassword) return showToast("Masukkan kata sandi lama!");
    if (!newPassword || newPassword.length < 4) return showToast("Kata sandi baru minimal 4 karakter!");
    if (!db) return showToast("Koneksi database Firebase belum siap!");

    try {
        const docRef = db.collection(COLLECTION_NAME).doc(currentUser);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            showToast("Akun tidak ditemukan!");
            forceLogoutSystem();
            return;
        }

        const userData = docSnap.data();
        if (userData.password && userData.password !== oldPassword) {
            return showToast("Kata sandi lama salah!");
        }

        await docRef.update({
            password: newPassword,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast("Kata sandi berhasil diperbarui! 🔑");
        closeModalChangePassword();
    } catch (err) {
        showToast("Gagal memperbarui kata sandi!");
    }
}

function switchAuthMode(mode) {
    currentAuthMode = mode;
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const btn = document.getElementById('btnAuthSubmit');
    
    const activeClass = "flex-1 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#282838] text-theme-accent shadow transition";
    const inactiveClass = "flex-1 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition";

    if (mode === 'login') {
        if (tabLogin) tabLogin.className = activeClass;
        if (tabRegister) tabRegister.className = inactiveClass;
        if (title) title.innerText = "Masuk ke TABUNGin";
        if (subtitle) subtitle.innerText = "Masukkan username dan kata sandi akunmu.";
        if (btn) btn.innerText = "Masuk ke Akun";
    } else {
        if (tabRegister) tabRegister.className = activeClass;
        if (tabLogin) tabLogin.className = inactiveClass;
        if (title) title.innerText = "Buat Akun Baru";
        if (subtitle) subtitle.innerText = "Buat username dan kata sandi untuk akun barumu.";
        if (btn) btn.innerText = "Daftar Akun Baru";
    }
}

function togglePasswordVisibility() {
    const passInput = document.getElementById('inputAuthPassword');
    const passIcon = document.getElementById('togglePassIcon');
    if (!passInput || !passIcon) return;

    if (passInput.type === 'password') {
        passInput.type = 'text';
        passIcon.className = 'fa-solid fa-eye-slash text-xs text-theme-accent';
    } else {
        passInput.type = 'password';
        passIcon.className = 'fa-solid fa-eye text-xs';
    }
}

async function handleAuthSubmit(e) {
    if (e) e.preventDefault();
    const now = Date.now();

    if (currentAuthMode === 'login' && lockUntil > now) {
        const remainingSeconds = Math.ceil((lockUntil - now) / 1000);
        return showToast(`Akses terkunci! Tunggu ${remainingSeconds} detik lagi.`);
    }

    const rawInput = document.getElementById('inputAuthUsername')?.value || "";
    const password = document.getElementById('inputAuthPassword')?.value || "";
    const username = rawInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!username || username.length < 3) return showToast("Username minimal 3 karakter!");
    if (!password || password.length < 4) return showToast("Kata sandi minimal 4 karakter!");
    if (!db) return showToast("Koneksi database Firebase belum siap!");

    try {
        const docRef = db.collection(COLLECTION_NAME).doc(username);
        const docSnap = await docRef.get();

        if (currentAuthMode === 'register') {
            const userIP = await getPublicIP();
            const twelveHoursInMs = 12 * 60 * 60 * 1000;

            if (userIP !== "unknown_ip") {
                const ipDocRef = db.collection("ip_registers").doc(userIP.replace(/\./g, '_'));
                const ipSnap = await ipDocRef.get();

                if (ipSnap.exists) {
                    const lastRegisterTime = ipSnap.data().lastRegisterAt?.toMillis() || 0;
                    if (now - lastRegisterTime < twelveHoursInMs) {
                        const remainingHours = Math.ceil((twelveHoursInMs - (now - lastRegisterTime)) / (1000 * 60 * 60));
                        return showToast(`IP ini baru saja mendaftar. Coba lagi dalam ${remainingHours} jam!`);
                    }
                }
            }

            if (docSnap.exists) return showToast("Username sudah dipakai!");

            savingsData = [];
            await docRef.set({
                username: username,
                password: password,
                items: [],
                isDeleted: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (userIP !== "unknown_ip") {
                await db.collection("ip_registers").doc(userIP.replace(/\./g, '_')).set({
                    ip: userIP,
                    lastRegisterAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            currentUser = username;
            localStorage.setItem('tabungin_username', currentUser);
            loginAttempts = 0;
            localStorage.setItem('tabungin_login_attempts', '0');
            localStorage.removeItem('tabungin_lock_until');

            showToast(`Akun @${username} berhasil dibuat & otomatis masuk! 🎉`);
        } else {
            if (!docSnap.exists) return showToast("Username tidak ditemukan!");

            const userData = docSnap.data();
            if (userData.password && userData.password !== password) {
                loginAttempts += 1;
                localStorage.setItem('tabungin_login_attempts', loginAttempts);

                if (loginAttempts >= 5) {
                    lockUntil = Date.now() + 60000;
                    localStorage.setItem('tabungin_lock_until', lockUntil);
                    loginAttempts = 0;
                    localStorage.setItem('tabungin_login_attempts', '0');
                    showToast("Gagal login 5x! Akses terkunci 1 menit.");
                } else {
                    showToast(`Kata sandi salah! Sisa percobaan: ${5 - loginAttempts}`);
                }
                return;
            }

            loginAttempts = 0;
            localStorage.setItem('tabungin_login_attempts', '0');
            localStorage.removeItem('tabungin_lock_until');

            currentUser = username;
            localStorage.setItem('tabungin_username', currentUser);

            const isValidSession = await validateUserSession();
            if (!isValidSession) return;

            savingsData = userData.items || [];
            showToast(`Selamat datang kembali, @${username}!`);
        }

        closeModalUsername();
        if (document.getElementById('inputAuthPassword')) document.getElementById('inputAuthPassword').value = '';
        saveStorage();
        updateUserUI();
        renderHome();
    } catch (err) {
        showToast("Gagal terhubung ke server database!");
    }
}

function handleLogout() {
    document.getElementById('topMenu')?.classList.add('hidden');
    forceLogoutSystem();
    showToast("Kamu kembali ke Mode Guest (Tamu)");
}

function updateUserUI() {
    const label = document.getElementById('currentUsernameLabel');
    const loginBtn = document.getElementById('menuLoginBtn');
    const changePassBtn = document.getElementById('menuChangePassBtn');
    const logoutBtn = document.getElementById('menuLogoutBtn');
    const guestBanner = document.getElementById('guestNoticeBanner');

    if (currentUser) {
        if (label) label.innerText = `@${currentUser}`;
        if (loginBtn) loginBtn.classList.add('hidden');
        if (changePassBtn) changePassBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (guestBanner) guestBanner.classList.add('hidden');
    } else {
        if (label) label.innerText = '@Guest (Tamu)';
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (changePassBtn) changePassBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (guestBanner) guestBanner.classList.remove('hidden');
    }
}

// STORAGE MANAGEMENT
async function loadStorage() {
    if (currentUser && db) {
        try {
            const isValid = await validateUserSession();
            if (!isValid) return;

            const docRef = db.collection(COLLECTION_NAME).doc(currentUser);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                savingsData = Array.isArray(docSnap.data().items) ? docSnap.data().items : [];
                renderHome();
                evaluateBadges();
                return;
            } else {
                showToast("Sesi berakhir, akun tidak ditemukan.");
                forceLogoutSystem();
                return;
            }
        } catch (err) {
            console.error("Gagal memuat dari Firebase:", err);
        }
    }

    const localKey = currentUser ? `celenganku_data_${currentUser}` : `celenganku_data_guest`;
    try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
            savingsData = JSON.parse(stored);
        } else {
            if (!currentUser) seedSampleData(false);
            else savingsData = [];
        }
    } catch (err) {
        savingsData = [];
    }

    renderHome();
    evaluateBadges();
}

function saveStorage() {
    const localKey = currentUser ? `celenganku_data_${currentUser}` : `celenganku_data_guest`;

    try {
        localStorage.setItem(localKey, JSON.stringify(savingsData));
    } catch (err) {}

    if (currentUser && db) {
        db.collection(COLLECTION_NAME).doc(currentUser).set({
            username: currentUser,
            items: savingsData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(() => {});
    }

    evaluateBadges();
}

function confirmResetSampleData() {
    document.getElementById('topMenu')?.classList.add('hidden');
    if (confirm("Apakah kamu yakin ingin mereset dan memuat data contoh?")) {
        seedSampleData(true);
    }
}

function seedSampleData(notify = true) {
    savingsData = [
        {
            id: 'savings-mac-001',
            title: 'Beli MAC (Hanya Contoh)',
            targetAmount: 13500000,
            freqAmount: 50000,
            freqType: 'Perminggu',
            currencySymbol: 'Rp',
            currencyFlag: '🇮🇩',
            currencyCode: 'IDR',
            imageUrl: PRESET_IMAGES.mac,
            createdDate: '18 Okt 2026',
            reminderTime: '12:00',
            reminderFreq: 'Setiap Minggu',
            reminderEnabled: false,
            history: [
                { id: 'tx-001', type: 'deposit', amount: 1500000, dateStr: '01 Okt 2026 • 10:00', note: 'Setoran awal' },
                { id: 'tx-002', type: 'deposit', amount: 2000000, dateStr: '10 Okt 2026 • 14:00', note: 'Bonus kerjaan' },
                { id: 'tx-003', type: 'deposit', amount: 1200000, dateStr: '18 Okt 2026 • 12:03', note: 'Sisihan uang saku' }
            ]
        }
    ];
    saveStorage();
    renderHome();
    if (currentDetailId) openDetailView(currentDetailId);
    if (notify) showToast("Data contoh berhasil dimuat");
}

function confirmClearAllData() {
    document.getElementById('topMenu')?.classList.add('hidden');
    if (confirm("PERINGATAN: Yakin hapus SEMUA data tabungan?")) {
        clearAllData();
    }
}

function clearAllData() {
    savingsData = [];
    saveStorage();
    showView('home');
    renderHome();
    showToast("Semua data berhasil dihapus");
}

// HELPERS
function parseNominal(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).replace(/[^0-9]/g, '');
    return parseFloat(cleanStr) || 0;
}

function formatDots(num) {
    const val = parseNominal(num);
    if (val === 0) return '0';
    return val.toLocaleString('id-ID');
}

function formatCurrency(amount, symbol = 'Rp') {
    return `${symbol} ${formatDots(amount)}`;
}

function handleFormattedInput(inputElement) {
    if (!inputElement) return;
    const cursorPosition = inputElement.selectionStart;
    const originalLength = inputElement.value.length;

    const numericValue = parseNominal(inputElement.value);
    if (numericValue === 0 && inputElement.value.trim() === '') {
        inputElement.value = '';
        return;
    }

    inputElement.value = formatDots(numericValue);
    const newLength = inputElement.value.length;
    const diff = newLength - originalLength;
    inputElement.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
}

function clearInput(elementId) {
    const elem = document.getElementById(elementId);
    if (elem) {
        elem.value = "";
        elem.focus();
    }
}

function formatDateNow() {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} • ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function formatDateOnlyNow() {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function calculateTerkumpul(item) {
    if (!item || !item.history || !Array.isArray(item.history)) return 0;
    return item.history.reduce((sum, tx) => {
        const amt = parseNominal(tx.amount);
        return tx.type === 'deposit' ? sum + amt : sum - amt;
    }, 0);
}

function calculatePercentage(item) {
    if (!item || !item.targetAmount || item.targetAmount <= 0) return 0;
    const terkumpul = calculateTerkumpul(item);
    return Math.max(0, Math.round((terkumpul / item.targetAmount) * 100));
}

function calculateEstimasiText(item) {
    const terkumpul = calculateTerkumpul(item);
    const kekurang = Math.max(0, item.targetAmount - terkumpul);
    if (kekurang <= 0) return "Target Tercapai 🎉";
    if (!item.freqAmount || item.freqAmount <= 0) return "-";

    const sisaPeriode = Math.ceil(kekurang / item.freqAmount);
    const unit = item.freqType === 'Perhari' ? 'Hari' : (item.freqType === 'Perbulan' ? 'Bulan' : 'Minggu');
    return `${sisaPeriode} ${unit} Lagi`;
}

function calculateSavingsTargetSimulation() {
    const targetAmount = parseNominal(document.getElementById('inputTargetAmount')?.value);
    const deadlineVal = document.getElementById('inputTargetDeadline')?.value;
    const freqType = document.getElementById('inputFreqType')?.value || 'Perminggu';
    const infoBox = document.getElementById('calcSimulationInfo');

    if (!infoBox) return;

    if (!targetAmount || !deadlineVal) {
        infoBox.classList.add('hidden');
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(deadlineVal);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        infoBox.classList.remove('hidden');
        infoBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-500 mr-1"></i> Tanggal deadline harus lebih besar dari hari ini!`;
        return;
    }

    let requiredAmount = 0;
    let labelUnit = "per hari";

    if (freqType === 'Perhari') {
        requiredAmount = Math.ceil(targetAmount / diffDays);
        labelUnit = "per hari";
    } else if (freqType === 'Perbulan') {
        const diffMonths = Math.max(1, diffDays / 30);
        requiredAmount = Math.ceil(targetAmount / diffMonths);
        labelUnit = "per bulan";
    } else {
        const diffWeeks = Math.max(1, diffDays / 7);
        requiredAmount = Math.ceil(targetAmount / diffWeeks);
        labelUnit = "per minggu";
    }

    const freqInput = document.getElementById('inputFreqAmount');
    if (freqInput) freqInput.value = formatDots(requiredAmount);

    infoBox.classList.remove('hidden');
    infoBox.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fa-solid fa-calculator text-sm"></i>
            <span>Simulasi: Tabung <strong>${formatCurrency(requiredAmount)}</strong> ${labelUnit} selama ${diffDays} hari.</span>
        </div>
    `;
}

function exportToPDF() {
    if (!currentDetailId) return;
    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return showToast("Mohon izinkan Pop-up di browser!");

    const terkumpul = calculateTerkumpul(item);
    const kekurang = Math.max(0, item.targetAmount - terkumpul);
    const pct = calculatePercentage(item);
    const symbol = item.currencySymbol || 'Rp';

    const historyRows = (item.history || []).map((tx, idx) => {
        const isDep = tx.type === 'deposit';
        return `
            <tr>
                <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">${idx + 1}</td>
                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">${tx.dateStr}</td>
                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">
                    <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: ${isDep ? '#d1fae5' : '#ffe4e6'}; color: ${isDep ? '#065f46' : '#9f1239'};">
                        ${isDep ? '+ Setoran' : '- Penarikan'}
                    </span>
                </td>
                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">${escapeHtml(tx.note || '-')}</td>
                <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-weight: 700; color: ${isDep ? '#10b981' : '#f43f5e'};">
                    ${isDep ? '+' : '-'} ${formatCurrency(tx.amount, symbol)}
                </td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Tabungan - ${escapeHtml(item.title)}</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Poppins', sans-serif; padding: 30px; color: #1e293b; background: #fff; margin: 0; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
                .logo-text { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
                .card-title { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
                .grid-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px; }
                .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                th { background: #f1f5f9; color: #475569; padding: 10px 8px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="logo-text">TABUNGin</h1>
                    <p style="font-size: 12px; color: #64748b;">Laporan Rekap Catatan Tabungan</p>
                </div>
            </div>
            <div class="card-title">
                <h2 style="margin:0;">Target Impian: ${escapeHtml(item.title)}</h2>
                <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">Status: <strong>${pct}% Tercapai</strong></p>
            </div>
            <div class="grid-summary">
                <div class="stat-box"><div>Target Tabungan</div><div style="font-weight:bold;">${formatCurrency(item.targetAmount, symbol)}</div></div>
                <div class="stat-box"><div style="color:#059669;">Total Terkumpul</div><div style="font-weight:bold; color:#059669;">${formatCurrency(terkumpul, symbol)}</div></div>
                <div class="stat-box"><div style="color:#e11d48;">Sisa Kekurangan</div><div style="font-weight:bold; color:#e11d48;">${formatCurrency(kekurang, symbol)}</div></div>
            </div>
            <table>
                <thead><tr><th>#</th><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th style="text-align:right;">Nominal</th></tr></thead>
                <tbody>${historyRows || '<tr><td colspan="5" style="text-align:center; padding:20px;">Belum ada riwayat.</td></tr>'}</tbody>
            </table>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 300);
}

// VIEW ROUTING
function showView(viewName) {
    document.getElementById('topMenu')?.classList.add('hidden');
    document.getElementById('sortDropdown')?.classList.add('hidden');

    const fab = document.getElementById('fabAddSavings');
    const viewHome = document.getElementById('view-home');
    const viewDetail = document.getElementById('view-detail');

    if (viewName === 'home') {
        currentDetailId = null;
        if (viewHome) viewHome.classList.remove('hidden');
        if (viewDetail) viewDetail.classList.add('hidden');
        if (fab) fab.style.display = ''; 
        renderHome();
    } else if (viewName === 'detail') {
        if (viewHome) viewHome.classList.add('hidden');
        if (viewDetail) viewDetail.classList.remove('hidden');
        if (fab) fab.style.display = 'none'; 
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setActiveTab(tab) {
    activeTab = tab;
    const tabB = document.getElementById('tab-berlangsung');
    const tabT = document.getElementById('tab-tercapai');

    if (tabB && tabT) {
        if (tab === 'berlangsung') {
            tabB.className = "flex-1 md:flex-initial px-6 py-2 rounded-lg text-xs font-semibold text-theme-accent bg-white dark:bg-[#282838] shadow transition";
            tabT.className = "flex-1 md:flex-initial px-6 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition";
        } else {
            tabT.className = "flex-1 md:flex-initial px-6 py-2 rounded-lg text-xs font-semibold text-theme-accent bg-white dark:bg-[#282838] shadow transition";
            tabB.className = "flex-1 md:flex-initial px-6 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition";
        }
    }
    renderHome();
}

function toggleTopMenu() {
    document.getElementById('topMenu')?.classList.toggle('hidden');
}

function toggleSortDropdown() {
    document.getElementById('sortDropdown')?.classList.toggle('hidden');
}

function setSortField(field, label) {
    currentSortField = field;
    const labelElem = document.getElementById('currentSortLabel');
    if (labelElem) labelElem.innerText = label;
    document.getElementById('sortDropdown')?.classList.add('hidden');
    renderHome();
}

function toggleSortOrder() {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('sortOrderIcon');
    const label = document.getElementById('sortOrderLabel');
    if (icon) icon.className = currentSortOrder === 'asc' ? "fa-solid fa-arrow-up text-theme-accent" : "fa-solid fa-arrow-down text-theme-accent";
    if (label) label.innerText = currentSortOrder === 'asc' ? "Meningkat" : "Menurun";
    renderHome();
}

// RENDER HOME CARD
function renderHome() {
    const container = document.getElementById('savingsListContainer') || document.getElementById('savingsList');
    const emptyState = document.getElementById('emptyState');
    if (!container) return;

    if (!savingsData || savingsData.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }

    let filtered = savingsData.filter(item => {
        const pct = calculatePercentage(item);
        return activeTab === 'tercapai' ? pct >= 100 : pct < 100;
    });

    filtered.sort((a, b) => {
        let valA, valB;
        if (currentSortField === 'nama') {
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
            return currentSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (currentSortField === 'persen') {
            valA = calculatePercentage(a);
            valB = calculatePercentage(b);
        } else if (currentSortField === 'target') {
            valA = a.targetAmount || 0;
            valB = b.targetAmount || 0;
        } else if (currentSortField === 'terkumpul') {
            valA = calculateTerkumpul(a);
            valB = calculateTerkumpul(b);
        }
        return currentSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-400 dark:text-gray-500">
                <i class="fa-solid fa-piggy-bank text-4xl mb-3 opacity-50"></i>
                <p class="text-sm">Belum ada tabungan di kategori ini.</p>
            </div>
        `;
        if (emptyState) emptyState.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = filtered.map(item => {
        const pct = calculatePercentage(item);
        const displayPct = Math.min(100, pct);
        const estimasiText = calculateEstimasiText(item);
        const img = item.imageUrl || PRESET_IMAGES.mac;
        const symbol = item.currencySymbol || 'Rp';

        return `
            <div onclick="openDetailView('${item.id}')" class="bg-white dark:bg-[#181820] border border-gray-200 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700 rounded-3xl p-5 shadow-xl cursor-pointer transition transform hover:-translate-y-1 active:scale-[0.99] flex flex-col justify-between space-y-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white tracking-wide truncate mb-3">${escapeHtml(item.title)}</h3>
                    <div class="w-full h-48 rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#22222e] flex items-center justify-center">
                        <img src="${img}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='https://placehold.co/600x400/22222a/94a3b8?text=Impian+Kamu';">
                    </div>
                </div>
                <div>
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-2xl font-extrabold text-gray-900 dark:text-white">${formatCurrency(item.targetAmount, symbol)}</h4>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">${formatCurrency(item.freqAmount, symbol)} ${escapeHtml(item.freqType || 'Perminggu')}</p>
                        </div>
                        <div class="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                            <svg class="w-14 h-14 transform -rotate-90">
                                <circle cx="28" cy="28" r="22" class="stroke-gray-200 dark:stroke-[#282836]" stroke-width="4" fill="transparent" />
                                <circle cx="28" cy="28" r="22" stroke="currentColor" class="text-theme-accent" stroke-width="4" stroke-dasharray="138.23" stroke-dashoffset="${(138.23 - (138.23 * displayPct / 100)).toFixed(2)}" stroke-linecap="round" fill="transparent" class="transition-all duration-500 ease-out" />
                            </svg>
                            <span class="absolute text-[11px] font-bold text-gray-900 dark:text-white">${pct}%</span>
                        </div>
                    </div>
                    <div class="border-t border-gray-100 dark:border-gray-800/80 mt-4 pt-3 flex items-center justify-between text-xs">
                        <span class="text-gray-500 dark:text-gray-400 font-medium">Sisa Estimasi</span>
                        <span class="font-semibold text-theme-accent">${estimasiText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (typeof changeAccentColor === 'function') {
        changeAccentColor(currentAccentColor, false);
    }
}

// DETAIL PAGE RENDERING & GRAFIK TREN (MURNI TANPA BADGE STATUS)
function openDetailView(id) {
    currentDetailId = id;
    const item = savingsData.find(s => s.id === id);
    if (!item) {
        showView('home');
        return;
    }

    const terkumpul = calculateTerkumpul(item);
    const kekurang = Math.max(0, item.targetAmount - terkumpul);
    const pct = calculatePercentage(item);
    const displayPct = Math.min(100, pct);
    const symbol = item.currencySymbol || 'Rp';

    const setTxt = (elemId, txt) => {
        const el = document.getElementById(elemId);
        if (el) el.innerText = txt;
    };

    setTxt('detailHeaderTitle', item.title);
    setTxt('detailTargetAmount', formatCurrency(item.targetAmount, symbol));
    setTxt('detailFrequency', `${formatCurrency(item.freqAmount, symbol)} ${item.freqType || 'Perminggu'}`);
    setTxt('detailPercentText', `${pct}%`);
    setTxt('detailCreatedDate', item.createdDate || '-');
    setTxt('detailEstimasi', calculateEstimasiText(item));
    setTxt('detailReminderTime', item.reminderTime || '12:00');
    setTxt('detailReminderFreq', item.reminderFreq || 'Setiap Minggu');
    setTxt('detailTerkumpul', formatCurrency(terkumpul, symbol));
    setTxt('detailKekurangan', formatCurrency(kekurang, symbol));

    const imgElem = document.getElementById('detailImg');
    if (imgElem) imgElem.src = item.imageUrl || PRESET_IMAGES.mac;

    const circle = document.getElementById('detailCircleProgress');
    if (circle) {
        const dashOffset = (201.06 - (201.06 * displayPct / 100)).toFixed(2);
        circle.setAttribute('stroke-dashoffset', dashOffset);
    }

    const reminderToggle = document.getElementById('toggleReminder');
    if (reminderToggle) reminderToggle.checked = item.reminderEnabled !== false;

    renderDetailHistory(item);
    renderSavingsTrendChart(item);

    showView('detail');

    if (typeof changeAccentColor === 'function') {
        changeAccentColor(currentAccentColor, false);
    }
}

// RENDERING CHART.JS MURNI HANYA MENAMPILKAN GRAFIK TREN
function renderSavingsTrendChart(item) {
    const canvasElem = document.getElementById('savingsTrendChart');
    if (!canvasElem || typeof Chart === 'undefined') return;

    if (savingsChartInstance) {
        savingsChartInstance.destroy();
        savingsChartInstance = null;
    }

    const history = item.history || [];
    let labels = [];
    let dataPoints = [];
    let runningTotal = 0;

    if (history.length === 0) {
        labels = ['Awal', 'Saat Ini'];
        dataPoints = [0, 0];
    } else {
        const sorted = [...history].sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
        labels.push('Awal');
        dataPoints.push(0);

        sorted.forEach(tx => {
            const dateOnly = tx.dateStr.split('•')[0].trim();
            const amt = parseNominal(tx.amount);
            runningTotal += tx.type === 'deposit' ? amt : -amt;

            labels.push(dateOnly);
            dataPoints.push(runningTotal);
        });
    }

    const ctx = canvasElem.getContext('2d');
    const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3b82f6';

    savingsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Terkumpul',
                data: dataPoints,
                borderColor: accentHex,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: accentHex,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Terkumpul: ${item.currencySymbol || 'Rp'} ${formatDots(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10 },
                        callback: function(value) {
                            if (value >= 1000000) return (value / 1000000) + 'Jt';
                            if (value >= 1000) return (value / 1000) + 'Rb';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function renderDetailHistory(item) {
    const container = document.getElementById('detailHistoryContainer');
    const countSpan = document.getElementById('detailHistoryCount');
    if (!container) return;

    if (!item.history || item.history.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Belum ada catatan tabungan</p>`;
        if (countSpan) countSpan.innerText = "0 Transaksi";
        return;
    }

    if (countSpan) countSpan.innerText = `${item.history.length} Transaksi`;

    const sortedTx = [...item.history].reverse();

    container.innerHTML = sortedTx.map(tx => {
        const isDep = tx.type === 'deposit';
        const sign = isDep ? '+' : '-';
        const textColor = isDep ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400';

        return `
            <div onclick="openModalTxDetail('${tx.id}')" class="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-[#14141c] hover:bg-gray-100 dark:hover:bg-[#20202e] border border-gray-200 dark:border-gray-800/80 cursor-pointer transition active:scale-[0.99]">
                <div>
                    <p class="text-xs font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(tx.note || (isDep ? 'Setoran Tabungan' : 'Penarikan Tabungan'))}</p>
                    <p class="text-[10px] text-gray-500 mt-0.5">${tx.dateStr}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold ${textColor}">${sign} ${formatDots(tx.amount)}</p>
                </div>
            </div>
        `;
    }).join('');
}

function updateLivePreview(url) {
    const previewImg = document.getElementById('modalImgPreview');
    const placeholder = document.getElementById('modalImgPlaceholder');

    if (previewImg && placeholder) {
        if (url && url.trim() !== "") {
            previewImg.src = url;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            previewImg.src = "";
            previewImg.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
        showToast("Ukuran foto terlalu besar! Maksimal 1 MB.");
        e.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDimension = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            const inputImg = document.getElementById('inputImage');
            if (inputImg) inputImg.value = compressedBase64;
            updateLivePreview(compressedBase64);
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

function setPresetImg(key) {
    if (PRESET_IMAGES[key]) {
        const url = PRESET_IMAGES[key];
        const inputImg = document.getElementById('inputImage');
        const inputFileInput = document.getElementById('inputFileImage');
        if (inputImg) inputImg.value = url;
        if (inputFileInput) inputFileInput.value = "";
        updateLivePreview(url);
    }
}

// MODAL CELENGAN HANDLERS
function setFreqType(type) {
    const freqInput = document.getElementById('inputFreqType');
    if (freqInput) freqInput.value = type;

    const btnH = document.getElementById('btnFreqHarian');
    const btnM = document.getElementById('btnFreqMingguan');
    const btnB = document.getElementById('btnFreqBulanan');

    [btnH, btnM, btnB].forEach(b => {
        if (b) b.className = "flex-1 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition";
    });

    const activeClass = "flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#2a2a38] text-theme-accent shadow transition";
    if (type === 'Perhari' && btnH) btnH.className = activeClass;
    else if (type === 'Perminggu' && btnM) btnM.className = activeClass;
    else if (type === 'Perbulan' && btnB) btnB.className = activeClass;

    calculateSavingsTargetSimulation();
}

function handleCurrencyChange(val) {
    const parts = val.split('|');
    const flagElem = document.getElementById('currencyFlag');
    if (parts.length >= 3 && flagElem) {
        flagElem.innerText = parts[2];
    }
}

function openModalAddSavings() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    const setTitle = (txt) => {
        const el = document.getElementById('modalSavingsTitle');
        if (el) el.innerText = txt;
    };

    setTitle("Tambah Celengan");
    setVal('inputSavingsId', "");
    setVal('inputTitle', "");
    setVal('inputTargetAmount', "");
    setVal('inputTargetDeadline', "");
    setVal('inputFreqAmount', "");
    setVal('inputCurrency', "IDR|Rp|🇮🇩");
    handleCurrencyChange("IDR|Rp|🇮🇩");
    setFreqType('Perminggu');
    setVal('inputImage', "");
    setVal('inputFileImage', "");
    updateLivePreview("");

    const infoBox = document.getElementById('calcSimulationInfo');
    if (infoBox) infoBox.classList.add('hidden');

    document.getElementById('modalSavings')?.classList.remove('hidden');
}

function openModalEditSavings() {
    if (!currentDetailId) return;
    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    const modalTitle = document.getElementById('modalSavingsTitle');
    if (modalTitle) modalTitle.innerText = "Edit Celengan";

    setVal('inputSavingsId', item.id);
    setVal('inputTitle', item.title);
    setVal('inputTargetAmount', formatDots(item.targetAmount));
    setVal('inputTargetDeadline', item.targetDeadline || "");
    setVal('inputFreqAmount', formatDots(item.freqAmount));
    setFreqType(item.freqType || "Perminggu");

    const currVal = `${item.currencyCode || 'IDR'}|${item.currencySymbol || 'Rp'}|${item.currencyFlag || '🇮🇩'}`;
    setVal('inputCurrency', currVal);
    handleCurrencyChange(currVal);

    setVal('inputImage', item.imageUrl || "");
    setVal('inputFileImage', "");
    updateLivePreview(item.imageUrl || "");

    calculateSavingsTargetSimulation();
    document.getElementById('modalSavings')?.classList.remove('hidden');
}

function closeModalSavings() {
    document.getElementById('modalSavings')?.classList.add('hidden');
}

async function handleSaveSavings(e) {
    if (e) e.preventDefault();
    const isValid = await validateUserSession();
    if (!isValid) return;

    const getVal = (id) => document.getElementById(id)?.value || "";

    const id = getVal('inputSavingsId');
    const title = getVal('inputTitle').trim();
    const targetAmount = parseNominal(getVal('inputTargetAmount'));
    const targetDeadline = getVal('inputTargetDeadline');
    const freqAmount = parseNominal(getVal('inputFreqAmount'));
    const freqType = getVal('inputFreqType');

    const currVal = getVal('inputCurrency');
    const [cCode, cSymbol, cFlag] = currVal.split('|');

    let imageUrl = getVal('inputImage').trim();
    if (!imageUrl) imageUrl = PRESET_IMAGES.mac;

    if (id) {
        const item = savingsData.find(s => s.id === id);
        if (item) {
            item.title = title;
            item.targetAmount = targetAmount;
            item.targetDeadline = targetDeadline;
            item.freqAmount = freqAmount;
            item.freqType = freqType;
            item.currencyCode = cCode;
            item.currencySymbol = cSymbol;
            item.currencyFlag = cFlag;
            item.imageUrl = imageUrl;
            saveStorage();
            openDetailView(id);
            showToast("Celengan berhasil diperbarui");
        }
    } else {
        const newItem = {
            id: 'savings-' + Date.now(),
            title: title,
            targetAmount: targetAmount,
            targetDeadline: targetDeadline,
            freqAmount: freqAmount,
            freqType: freqType,
            currencyCode: cCode,
            currencySymbol: cSymbol,
            currencyFlag: cFlag,
            imageUrl: imageUrl,
            createdDate: formatDateOnlyNow(),
            reminderTime: '12:00',
            reminderFreq: 'Setiap Minggu',
            reminderEnabled: false,
            history: []
        };
        savingsData.push(newItem);
        saveStorage();
        renderHome();
        showToast("Celengan baru ditambahkan");
    }

    closeModalSavings();
}

// MODAL TRANSACTION HANDLERS
function openModalTransaction() {
    if (!currentDetailId) return;
    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    editingTxId = null;
    const modalTitle = document.getElementById('modalTxTitle');
    if (modalTitle) modalTitle.innerText = "Catat Tabungan";

    setTransactionType('deposit');
    const inputAmt = document.getElementById('inputTxAmount');
    const inputNote = document.getElementById('inputTxNote');
    if (inputAmt) inputAmt.value = "";
    if (inputNote) inputNote.value = "";

    const terkumpul = calculateTerkumpul(item);
    const kekurang = Math.max(0, item.targetAmount - terkumpul);

    const chipP = document.getElementById('chipPeriodic');
    if (chipP) {
        chipP.innerText = `${formatDots(item.freqAmount)}`;
        chipP.onclick = () => setTxChipAmount(item.freqAmount);
    }

    const chipR = document.getElementById('chipRemaining');
    if (chipR) {
        chipR.innerText = `${formatDots(kekurang)}`;
        chipR.onclick = () => setTxChipAmount(kekurang);
    }

    document.getElementById('modalTransaction')?.classList.remove('hidden');
}

function closeModalTransaction() {
    document.getElementById('modalTransaction')?.classList.add('hidden');
    editingTxId = null;
}

function setTransactionType(type) {
    currentTxType = type;
    const btnDep = document.getElementById('btnTypeDeposit');
    const btnWith = document.getElementById('btnTypeWithdraw');

    if (btnDep && btnWith) {
        if (type === 'deposit') {
            btnDep.className = "flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow transition";
            btnWith.className = "flex-1 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition";
        } else {
            btnWith.className = "flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white shadow transition";
            btnDep.className = "flex-1 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition";
        }
    }
}

function setTxChipAmount(val) {
    const elem = document.getElementById('inputTxAmount');
    if (elem) elem.value = formatDots(val);
}

async function handleSaveTransaction(e) {
    if (e) e.preventDefault();
    if (!currentDetailId) return;

    const isValid = await validateUserSession();
    if (!isValid) return;

    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    const amount = parseNominal(document.getElementById('inputTxAmount')?.value);
    const note = (document.getElementById('inputTxNote')?.value || "").trim();

    if (!amount || amount <= 0) return showToast("Nominal tabungan harus lebih dari 0!");

    if (!item.history) item.history = [];

    if (editingTxId) {
        const tx = item.history.find(t => t.id === editingTxId);
        if (tx) {
            tx.type = currentTxType;
            tx.amount = amount;
            tx.note = note;
        }
    } else {
        const newTx = {
            id: 'tx-' + Date.now(),
            type: currentTxType,
            amount: amount,
            dateStr: formatDateNow(),
            note: note
        };
        item.history.push(newTx);
    }

    saveStorage();
    closeModalTransaction();
    openDetailView(item.id);
    renderHome();

    const pct = calculatePercentage(item);
    if (pct >= 100 && currentTxType === 'deposit') {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
        sendBrowserNotification("Target Tabungan Tercapai! 🎉", `Selamat! Target tabungan "${item.title}" sudah 100% tercapai.`);
        showToast("Selamat! Target tabungan tercapai 🎉");
    } else {
        showToast(editingTxId ? "Catatan tabungan diperbarui" : (currentTxType === 'deposit' ? "Setoran berhasil dicatat" : "Penarikan berhasil dicatat"));
    }
    editingTxId = null;
}

// TRANSACTION DETAIL POPUP
function openModalTxDetail(txId) {
    if (!currentDetailId) return;
    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item || !item.history) return;

    const tx = item.history.find(t => t.id === txId);
    if (!tx) return;

    selectedTxIdForModal = txId;

    const isDep = tx.type === 'deposit';
    const amountElem = document.getElementById('txDetailAmount');
    if (amountElem) {
        amountElem.innerText = `${isDep ? '+' : '-'} ${formatDots(tx.amount)}`;
        amountElem.className = `text-3xl font-extrabold tracking-tight ${isDep ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`;
    }

    const dateElem = document.getElementById('txDetailDate');
    if (dateElem) dateElem.innerText = tx.dateStr;

    const noteElem = document.getElementById('txDetailNote');
    if (noteElem) {
        if (tx.note && tx.note.trim() !== '') {
            noteElem.innerText = `"${tx.note}"`;
            noteElem.classList.remove('hidden');
        } else {
            noteElem.classList.add('hidden');
        }
    }

    document.getElementById('modalTxDetail')?.classList.remove('hidden');
}

function closeModalTxDetail() {
    document.getElementById('modalTxDetail')?.classList.add('hidden');
}

function handleEditTxFromModal() {
    closeModalTxDetail();
    if (!currentDetailId || !selectedTxIdForModal) return;

    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item || !item.history) return;

    const tx = item.history.find(t => t.id === selectedTxIdForModal);
    if (!tx) return;

    editingTxId = tx.id;
    const titleElem = document.getElementById('modalTxTitle');
    if (titleElem) titleElem.innerText = "Ubah Catatan Tabungan";

    setTransactionType(tx.type);

    const inputAmt = document.getElementById('inputTxAmount');
    const inputNote = document.getElementById('inputTxNote');
    if (inputAmt) inputAmt.value = formatDots(tx.amount);
    if (inputNote) inputNote.value = tx.note || "";

    const terkumpul = calculateTerkumpul(item);
    const kekurang = Math.max(0, item.targetAmount - terkumpul);

    const chipP = document.getElementById('chipPeriodic');
    if (chipP) {
        chipP.innerText = `${formatDots(item.freqAmount)}`;
        chipP.onclick = () => setTxChipAmount(item.freqAmount);
    }

    const chipR = document.getElementById('chipRemaining');
    if (chipR) {
        chipR.innerText = `${formatDots(kekurang)}`;
        chipR.onclick = () => setTxChipAmount(kekurang);
    }

    document.getElementById('modalTransaction')?.classList.remove('hidden');
}

async function handleDeleteTxFromModal() {
    if (!currentDetailId || !selectedTxIdForModal) return;

    const isValid = await validateUserSession();
    if (!isValid) return;

    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item || !item.history) return;

    item.history = item.history.filter(t => t.id !== selectedTxIdForModal);
    saveStorage();

    closeModalTxDetail();
    openDetailView(item.id);
    renderHome();
    showToast("Catatan tabungan berhasil dihapus");
    selectedTxIdForModal = null;
}

// BROWSER NOTIFICATIONS
function initBrowserNotifications() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

function sendBrowserNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/2953/2953361.png'
        });
    }
}

function openModalReminder() {
    if (!currentDetailId) return;
    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    const timeInp = document.getElementById('inputReminderTime');
    const freqInp = document.getElementById('inputReminderFreq');
    const activeInp = document.getElementById('inputReminderActive');

    if (timeInp) timeInp.value = item.reminderTime || '12:00';
    if (freqInp) freqInp.value = item.reminderFreq || 'Setiap Minggu';
    if (activeInp) activeInp.checked = item.reminderEnabled !== false;

    document.getElementById('modalReminder')?.classList.remove('hidden');
}

function closeModalReminder() {
    document.getElementById('modalReminder')?.classList.add('hidden');
}

async function handleSaveReminder(e) {
    if (e) e.preventDefault();
    if (!currentDetailId) return;

    const isValid = await validateUserSession();
    if (!isValid) return;

    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    const timeVal = document.getElementById('inputReminderTime')?.value || '12:00';
    const freqVal = document.getElementById('inputReminderFreq')?.value || 'Setiap Minggu';
    const isEnabled = document.getElementById('inputReminderActive')?.checked !== false;

    item.reminderTime = timeVal;
    item.reminderFreq = freqVal;
    item.reminderEnabled = isEnabled;

    if (isEnabled && "Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                sendBrowserNotification("Pengingat Aktif! ⏰", `Pengingat untuk "${item.title}" diatur jam ${timeVal}`);
            }
        });
    }

    saveStorage();
    closeModalReminder();
    openDetailView(item.id);
    showToast(isEnabled ? "Pengingat disimpan & aktif ⏰" : "Pengingat disimpan (nonaktif)");
}

function toggleReminderState(enabled) {
    if (!currentDetailId) return;
    const item = savingsData.find(s => s.id === currentDetailId);
    if (!item) return;

    item.reminderEnabled = enabled;
    saveStorage();
    showToast(enabled ? "Pengingat diaktifkan ⏰" : "Pengingat dinonaktifkan");
}

function confirmDeleteSavings() {
    document.getElementById('modalConfirmDelete')?.classList.remove('hidden');
}

function closeConfirmDelete() {
    document.getElementById('modalConfirmDelete')?.classList.add('hidden');
}

async function executeDeleteSavings() {
    if (!currentDetailId) return;

    const isValid = await validateUserSession();
    if (!isValid) return;

    savingsData = savingsData.filter(s => s.id !== currentDetailId);
    saveStorage();
    closeConfirmDelete();
    showView('home');
    showToast("Celengan berhasil dihapus");
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (toastMsg) toastMsg.innerText = msg;
    if (toast) {
        toast.classList.remove('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            toast.classList.add('opacity-0', 'pointer-events-none');
        }, 2500);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// PENGATURAN FONT & TEMA WARNA
function initFontAndColor() {
    changeFont(currentFont, false);
    changeAccentColor(currentAccentColor, false);
}

function changeFont(fontName, notify = true) {
    currentFont = fontName;
    localStorage.setItem('tabungin_font', fontName);

    document.body.classList.remove('font-sans', 'font-serif', 'font-mono');
    if (fontName === 'serif') document.body.classList.add('font-serif');
    else if (fontName === 'mono') document.body.classList.add('font-mono');
    else document.body.classList.add('font-sans');

    const btnSans = document.getElementById('btnFontSans');
    const btnSerif = document.getElementById('btnFontSerif');
    const btnMono = document.getElementById('btnFontMono');

    const activeClass = "flex-1 py-1 rounded-lg text-[10px] font-medium bg-white dark:bg-[#282838] text-theme-accent shadow transition";
    const inactiveClass = "flex-1 py-1 rounded-lg text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition";

    if (btnSans) btnSans.className = fontName === 'sans' ? activeClass + " font-sans" : inactiveClass + " font-sans";
    if (btnSerif) btnSerif.className = fontName === 'serif' ? activeClass + " font-serif" : inactiveClass + " font-serif";
    if (btnMono) btnMono.className = fontName === 'mono' ? activeClass + " font-mono" : inactiveClass + " font-mono";

    if (notify) showToast(`Font diubah ke ${fontName}`);
}

function changeAccentColor(color, notify = true) {
    currentAccentColor = color;
    localStorage.setItem('tabungin_accent_color', color);

    const colorMap = {
        blue: { main: '#3b82f6', hover: '#2563eb', lightBg: 'rgba(59, 130, 246, 0.15)' },
        red: { main: '#f43f5e', hover: '#e11d48', lightBg: 'rgba(244, 63, 94, 0.15)' },
        yellow: { main: '#f59e0b', hover: '#d97706', lightBg: 'rgba(245, 158, 11, 0.15)' },
        green: { main: '#10b981', hover: '#059669', lightBg: 'rgba(16, 185, 129, 0.15)' }
    };

    const activeColor = colorMap[color] || colorMap.blue;

    document.documentElement.style.setProperty('--accent-color', activeColor.main);
    document.documentElement.style.setProperty('--accent-hover', activeColor.hover);
    document.documentElement.style.setProperty('--accent-light-bg', activeColor.lightBg);

    const circles = document.querySelectorAll('circle#detailCircleProgress, svg circle.text-theme-accent');
    circles.forEach(circle => {
        circle.setAttribute('stroke', activeColor.main);
    });

    if (savingsChartInstance) {
        savingsChartInstance.data.datasets[0].borderColor = activeColor.main;
        savingsChartInstance.data.datasets[0].pointBackgroundColor = activeColor.main;
        savingsChartInstance.update();
    }

    const colorBtns = {
        blue: document.getElementById('btnColorBlue'),
        red: document.getElementById('btnColorRed'),
        yellow: document.getElementById('btnColorYellow'),
        green: document.getElementById('btnColorGreen')
    };

    Object.keys(colorBtns).forEach(key => {
        const btn = colorBtns[key];
        if (btn) {
            btn.innerHTML = key === color ? `<i class="fa-solid fa-check text-white text-[10px]"></i>` : ``;
        }
    });

    if (notify) showToast(`Warna tema diubah ke ${color}`);
}

// TEMA GELAP / TERANG / SISTEM
function initTheme() {
    const savedTheme = localStorage.getItem('app_theme') || 'system';
    applyTheme(savedTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((localStorage.getItem('app_theme') || 'system') === 'system') {
            applyTheme('system');
        }
    });
}

function cycleTheme() {
    const currentTheme = localStorage.getItem('app_theme') || 'system';
    let nextTheme = 'system';

    if (currentTheme === 'system') nextTheme = 'light';
    else if (currentTheme === 'light') nextTheme = 'dark';
    else if (currentTheme === 'dark') nextTheme = 'system';

    localStorage.setItem('app_theme', nextTheme);
    applyTheme(nextTheme);

    const labels = { system: 'Ikuti Perangkat', light: 'Mode Terang', dark: 'Mode Gelap' };
    showToast(`Tema: ${labels[nextTheme]}`);
}

function toggleDarkMode() {
    cycleTheme();
}

function applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    updateThemeUI(theme);
}

function updateThemeUI(theme) {
    const menuIconElem = document.getElementById('menuThemeIcon');
    const menuLabelElem = document.getElementById('menuThemeLabel');

    if (menuIconElem && menuLabelElem) {
        if (theme === 'system') {
            menuIconElem.className = 'fa-solid fa-circle-half-stroke text-blue-500 dark:text-blue-400 text-sm';
            menuLabelElem.innerText = 'Sistem';
        } else if (theme === 'light') {
            menuIconElem.className = 'fa-solid fa-sun text-amber-500 text-sm';
            menuLabelElem.innerText = 'Terang';
        } else if (theme === 'dark') {
            menuIconElem.className = 'fa-solid fa-moon text-indigo-400 text-sm';
            menuLabelElem.innerText = 'Gelap';
        }
    }

    const iconElem = document.getElementById('themeIcon');
    const moonIcon = document.getElementById('themeMoonIcon');
    const sunIcon = document.getElementById('themeSunIcon');

    if (iconElem) {
        if (theme === 'system') iconElem.className = 'fa-solid fa-desktop text-sm';
        else if (theme === 'dark') iconElem.className = 'fa-solid fa-moon text-sm';
        else iconElem.className = 'fa-solid fa-sun text-sm';
    }

    if (moonIcon && sunIcon) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
        moonIcon.classList.toggle('hidden', isDark);
        sunIcon.classList.toggle('hidden', !isDark);
    }
}
