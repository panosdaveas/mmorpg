import { io } from "socket.io-client";

export function createMultiplayerSocket({
    onConnect,
    onCurrentPlayers,
    onNewPlayer,
    onPlayerMoved,
    onRemovePlayer,
    onConnectError,
    onDisconnect
}) {
    const socket = io('http://localhost:3000', {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 5000
    });

    socket.on('connect', () => onConnect?.(socket));
    socket.on('currentPlayers', onCurrentPlayers);
    socket.on('newPlayer', onNewPlayer);
    socket.on('playerMoved', onPlayerMoved);
    socket.on('removePlayer', onRemovePlayer);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    return socket;
}