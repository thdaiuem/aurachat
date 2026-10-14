const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const webpush = require('web-push');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 5e6 // 5MB limit for inline images
});

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '123456';
const AUTH_SECRET = process.env.AUTH_SECRET || 'aurachat-auth-secret-key-2026';

// =========================================================
// Web Push & VAPID Setup
// =========================================================
const VAPID_FILE = path.join(__dirname, 'vapid-keys.json');
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@aurachat.local';

if (!vapidPublicKey || !vapidPrivateKey) {
    if (fs.existsSync(VAPID_FILE)) {
        try {
            const keys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
            vapidPublicKey = keys.publicKey;
            vapidPrivateKey = keys.privateKey;
        } catch (e) {
            console.error('Lỗi khi đọc vapid-keys.json:', e);
        }
    }
}

if (!vapidPublicKey || !vapidPrivateKey) {
    const keys = webpush.generateVAPIDKeys();
    vapidPublicKey = keys.publicKey;
    vapidPrivateKey = keys.privateKey;
    try {
        fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf8');
        console.log('🔑 Đã tạo và lưu VAPID keys vào vapid-keys.json');
    } catch (e) {}
}

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

// Push Subscriptions storage
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'subscriptions.json');
let pushSubscriptions = {};

function loadSubscriptions() {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
        try {
            pushSubscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8')) || {};
        } catch (e) {
            pushSubscriptions = {};
        }
    }
}

function saveSubscriptions() {
    try {
        fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions, null, 2), 'utf8');
    } catch (e) {}
}

loadSubscriptions();

// Helper: Gửi thông báo đẩy khi có tin nhắn mới (chạy cả khi tắt app)
function sendWebPushNotification(senderUsername, senderAvatar, room, text, hasImage) {
    const payload = JSON.stringify({
        title: `${senderAvatar} ${senderUsername} (#${room})`,
        body: text ? (text.length > 80 ? text.slice(0, 77) + '...' : text) : '📷 [Đã gửi một hình ảnh]',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `aurachat-room-${room}`,
        data: { url: `/?room=${room}` }
    });

    const endpointsToRemove = [];
    const promises = [];

    for (const [endpoint, subInfo] of Object.entries(pushSubscriptions)) {
        // Không gửi thông báo đẩy cho chính người vừa gửi tin nhắn
        if (subInfo.username === senderUsername) continue;

        // Nếu người dùng đăng ký theo phòng riêng và phòng đó khác phòng hiện tại thì bỏ qua
        if (subInfo.room && subInfo.room !== room) continue;

        promises.push(
            webpush.sendNotification(subInfo.subscription, payload)
                .catch((err) => {
                    // 404 hoặc 410 nghĩa là subscription đã hết hạn hoặc người dùng gỡ cài đặt app
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        endpointsToRemove.push(endpoint);
                    } else {
                        console.error('Web Push thất bại với endpoint:', err.statusCode || err.message);
                    }
                })
        );
    }

    if (promises.length > 0) {
        Promise.all(promises).then(() => {
            if (endpointsToRemove.length > 0) {
                endpointsToRemove.forEach(ep => delete pushSubscriptions[ep]);
                saveSubscriptions();
            }
        });
    }
}

// Token generation & verification
function createAuthToken() {
    const timestamp = Date.now();
    const signature = crypto.createHmac('sha256', AUTH_SECRET)
        .update(`aurachat-auth:${timestamp}`)
        .digest('hex');
    return `${timestamp}.${signature}`;
}

function verifyAuthToken(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    
    const [timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Token expires after 30 days
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > MAX_AGE || timestamp > Date.now() + 60000) {
        return false;
    }

    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET)
        .update(`aurachat-auth:${timestamp}`)
        .digest('hex');
        
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Middleware
app.use(express.json());
// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API: Verify App Access Password
app.post('/api/auth/verify', (req, res) => {
    const { password } = req.body || {};
    if (password && password === APP_PASSWORD) {
        const token = createAuthToken();
        return res.json({ 
            success: true, 
            token,
            message: 'Xác thực thành công!' 
        });
    }
    return res.status(401).json({ 
        success: false, 
        message: 'Mật khẩu không chính xác. Mật khẩu mặc định là: 123456' 
    });
});

// API: Validate current token status
app.get('/api/auth/check', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : req.query.token;
    if (verifyAuthToken(token)) {
        return res.json({ authenticated: true });
    }
    return res.status(401).json({ authenticated: false });
});

// API: Lấy VAPID Public Key cho client đăng ký Web Push
app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidPublicKey });
});

// API: Đăng ký nhận Web Push Notification
app.post('/api/push/subscribe', (req, res) => {
    const { subscription, username, room, authToken } = req.body || {};
    if (!verifyAuthToken(authToken)) {
        return res.status(401).json({ error: 'Chưa xác thực bảo mật' });
    }
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Dữ liệu subscription không hợp lệ' });
    }

    pushSubscriptions[subscription.endpoint] = {
        subscription,
        username: username || 'Ẩn danh',
        room: room || 'phong-chung',
        updatedAt: Date.now()
    };
    saveSubscriptions();
    res.json({ success: true, message: 'Đã kích hoạt thông báo đẩy nền thành công!' });
});

// API: Hủy nhận Web Push Notification
app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint } = req.body || {};
    if (endpoint && pushSubscriptions[endpoint]) {
        delete pushSubscriptions[endpoint];
        saveSubscriptions();
    }
    res.json({ success: true });
});

// Store room states and message history in memory
// roomHistories: { [roomId]: Array<{ id, user, text, image, replyTo, time }> }
const roomHistories = {};
// connectedUsers: { [socketId]: { id, username, avatar, room } }
const connectedUsers = {};

const DEFAULT_ROOMS = ['phong-chung', 'cong-nghe', 'chem-gio', 'hoc-tap'];

// Initialize default rooms
DEFAULT_ROOMS.forEach(room => {
    roomHistories[room] = [];
});

function getRoomUsers(room) {
    return Object.values(connectedUsers).filter(u => u.room === room);
}

function addMessageToHistory(room, msg) {
    if (!roomHistories[room]) {
        roomHistories[room] = [];
    }
    roomHistories[room].push(msg);
    // Keep last 100 messages per room
    if (roomHistories[room].length > 100) {
        roomHistories[room].shift();
    }
}

io.on('connection', (socket) => {
    // 1. User joins chat
    socket.on('user:join', ({ username, avatar, room, authToken }) => {
        // Enforce password auth verification
        if (!verifyAuthToken(authToken)) {
            return socket.emit('auth:required', { 
                message: 'Vui lòng nhập mật khẩu hợp lệ để tham gia chat!' 
            });
        }
        const cleanName = (username || 'Người dùng ẩn danh').trim().slice(0, 25);
        const targetRoom = (room || 'phong-chung').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);
        const userAvatar = avatar || '🦊';

        // Save socket user
        connectedUsers[socket.id] = {
            id: socket.id,
            username: cleanName,
            avatar: userAvatar,
            room: targetRoom
        };

        socket.join(targetRoom);

        // Send existing room history and room list to joining user
        socket.emit('room:joined', {
            room: targetRoom,
            history: roomHistories[targetRoom] || [],
            users: getRoomUsers(targetRoom),
            rooms: Object.keys(roomHistories)
        });

        // Notify room members
        socket.to(targetRoom).emit('system:notification', {
            type: 'join',
            text: `${userAvatar} ${cleanName} đã tham gia phòng`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });

        // Broadcast updated user list to room
        io.to(targetRoom).emit('room:users', getRoomUsers(targetRoom));
        // Broadcast updated room list
        io.emit('rooms:updated', Object.keys(roomHistories));
    });

    // 2. User changes room
    socket.on('room:switch', ({ newRoom }) => {
        const user = connectedUsers[socket.id];
        if (!user) return;

        const oldRoom = user.room;
        const targetRoom = (newRoom || 'phong-chung').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);

        if (oldRoom === targetRoom) return;

        // Leave old room
        socket.leave(oldRoom);
        socket.to(oldRoom).emit('system:notification', {
            type: 'leave',
            text: `${user.avatar} ${user.username} đã rời phòng`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });
        io.to(oldRoom).emit('room:users', getRoomUsers(oldRoom));

        // Join new room
        user.room = targetRoom;
        socket.join(targetRoom);

        if (!roomHistories[targetRoom]) {
            roomHistories[targetRoom] = [];
        }

        socket.emit('room:joined', {
            room: targetRoom,
            history: roomHistories[targetRoom] || [],
            users: getRoomUsers(targetRoom),
            rooms: Object.keys(roomHistories)
        });

        socket.to(targetRoom).emit('system:notification', {
            type: 'join',
            text: `${user.avatar} ${user.username} đã chuyển vào phòng này`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });

        io.to(targetRoom).emit('room:users', getRoomUsers(targetRoom));
        io.emit('rooms:updated', Object.keys(roomHistories));
    });

    // 3. Chat message sent
    socket.on('chat:message', ({ text, image, replyTo }) => {
        const user = connectedUsers[socket.id];
        if (!user) return;

        const cleanText = (text || '').trim();
        if (!cleanText && !image) return;

        const messageData = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: socket.id,
            username: user.username,
            avatar: user.avatar,
            text: cleanText.slice(0, 2000),
            image: image || null,
            replyTo: replyTo || null,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        };

        addMessageToHistory(user.room, messageData);

        // Broadcast to everyone in the room (including sender)
        io.to(user.room).emit('chat:message', messageData);

        // Send Web Push notification to offline users/devices
        sendWebPushNotification(user.username, user.avatar, user.room, cleanText, !!image);
    });

    // 4. Typing indicator
    socket.on('chat:typing', ({ isTyping }) => {
        const user = connectedUsers[socket.id];
        if (!user) return;

        socket.to(user.room).emit('chat:typing', {
            userId: socket.id,
            username: user.username,
            avatar: user.avatar,
            isTyping: !!isTyping
        });
    });

    // 5. Message reaction (emoji reaction)
    socket.on('chat:react', ({ messageId, emoji }) => {
        const user = connectedUsers[socket.id];
        if (!user || !emoji || !messageId) return;

        io.to(user.room).emit('chat:reaction_updated', {
            messageId,
            emoji,
            username: user.username
        });
    });

    // 6. User disconnects
    socket.on('disconnect', () => {
        const user = connectedUsers[socket.id];
        if (!user) return;

        const { room, username, avatar } = user;
        delete connectedUsers[socket.id];

        // Notify room members
        socket.to(room).emit('system:notification', {
            type: 'leave',
            text: `${avatar} ${username} đã ngắt kết nối`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });

        io.to(room).emit('room:users', getRoomUsers(room));
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Chat app online đang chạy tại: http://localhost:${PORT}`);
});
