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

    // Handle player join with initial position and attributes
    socket.on('playerJoin', data => {
        console.log(`Player ${socket.id} joining with data:`, data);

        // Set default values if not provided
        const defaultPos = { x: 320, y: 262 };
        const defaultAttributes = {};

        // Initialize or update player data
        players[socket.id] = {
            x: data?.x ?? defaultPos.x,
            y: data?.y ?? defaultPos.y,
            attributes: data?.attributes ?? defaultAttributes,
            currentLevelName: data.levelName,
        };

        console.log(`Player ${socket.id} state:`, players[socket.id]);

        // Send current players list to the newly connected player
        socket.emit('currentPlayers', players);

        // Notify other players about the new player
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            ...players[socket.id]
        });
    });

    socket.on('move', data => {
        // console.log(`Player ${socket.id} moved:`, data);

        // Update player position in our server state (preserve existing attributes)
        if (data && data.x !== undefined && data.y !== undefined) {
            // Merge position update with existing player data
            if (players[socket.id]) {
                players[socket.id] = {
                    ...players[socket.id], // Preserve existing data (including attributes)
                    x: data.x,
                    y: data.y
                };
            } else {
                // Fallback if player not found in state
                players[socket.id] = {
                    x: data.x,
                    y: data.y,
                    attributes: {}
                };
            }

            // Broadcast updated position to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y
            });
        }
    });

    socket.on('playerDataUpdated', data => {
        console.log(`Player ${socket.id} data updated:`, data);

        // Update player attributes while preserving position
        if (players[socket.id]) {
            players[socket.id] = {
                ...players[socket.id], // Preserve existing data (including position)
                attributes: {
                    ...players[socket.id].attributes, // Preserve existing attributes
                    ...data.attributes // Merge in new attributes
                }
            };
        } else {
            // Fallback if player not found in state
            players[socket.id] = {
                x: 320,
                y: 262,
                attributes: data.attributes || {}
            };
        }

        console.log(`Player ${socket.id} updated state:`, players[socket.id]);

        // Broadcast updated data to all other players
        socket.broadcast.emit('playerDataUpdated', {
            id: socket.id,
            attributes: players[socket.id].attributes
        });
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