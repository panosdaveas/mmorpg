import React, { useState } from 'react';
import { useChatClient } from '../../client/useChatClient';

export const MinimalChatBox = ({socket, localPlayer}) => {
    const [text, setText] = useState('');
    const [message, setMessage] = useState("");
    const [chatLog, setChatLog] = useState([]);
    const { sendPublicMessage, sendPrivateMessage, sendRoomMessage } = useChatClient(socket, localPlayer);

    const onSend = () => {
        if (!message.trim()) return;

        // Example logic: check for special prefix to determine message type
        if (message.startsWith("/w ")) {
            // Whisper format: "/w <socketId> message"
            const parts = message.split(" ");
            const toSocketId = parts[1];
            const privateMessage = parts.slice(2).join(" ");
            sendPrivateMessage(toSocketId, privateMessage);
            setChatLog(log => [...log, { from: "you (private)", message: privateMessage }]);
        } else if (message.startsWith("/room ")) {
            const roomMessage = message.replace("/room ", "");
            sendRoomMessage(roomMessage);
            setChatLog(log => [...log, { from: "you (room)", message: roomMessage }]);
        } else {
            sendPublicMessage(message);
            setChatLog(log => [...log, { from: "you", message }]);
        }

        setMessage("");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (text.trim()) {
            onSend(text);
            setText('');
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ position: 'absolute', bottom: 20, left: 20 }}>
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type message..."
                style={{ width: 300, padding: 6 }}
            />
        </form>
    );
};