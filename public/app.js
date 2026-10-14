/* =========================================================
   AuraChat - Client Application Logic (Socket.IO + WebAudio)
   ========================================================= */

// Connect to Socket.IO
const socket = io();

// State
let currentUser = {
    username: localStorage.getItem('aurachat_username') || '',
    avatar: localStorage.getItem('aurachat_avatar') || '🦊',
    room: 'phong-chung'
};

let authToken = localStorage.getItem('aurachat_auth_token') || sessionStorage.getItem('aurachat_auth_token') || '';
let soundEnabled = localStorage.getItem('aurachat_sound') !== 'false';
let currentReplyContext = null;
let typingTimeout = null;
let isCurrentlyTyping = false;
let unreadCount = 0;
const originalDocumentTitle = document.title;
let deferredInstallPrompt = null;
let swRegistration = null;

// Audio Synthesizer (Zero external file dependencies)
const soundEffects = {
    playMessageSend() {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {}
    },
    playMessageReceive() {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(660, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.07);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
        } catch (e) {}
    },
    playNotification() {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(554, ctx.currentTime + 0.06);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {}
    }
};

// DOM Elements - App Lock Screen
const appLockOverlay = document.getElementById('appLockOverlay');
const appLockForm = document.getElementById('appLockForm');
const appPasswordInput = document.getElementById('appPasswordInput');
const togglePasswordVisibilityBtn = document.getElementById('togglePasswordVisibilityBtn');
const rememberAuthCheckbox = document.getElementById('rememberAuthCheckbox');
const lockErrorMsg = document.getElementById('lockErrorMsg');
const lockErrorText = document.getElementById('lockErrorText');
const unlockAppBtn = document.getElementById('unlockAppBtn');
const lockAppBtn = document.getElementById('lockAppBtn');

// DOM Elements - PWA & Notifications
const notifToggleBtn = document.getElementById('notifToggleBtn');
const notifIcon = document.getElementById('notifIcon');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
const iosInstallBanner = document.getElementById('iosInstallBanner');
const closeIosBannerBtn = document.getElementById('closeIosBannerBtn');

// DOM Elements - Main Chat
const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const roomSelect = document.getElementById('roomSelect');
const customRoomInput = document.getElementById('customRoomInput');
const avatarSelector = document.getElementById('avatarSelector');

const chatApp = document.getElementById('chatApp');
const chatSidebar = document.getElementById('chatSidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

const currentRoomNameEl = document.getElementById('currentRoomName');
const currentRoomDescEl = document.getElementById('currentRoomDesc');
const welcomeRoomNameEl = document.getElementById('welcomeRoomName');
const roomsListEl = document.getElementById('roomsList');
const usersListEl = document.getElementById('usersList');
const userCountEl = document.getElementById('userCount');

const myAvatarDisplay = document.getElementById('myAvatarDisplay');
const myUsernameDisplay = document.getElementById('myUsernameDisplay');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const logoutBtn = document.getElementById('logoutBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const quickCreateRoomBtn = document.getElementById('quickCreateRoomBtn');

const messagesContainer = document.getElementById('messagesContainer');
const messagesList = document.getElementById('messagesList');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');

const replyBar = document.getElementById('replyBar');
const replyAuthor = document.getElementById('replyAuthor');
const replySnippet = document.getElementById('replySnippet');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');

const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const imageUploadInput = document.getElementById('imageUploadInput');
const emojiToggleBtn = document.getElementById('emojiToggleBtn');
const emojiPicker = document.getElementById('emojiPicker');
const closeEmojiBtn = document.getElementById('closeEmojiBtn');
const emojiGrid = document.getElementById('emojiGrid');

const imageModal = document.getElementById('imageModal');
const modalPreviewImg = document.getElementById('modalPreviewImg');
const closeImageModalBtn = document.getElementById('closeImageModalBtn');
const imageModalBackdrop = document.getElementById('imageModalBackdrop');
const toastContainer = document.getElementById('toastContainer');

// Predefined Emoji Sets
const EMOJI_SETS = {
    faces: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😎', '🤓', '🧐', '🥳', '😏', '🤔', '🤫', '🥱', '😴', '🤤', '🤠', '🥺', '😭', '😤', '😡', '🤯', '😱', '🥶', '🥵'],
    hands: ['👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💖', '💗', '💓', '💞', '💕', '💌', '💘', '💝', '✨', '⭐', '🌟', '💫', '💥', '🔥'],
    items: ['☕', '🍕', '🎉', '🏆', '🚀', '💡', '💻', '🎮', '📱', '🔔', '🎵', '🎶', '🌈', '⚡', '🌙', '☀️', '🍻', '🎈', '🎁', '🎯', '💯']
};

const ROOM_DESCRIPTIONS = {
    'phong-chung': 'Phòng sảnh chung để chào hỏi và trò chuyện tự do',
    'cong-nghe': 'Giao lưu lập trình, AI, công nghệ và thủ thuật số',
    'chem-gio': 'Không gian chém gió, tán gẫu thả ga không giới hạn',
    'hoc-tap': 'Cùng học tập, chia sẻ tài liệu và giải đáp bài vở'
};

// =========================================================
// Initialization
// =========================================================
async function init() {
    // Fill saved username if exists
    if (currentUser.username) {
        usernameInput.value = currentUser.username;
    }

    // Set saved avatar in avatar grid
    const avatarBtns = avatarSelector.querySelectorAll('.avatar-btn');
    avatarBtns.forEach(btn => {
        if (btn.dataset.avatar === currentUser.avatar) {
            avatarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    });

    // Update sound icon
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';

    // Build emoji grid
    loadEmojis('faces');

    // Setup event listeners
    setupEventListeners();

    // Setup PWA & Service Worker
    setupServiceWorkerAndPWA();

    // Verify authentication
    await checkAuthentication();

    // Update notification status UI
    updateNotificationButtonUI();
}

// =========================================================
// Authentication & Security (Mật khẩu truy cập)
// =========================================================
async function checkAuthentication() {
    if (!authToken) {
        showLockOverlay();
        return false;
    }

    try {
        const response = await fetch('/api/auth/check', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();

        if (data.authenticated) {
            hideLockOverlay();
            return true;
        } else {
            authToken = '';
            localStorage.removeItem('aurachat_auth_token');
            sessionStorage.removeItem('aurachat_auth_token');
            showLockOverlay();
            return false;
        }
    } catch (e) {
        // If offline or network issue, trust token format temporarily
        if (authToken && authToken.includes('.')) {
            hideLockOverlay();
            return true;
        }
        showLockOverlay();
        return false;
    }
}

function showLockOverlay() {
    appLockOverlay.classList.remove('hidden');
    appPasswordInput.focus();
}

function hideLockOverlay() {
    appLockOverlay.classList.add('hidden');
    lockErrorMsg.classList.add('hidden');
}

function lockApplication() {
    authToken = '';
    localStorage.removeItem('aurachat_auth_token');
    sessionStorage.removeItem('aurachat_auth_token');
    chatApp.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    appPasswordInput.value = '';
    showLockOverlay();
    showToast('Ứng dụng đã được khóa bảo mật');
}

// =========================================================
// PWA & Web Push Notification System
// =========================================================
const BELL_ICON_SVG = `<svg class="header-btn-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
const BELL_MUTED_SVG = `<svg class="header-btn-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

function setupServiceWorkerAndPWA() {
    // 1. Register Service Worker reliably
    if ('serviceWorker' in navigator) {
        const doRegister = () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    swRegistration = reg;
                    console.log('✅ Service Worker đã kích hoạt cho AuraChat PWA');
                    if (Notification.permission === 'granted') {
                        subscribeToPushNotifications().catch(() => {});
                    }
                })
                .catch(err => {
                    console.warn('⚠️ Service Worker không thể đăng ký:', err);
                });
        };

        if (document.readyState === 'complete') {
            doRegister();
        } else {
            window.addEventListener('load', doRegister);
        }
    }

    // 2. Before Install Prompt (Android & Desktop)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (pwaInstallBtn) {
            pwaInstallBtn.classList.remove('hidden');
        }
    });

    window.addEventListener('appinstalled', () => {
        if (pwaInstallBtn) pwaInstallBtn.classList.add('hidden');
        showToast('🎉 Đã cài đặt AuraChat vào màn hình chính thiết bị!');
        deferredInstallPrompt = null;
    });

    // 3. iOS Add to Home Screen Banner Detection
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
    const dismissedIos = localStorage.getItem('aurachat_ios_dismissed');

    if (isIos && !isStandalone && !dismissedIos && iosInstallBanner) {
        setTimeout(() => {
            iosInstallBanner.classList.remove('hidden');
        }, 2000);
    }

    if (closeIosBannerBtn) {
        closeIosBannerBtn.addEventListener('click', () => {
            iosInstallBanner.classList.add('hidden');
            localStorage.setItem('aurachat_ios_dismissed', 'true');
        });
    }

    // 4. Tab Visibility & Unread Title Badge
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            unreadCount = 0;
            document.title = originalDocumentTitle;
        }
    });
    window.addEventListener('focus', () => {
        unreadCount = 0;
        document.title = originalDocumentTitle;
    });
}

function updateNotificationButtonUI() {
    if (!notifToggleBtn) return;

    if (!('Notification' in window)) {
        notifToggleBtn.style.display = 'none';
        return;
    }
    notifToggleBtn.style.display = 'inline-flex';

    if (Notification.permission === 'granted') {
        notifToggleBtn.classList.add('active');
        if (notifIcon) notifIcon.innerHTML = BELL_ICON_SVG;
        notifToggleBtn.title = 'Thông báo đẩy: ĐANG BẬT (Tin nhắn báo cả khi tắt app - Bấm để test)';
    } else if (Notification.permission === 'denied') {
        notifToggleBtn.classList.remove('active');
        if (notifIcon) notifIcon.innerHTML = BELL_MUTED_SVG;
        notifToggleBtn.title = 'Thông báo đang bị chặn trong trình duyệt (Bấm biểu tượng ổ khóa để bật lại)';
    } else {
        notifToggleBtn.classList.remove('active');
        if (notifIcon) notifIcon.innerHTML = BELL_ICON_SVG;
        notifToggleBtn.title = 'Bấm để BẬT thông báo đẩy (nhận tin cả khi tắt app)';
    }
}

// Chuyển đổi VAPID public key định dạng Base64 sang Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Đăng ký Web Push với Service Worker & gửi Token lên Server (chạy cả khi tắt hẳn app)
async function subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }

    try {
        // Dùng Promise.race để không bao giờ bị treo cứng nếu SW chưa sẵn sàng
        const regTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('SW Timeout')), 3000));
        const reg = await Promise.race([navigator.serviceWorker.ready, regTimeout]);
        swRegistration = reg;

        // 1. Lấy VAPID public key từ máy chủ
        const res = await fetch('/api/push/vapid-public-key');
        const data = await res.json();
        if (!data || !data.publicKey) return;

        // 2. Kiểm tra subscription hiện có hoặc tạo subscription mới
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(data.publicKey)
            });
        }

        // 3. Gửi Push Subscription lên server để lưu lại
        if (sub) {
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: sub,
                    username: currentUser.username || 'Người dùng',
                    room: currentUser.room || 'phong-chung',
                    authToken: authToken
                })
            });
            console.log('✅ Đã đăng ký Web Push thành công trên máy chủ AuraChat');
        }
    } catch (err) {
        console.warn('Đăng ký Web Push chưa hoàn tất (sẽ thử lại sau):', err.message);
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('Trình duyệt này không hỗ trợ Web Notification');
        return;
    }

    if (Notification.permission === 'granted') {
        updateNotificationButtonUI();
        // Đảm bảo Web Push subscription được đồng bộ ngầm
        subscribeToPushNotifications().catch(() => {});
        triggerDesktopNotification('AuraChat 🔔', 'Hệ thống thông báo đẩy (kể cả khi tắt app) đang hoạt động!', null);
        showToast('Thông báo đẩy đang BẬT! Bạn sẽ nhận tin nhắn ngay cả khi tắt app.');
        return;
    }

    if (Notification.permission === 'denied') {
        alert('Thông báo đang bị chặn. Vui lòng vào Cài đặt trình duyệt (icon ổ khóa trên thanh địa chỉ) -> chọn Cho phép thông báo.');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        updateNotificationButtonUI();
        if (permission === 'granted') {
            subscribeToPushNotifications().catch(() => {});
            triggerDesktopNotification('AuraChat 🎉', 'Đã bật thông báo thành công! Tin nhắn sẽ đến cả khi tắt app.', null);
            showToast('Đã kích hoạt thông báo đẩy (nhận tin cả khi tắt app)!');
        } else {
            showToast('Bạn đã từ chối nhận thông báo');
        }
    } catch (e) {
        console.error('Lỗi khi xin quyền thông báo:', e);
    }
}

function triggerDesktopNotification(title, bodyText, image) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
        body: bodyText,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'aurachat-new-message',
        vibrate: [150, 80, 150],
        renotify: true,
        data: { url: '/' }
    };

    // Try service worker notification first (native mobile feel)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: title,
            options: options
        });
    } else if (swRegistration && swRegistration.showNotification) {
        swRegistration.showNotification(title, options).catch(() => {
            try { new Notification(title, options); } catch (e) {}
        });
    } else {
        try {
            new Notification(title, options);
        } catch (e) {}
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // 0. App Lock Screen Submit
    if (appLockForm) {
        appLockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = appPasswordInput.value.trim();
            if (!password) return;

            unlockAppBtn.disabled = true;
            unlockAppBtn.classList.add('loading');

            try {
                const res = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await res.json();
                unlockAppBtn.disabled = false;
                unlockAppBtn.classList.remove('loading');

                if (data.success && data.token) {
                    authToken = data.token;
                    if (rememberAuthCheckbox.checked) {
                        localStorage.setItem('aurachat_auth_token', authToken);
                    } else {
                        sessionStorage.setItem('aurachat_auth_token', authToken);
                    }

                    hideLockOverlay();
                    showToast('Đã mở khóa AuraChat thành công!');

                    // If user already logged in with nickname
                    if (currentUser.username) {
                        usernameInput.value = currentUser.username;
                    }
                } else {
                    lockErrorText.textContent = data.message || 'Mật khẩu không chính xác!';
                    lockErrorMsg.classList.remove('hidden');
                    appPasswordInput.value = '';
                    appPasswordInput.focus();
                }
            } catch (err) {
                unlockAppBtn.disabled = false;
                unlockAppBtn.classList.remove('loading');
                lockErrorText.textContent = 'Lỗi kết nối máy chủ. Vui lòng thử lại!';
                lockErrorMsg.classList.remove('hidden');
            }
        });
    }

    // Toggle Password Visibility
    if (togglePasswordVisibilityBtn && appPasswordInput) {
        togglePasswordVisibilityBtn.addEventListener('click', () => {
            const isPassword = appPasswordInput.type === 'password';
            appPasswordInput.type = isPassword ? 'text' : 'password';
            togglePasswordVisibilityBtn.textContent = isPassword ? '🙈' : '👁️';
        });
    }

    // Lock App Button
    if (lockAppBtn) {
        lockAppBtn.addEventListener('click', () => {
            lockApplication();
        });
    }

    // PWA Install Button Click
    if (pwaInstallBtn) {
        pwaInstallBtn.addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                const { outcome } = await deferredInstallPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('Đang tiến hành cài đặt AuraChat...');
                }
                deferredInstallPrompt = null;
                pwaInstallBtn.classList.add('hidden');
            } else {
                showToast('Để cài đặt: mở menu trình duyệt và chọn "Cài đặt ứng dụng"');
            }
        });
    }

    // Notification Permission Toggle
    if (notifToggleBtn) {
        notifToggleBtn.addEventListener('click', () => {
            requestNotificationPermission();
        });
    }

    // Avatar selection
    avatarSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.avatar-btn');
        if (!btn) return;
        avatarSelector.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentUser.avatar = btn.dataset.avatar;
    });

    // Login Form Submit
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (!username) return;

        currentUser.username = username;
        localStorage.setItem('aurachat_username', username);
        localStorage.setItem('aurachat_avatar', currentUser.avatar);

        const customRoom = customRoomInput.value.trim();
        const targetRoom = customRoom ? customRoom : roomSelect.value;
        currentUser.room = targetRoom;

        // Emit join with authToken
        socket.emit('user:join', {
            username: currentUser.username,
            avatar: currentUser.avatar,
            room: currentUser.room,
            authToken: authToken
        });

        // Update UI
        myAvatarDisplay.textContent = currentUser.avatar;
        myUsernameDisplay.textContent = currentUser.username;
        loginOverlay.classList.add('hidden');
        chatApp.classList.remove('hidden');

        if (Notification.permission === 'granted') {
            subscribeToPushNotifications();
        }

        messageInput.focus();
    });

    // Sound toggle
    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('aurachat_sound', soundEnabled);
        soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
        showToast(soundEnabled ? 'Đã bật âm thanh thông báo' : 'Đã tắt âm thanh thông báo');
    });

    // Logout / Change Room
    logoutBtn.addEventListener('click', () => {
        loginOverlay.classList.remove('hidden');
    });

    // Clear Chat
    clearChatBtn.addEventListener('click', () => {
        if (confirm('Làm sạch màn hình hiển thị tin nhắn hiện tại?')) {
            messagesList.innerHTML = '';
            showToast('Đã dọn dẹp màn hình chat');
        }
    });

    // Send Message Button
    sendMessageBtn.addEventListener('click', handleSendMessage);

    // Textarea input and keydowns
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        } else {
            handleTyping();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });

    // Image Upload
    imageUploadInput.addEventListener('change', handleImageUpload);

    // Emoji Picker toggles
    emojiToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('hidden');
    });
    closeEmojiBtn.addEventListener('click', () => {
        emojiPicker.classList.add('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiToggleBtn) {
            emojiPicker.classList.add('hidden');
        }
    });

    // Emoji tabs
    document.querySelectorAll('.emoji-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadEmojis(tab.dataset.cat);
        });
    });

    // Cancel reply
    cancelReplyBtn.addEventListener('click', clearReplyContext);

    // Quick create room button
    quickCreateRoomBtn.addEventListener('click', () => {
        const name = prompt('Nhập tên phòng mới muốn tạo (vd: game-dem, chia-se-nhac):');
        if (name && name.trim()) {
            const cleanRoom = name.trim().toLowerCase().replace(/\s+/g, '-');
            switchRoom(cleanRoom);
        }
    });

    // Mobile Sidebar toggle
    openSidebarBtn.addEventListener('click', () => {
        chatSidebar.classList.add('open');
    });
    closeSidebarBtn.addEventListener('click', () => {
        chatSidebar.classList.remove('open');
    });

    // Image Modal close
    closeImageModalBtn.addEventListener('click', () => imageModal.classList.add('hidden'));
    imageModalBackdrop.addEventListener('click', () => imageModal.classList.add('hidden'));
}

// Load Emojis
function loadEmojis(category) {
    const list = EMOJI_SETS[category] || EMOJI_SETS.faces;
    emojiGrid.innerHTML = '';
    list.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn-item';
        btn.textContent = emoji;
        btn.addEventListener('click', () => {
            insertTextAtCursor(messageInput, emoji);
            messageInput.focus();
        });
        emojiGrid.appendChild(btn);
    });
}

function insertTextAtCursor(input, text) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + text + input.value.substring(end);
    input.selectionStart = input.selectionEnd = start + text.length;
}

// =========================================================
// Messaging Operations
// =========================================================
function handleSendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    socket.emit('chat:message', {
        text: text,
        replyTo: currentReplyContext
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    clearReplyContext();

    // Stop typing indicator immediately
    if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        socket.emit('chat:typing', { isTyping: false });
    }

    soundEffects.playMessageSend();
    messageInput.focus();
}

function handleTyping() {
    if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        socket.emit('chat:typing', { isTyping: true });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isCurrentlyTyping = false;
        socket.emit('chat:typing', { isTyping: false });
    }, 1500);
}

// Compress and upload image
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP, GIF)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Resize image if max dimension > 1200
            const maxDim = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);

            socket.emit('chat:message', {
                text: '',
                image: compressedBase64,
                replyTo: currentReplyContext
            });

            clearReplyContext();
            soundEffects.playMessageSend();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
}

// Reply context
function setReplyContext(msg) {
    currentReplyContext = {
        id: msg.id,
        author: msg.username,
        text: msg.text || (msg.image ? '[Hình ảnh]' : '')
    };
    replyAuthor.textContent = currentReplyContext.author;
    replySnippet.textContent = currentReplyContext.text;
    replyBar.classList.remove('hidden');
    messageInput.focus();
}

function clearReplyContext() {
    currentReplyContext = null;
    replyBar.classList.add('hidden');
}

// Switch Room
function switchRoom(newRoom) {
    if (newRoom === currentUser.room) return;
    currentUser.room = newRoom;
    socket.emit('room:switch', { newRoom });
    chatSidebar.classList.remove('open');
    if (Notification.permission === 'granted') {
        subscribeToPushNotifications();
    }
}

// =========================================================
// Rendering Messages & UI
// =========================================================
function renderMessage(msg, isMine = false) {
    const row = document.createElement('div');
    row.className = `message-row ${isMine ? 'mine' : ''}`;
    row.id = `msg-el-${msg.id}`;

    // Reply reference block if any
    let replyRefHtml = '';
    if (msg.replyTo) {
        replyRefHtml = `
            <div class="msg-reply-ref" title="Đang trả lời ${escapeHtml(msg.replyTo.author)}">
                <span>↩ Trả lời <strong>@${escapeHtml(msg.replyTo.author)}</strong>: ${escapeHtml(msg.replyTo.text)}</span>
            </div>
        `;
    }

    // Image block if any
    let imageHtml = '';
    if (msg.image) {
        imageHtml = `<img src="${msg.image}" class="msg-image" alt="Đã tải lên" onclick="openImageModal('${msg.image}')">`;
    }

    // Text block
    let textHtml = '';
    if (msg.text) {
        textHtml = `<div>${formatMessageText(msg.text)}</div>`;
    }

    row.innerHTML = `
        <div class="msg-avatar" title="${escapeHtml(msg.username)}">${escapeHtml(msg.avatar || '👤')}</div>
        <div class="msg-content-wrap">
            <div class="msg-header">
                <span class="msg-author">${escapeHtml(msg.username)}</span>
                <span class="msg-time">${msg.time}</span>
            </div>
            ${replyRefHtml}
            <div class="msg-bubble">
                ${textHtml}
                ${imageHtml}
            </div>
            <div class="msg-reactions" id="reactions-${msg.id}"></div>
        </div>
        <div class="msg-actions">
            <button class="msg-action-btn" title="Trả lời" onclick="triggerReply('${msg.id}')">↩</button>
            <button class="msg-action-btn" title="Thả tim" onclick="triggerReaction('${msg.id}', '❤️')">❤️</button>
            <button class="msg-action-btn" title="Haha" onclick="triggerReaction('${msg.id}', '😂')">😂</button>
            <button class="msg-action-btn" title="Like" onclick="triggerReaction('${msg.id}', '👍')">👍</button>
        </div>
    `;

    // Store raw data on element
    row._msgData = msg;
    messagesList.appendChild(row);
    scrollToBottom();
}

function renderSystemNotice(notice) {
    const row = document.createElement('div');
    row.className = 'system-row';
    row.innerHTML = `
        <span>${escapeHtml(notice.text)}</span>
        <span style="opacity: 0.6; font-size: 11px;">${notice.time}</span>
    `;
    messagesList.appendChild(row);
    scrollToBottom();
}

function updateRoomsList(rooms) {
    roomsListEl.innerHTML = '';
    const uniqueRooms = Array.from(new Set(['phong-chung', 'cong-nghe', 'chem-gio', 'hoc-tap', ...rooms]));

    uniqueRooms.forEach(room => {
        const li = document.createElement('li');
        li.className = `room-item ${room === currentUser.room ? 'active' : ''}`;
        li.innerHTML = `<span class="hash">#</span> <span>${escapeHtml(room)}</span>`;
        li.addEventListener('click', () => switchRoom(room));
        roomsListEl.appendChild(li);
    });
}

function updateUsersList(users) {
    usersListEl.innerHTML = '';
    userCountEl.textContent = users.length;

    users.forEach(u => {
        const isSelf = u.id === socket.id;
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
            <div class="user-avatar-small">${escapeHtml(u.avatar || '👤')}</div>
            <span class="user-name-text">${escapeHtml(u.username)}</span>
            ${isSelf ? '<span class="user-badge-you">Bạn</span>' : ''}
        `;
        usersListEl.appendChild(li);
    });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessageText(text) {
    let clean = escapeHtml(text);
    // Linkify urls
    const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    clean = clean.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--primary-light); text-decoration: underline;">$1</a>');
    return clean.replace(/\n/g, '<br>');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Global action handlers accessible by inline onclick
window.triggerReply = function(msgId) {
    const el = document.getElementById(`msg-el-${msgId}`);
    if (el && el._msgData) {
        setReplyContext(el._msgData);
    }
};

window.triggerReaction = function(msgId, emoji) {
    socket.emit('chat:react', { messageId: msgId, emoji });
};

window.openImageModal = function(src) {
    modalPreviewImg.src = src;
    imageModal.classList.remove('hidden');
};

function showToast(text) {
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<span>✨</span><span>${escapeHtml(text)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
}

// =========================================================
// Socket.IO Event Handlers
// =========================================================
socket.on('room:joined', ({ room, history, users, rooms }) => {
    currentUser.room = room;
    currentRoomNameEl.textContent = room;
    welcomeRoomNameEl.textContent = room;
    currentRoomDescEl.textContent = ROOM_DESCRIPTIONS[room] || `Kênh trò chuyện #${room}`;

    // Clear and re-populate messages
    messagesList.innerHTML = '';
    history.forEach(msg => {
        renderMessage(msg, msg.userId === socket.id);
    });

    updateUsersList(users);
    updateRoomsList(rooms);
    scrollToBottom();
});

socket.on('chat:message', (msg) => {
    const isMine = msg.userId === socket.id;
    renderMessage(msg, isMine);

    if (!isMine) {
        soundEffects.playMessageReceive();

        // If tab is inactive or document hidden: Trigger system notification
        if (document.hidden || !document.hasFocus()) {
            unreadCount++;
            document.title = `(${unreadCount}) 💬 ${msg.username}: ${msg.text ? msg.text.slice(0, 30) : 'Hình ảnh'}`;
            
            triggerDesktopNotification(
                `${msg.avatar} ${msg.username} (#${currentUser.room})`,
                msg.text || (msg.image ? '📷 [Đã gửi một hình ảnh]' : 'Tin nhắn mới'),
                msg.image
            );
        }
    }
});

socket.on('auth:required', (err) => {
    lockApplication();
    showToast(err.message || 'Phiên truy cập đã hết hạn hoặc chưa xác thực!');
});

socket.on('system:notification', (notice) => {
    renderSystemNotice(notice);
    soundEffects.playNotification();
});

socket.on('room:users', (users) => {
    updateUsersList(users);
});

socket.on('rooms:updated', (rooms) => {
    updateRoomsList(rooms);
});

socket.on('chat:typing', ({ userId, username, avatar, isTyping }) => {
    if (isTyping) {
        typingText.textContent = `${avatar} ${username} đang nhập tin nhắn...`;
        typingIndicator.classList.remove('hidden');
        scrollToBottom();
    } else {
        typingIndicator.classList.add('hidden');
    }
});

socket.on('chat:reaction_updated', ({ messageId, emoji, username }) => {
    const container = document.getElementById(`reactions-${messageId}`);
    if (!container) return;

    let pill = container.querySelector(`[data-emoji="${emoji}"]`);
    if (pill) {
        let countEl = pill.querySelector('.count');
        let count = parseInt(countEl.textContent, 10) + 1;
        countEl.textContent = count;
    } else {
        pill = document.createElement('div');
        pill.className = 'reaction-pill';
        pill.dataset.emoji = emoji;
        pill.innerHTML = `<span>${emoji}</span> <span class="count">1</span>`;
        container.appendChild(pill);
    }
});

// Launch
init();
