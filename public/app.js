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

let soundEnabled = localStorage.getItem('aurachat_sound') !== 'false';
let currentReplyContext = null;
let typingTimeout = null;
let isCurrentlyTyping = false;

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

// DOM Elements
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
function init() {
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
}

// Setup Event Listeners
function setupEventListeners() {
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

        // Emit join
        socket.emit('user:join', {
            username: currentUser.username,
            avatar: currentUser.avatar,
            room: currentUser.room
        });

        // Update UI
        myAvatarDisplay.textContent = currentUser.avatar;
        myUsernameDisplay.textContent = currentUser.username;
        loginOverlay.classList.add('hidden');
        chatApp.classList.remove('hidden');

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
    }
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
