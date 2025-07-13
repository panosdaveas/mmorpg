import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

const app = express();
const httpServer = createServer(app);

// Load whitelist configuration
let whitelist;
try {
    const whitelistPath = path.join(process.cwd(), 'src/server/whitelist.json');
    whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
    console.log('✅ Whitelist loaded:', whitelist.trustedIPs.length, 'trusted IPs');
} catch (error) {
    console.error('❌ Failed to load whitelist, using defaults:', error.message);
    whitelist = {
        trustedIPs: ["127.0.0.1", "::1"],
        maxConnectionsPerIP: 3,
        maxConnectionsWhitelisted: 10
    };
}

// Track connections per IP
const connectionsByIP = new Map();

// Get client IP address
function getClientIP(socket) {
    return socket.handshake.address ||
        socket.conn.remoteAddress ||
        socket.handshake.headers['x-forwarded-for']?.split(',')[0] ||
        'unknown';
}

// Check if IP is whitelisted
function isWhitelisted(ip) {
    return whitelist.trustedIPs.includes(ip);
}

// Allow Vite dev server to connect
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Connection middleware - check IP limits before allowing connection
io.use((socket, next) => {
    const ip = getClientIP(socket);
    const currentConnections = connectionsByIP.get(ip) || 0;

    console.log(`🔍 Connection attempt from IP: ${ip} (current: ${currentConnections})`);

    // Check connection limits
    const maxConnections = isWhitelisted(ip) ?
        whitelist.maxConnectionsWhitelisted :
        whitelist.maxConnectionsPerIP;

    if (currentConnections >= maxConnections) {
        console.log(`🚫 Rejected connection from ${ip}: Too many connections (${currentConnections}/${maxConnections})`);
        return next(new Error('TOO_MANY_CONNECTIONS'));
    }

    // Allow connection and track it
    connectionsByIP.set(ip, currentConnections + 1);
    socket.clientIP = ip; // Store for cleanup later

    console.log(`✅ Accepted connection from ${ip} (${currentConnections + 1}/${maxConnections})`);
    next();
});

const players = {};

io.on('connection', socket => {
    const ip = socket.clientIP;
    const isWhitelistedIP = isWhitelisted(ip);

    console.log(`Player connected: ${socket.id} from ${ip} ${isWhitelistedIP ? '(WHITELISTED)' : ''}`);

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
            levelName: data.levelName ?? 'Main Map',
        };

        console.log(`Player ${socket.id} state:`, players[socket.id]);

        // Send current players list to the newly connected player
        socket.emit('currentPlayers', players);

        // Notify other players about the new player
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            ...players[socket.id]
        });

        const chainId = data.attributes?.chainId;
        if (chainId) {
            const room = `chain-${chainId}`;
            socket.join(room);
            console.log(`Player ${socket.id} joined room ${room}`);
        }
    });

    socket.on('move', data => {
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
                ...players[socket.id], // Preserve existing data (including attributes)
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
        console.log(`Player disconnected: ${socket.id} from ${ip}`);

        // Remove player from server state
        delete players[socket.id];

        // Update connection count for this IP
        const currentConnections = connectionsByIP.get(ip) || 1;
        if (currentConnections <= 1) {
            connectionsByIP.delete(ip);
            console.log(`🔄 Removed IP tracking for ${ip}`);
        } else {
            connectionsByIP.set(ip, currentConnections - 1);
            console.log(`🔄 Updated connections for ${ip}: ${currentConnections - 1}`);
        }

        // Notify all clients that a player has left
        io.emit('removePlayer', socket.id);
    });

    socket.on("changeLevel", ({ levelName }) => {
        if (!players[socket.id]) return;

        players[socket.id].levelName = levelName;

        // Notify others
        socket.broadcast.emit("playerLevelChanged", {
            id: socket.id,
            levelName
        });
    });

    socket.on("privateMessage", (data) => {
        const { to, ...payload } = data;

        const targetSocket = io.sockets.sockets.get(to);
        if (targetSocket) {
            targetSocket.emit(payload.type, {
                ...payload,
                from: socket.id
            });
            console.log(`[Server] Forwarded ${payload.type} to ${to}`);
        } else {
            console.warn(`[Server] Could not find socket for ${to}`);
        }
    });

    socket.on('chat:public', (msg) => {
        io.emit('chat:message', msg);
    });

    socket.on('chat:private', ({ from, to, text }) => {
        io.to(to).emit('chat:message', { from, text, private: true });
    });

    socket.on('chat:room', ({ from, room, text }) => {
        io.to(room).emit('chat:message', { from, text, room });
    });

});

// Simple admin endpoint to check current connections
app.get('/admin/connections', (req, res) => {
    const connectionData = Object.fromEntries(connectionsByIP);
    res.json({
        totalIPs: connectionsByIP.size,
        connectionsByIP: connectionData,
        totalPlayers: Object.keys(players).length,
        whitelist: whitelist.trustedIPs
    });
});

httpServer.listen(3000, () => {
    console.log('🚀 Socket.IO server running at http://localhost:3000');
    console.log('📊 Connection stats: http://localhost:3000/admin/connections');
    console.log(`🛡️ Max connections per IP: ${whitelist.maxConnectionsPerIP} (${whitelist.maxConnectionsWhitelisted} for whitelisted)`);
});