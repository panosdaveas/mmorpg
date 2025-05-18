import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);

// Allow Vite dev server to connect
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

const players = {};

io.on('connection', socket => {
    console.log(`Player connected: ${socket.id}`);

    // Set default player position or use provided position
    players[socket.id] = { x: 320, y: 262 };

    // Handle player join with initial position
    socket.on('playerJoin', initialPosition => {
        // Update the player's position with the provided values
        if (initialPosition && initialPosition.x !== undefined && initialPosition.y !== undefined) {
            players[socket.id] = initialPosition;
        }

        // Send current players list to the newly connected player
        socket.emit('currentPlayers', players);

        // Notify other players about the new player
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            ...players[socket.id]
        });
    });

    socket.on('move', data => {
        // Update player position in our server state
        if (data && data.x !== undefined && data.y !== undefined) {
            players[socket.id] = data;
            // Broadcast updated position to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                ...data
            });
            
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Remove player from server state
        delete players[socket.id];

        // Notify all clients that a player has left
        io.emit('removePlayer', socket.id);
    });
});

httpServer.listen(3000, () => {
    console.log('🚀 Socket.IO server running at http://localhost:3000');
});