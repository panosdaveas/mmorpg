import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Support multiple origins
        methods: ['GET', 'POST']
    }
});

// Store players with their positions
const players = {};

// Debug helper
function logPlayers() {
    console.log('Current players:', Object.keys(players).map(id => ({
        id: id.substring(0, 6) + '...',
        position: players[id]
    })));
}

io.on('connection', socket => {
    console.log(`🟢 Player connected: ${socket.id}`);

    // When player sends their initial position
    socket.on('playerJoin', initialPosition => {
        console.log(`Player ${socket.id} joined at position:`, initialPosition);

        // Save player's position
        players[socket.id] = initialPosition;

        // Send all current players to the newly connected player
        socket.emit('currentPlayers', players);
        console.log(`Sent currentPlayers to ${socket.id} with ${Object.keys(players).length} players`);

        // Tell everyone else about the new player
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            ...initialPosition
        });
        console.log(`Broadcast newPlayer event for ${socket.id}`);

        logPlayers();
    });

    // When player moves
    socket.on('move', data => {
        // Update the player's position in our server record
        console.log(data);
        players[socket.id] = data;

        // Debug log
        console.log(`Player ${socket.id} moved to:`, data);

        // Broadcast to all OTHER players that this player moved
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            ...data
        });

        // Debug broadcast
        console.log(`Broadcast playerMoved for ${socket.id} to ${io.engine.clientsCount - 1} other clients`);
    });

    // When player disconnects
    socket.on('disconnect', () => {
        console.log(`🔴 Player disconnected: ${socket.id}`);

        // Remove from our players list
        delete players[socket.id];

        // Tell all remaining clients to remove this player
        io.emit('removePlayer', socket.id);
        console.log(`Broadcast removePlayer for ${socket.id}`);

        logPlayers();
    });
});

// Serve static files (if you want to)
app.use(express.static('public'));

// Add a route for checking server status
app.get('/status', (req, res) => {
    res.json({
        status: 'ok',
        players: Object.keys(players).length,
        uptime: process.uptime()
    });
});

httpServer.listen(3000, () => {
    console.log('🚀 Socket.IO server running at http://localhost:3000');
});