import { useEffect, useState } from 'react';
import { events } from '../Events';

export const useChatClient = (socket, currentUser) => {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (!socket) return;

        // Handle incoming messages
        socket.on('chat:message', (msg) => {
            setMessages((prev) => [...prev, msg]);
            events.emit('RECEIVED_CHAT_MESSAGE', msg);
        });

        return () => {
            socket.off('chat:message');
        };
    }, [socket]);

    const sendPublic = (text) => {
        socket.emit('chat:public', { from: currentUser, text });
    };

    const sendPrivate = (toSocketId, text) => {
        socket.emit('chat:private', { from: currentUser, to: toSocketId, text });
    };

    const sendToRoom = (room, text) => {
        socket.emit('chat:room', { from: currentUser, room, text });
    };

    return { messages, sendPublic, sendPrivate, sendToRoom };
};