const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // Host creates a room
    socket.on('createRoom', () => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = { players: [{ id: socket.id, color: 'white' }] };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        console.log(`Room created: ${roomCode}`);
    });

    // Friend joins a room
    socket.on('joinRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, color: 'black' });
            socket.join(roomCode);
            socket.emit('roomJoined', roomCode);
            
            // Notify both players that the game can begin
            io.to(roomCode).emit('gameStart');
            console.log(`Player joined room: ${roomCode}`);
        } else if (room && room.players.length >= 2) {
            socket.emit('roomError', 'Room is already full!');
        } else {
            socket.emit('roomError', 'Room not found. Check the code.');
        }
    });

    // Relay moves between players
    socket.on('makeMove', (data) => {
        socket.to(data.roomCode).emit('receiveMove', data.move);
    });

    // Handle game restarts
    socket.on('restartGame', (roomCode) => {
        socket.to(roomCode).emit('gameRestarted');
    });

    // Handle explicit player leave (e.g., clicking Back)
    socket.on('leaveRoom', (roomCode) => {
        if (rooms[roomCode]) {
            socket.to(roomCode).emit('opponentDisconnected');
            delete rooms[roomCode];
            socket.leave(roomCode);
        }
    });

    // Handle sudden disconnections (closing the tab)
    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                // Notify the opponent
                socket.to(roomCode).emit('opponentDisconnected');
                room.players.splice(playerIndex, 1);
                
                // Clean up empty rooms
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Chess WebSocket Server running on port ${PORT}`);
});