// import { io } from "socket.io-client";

// // Simple socket factory for creating connections
// // This is mainly for cases where you might want a direct socket connection
// // without the full MultiplayerManager functionality
// export function createSocket(serverUrl = 'http://localhost:3000', options = {}) {
//     const defaultOptions = {
//         reconnectionAttempts: 5,
//         reconnectionDelay: 1000,
//         timeout: 5000,
//         ...options
//     };

//     return io(serverUrl, defaultOptions);
// }

// // Legacy wrapper for backward compatibility with existing callback structure
// export function createMultiplayerSocket({
//     serverUrl = 'http://localhost:3000',
//     onConnect,
//     onCurrentPlayers,
//     onNewPlayer,
//     onPlayerMoved,
//     onRemovePlayer,
//     onConnectError,
//     onDisconnect,
//     onPlayerDataUpdated,
//     ...socketOptions
// }) {
//     const socket = createSocket(serverUrl, socketOptions);

//     socket.on('connect', () => onConnect?.(socket));
//     socket.on('currentPlayers', onCurrentPlayers);
//     socket.on('newPlayer', onNewPlayer);
//     socket.on('playerMoved', onPlayerMoved);
//     socket.on('removePlayer', onRemovePlayer);
//     socket.on('connect_error', onConnectError);
//     socket.on('disconnect', onDisconnect);
//     socket.on('disconnect', onDisconnect);
//     socket.on('playerDataUpdated', onPlayerDataUpdated);

//     return socket;
// }