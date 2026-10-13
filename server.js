const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 5e6 // 5MB limit for inline images
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

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
    socket.on('user:join', ({ username, avatar, room }) => {
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
