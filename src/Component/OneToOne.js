import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_BACKEND_URL);

function PrivateChat() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [toUser, setToUser] = useState('');
  const [fromUser, setFromUser] = useState(localStorage.getItem('username') || '');

  useEffect(() => {
    if (fromUser) {
      socket.emit('register_user', fromUser);
    }

    socket.on('receive_private_message', (data) => {
      setChat((prev) => [...prev, `${data.from}: ${data.text}`]);
    });

    return () => socket.off('receive_private_message');
  }, [fromUser]);

  const sendPrivateMessage = () => {
    if (!toUser || !message) return;
    socket.emit('send_private_message', { to: toUser, from: fromUser, text: message });
    setChat((prev) => [...prev, `Me to ${toUser}: ${message}`]);
    setMessage('');
  };

  return (
    <div>
      <h2>Private Chat</h2>

      <input
        value={fromUser}
        onChange={(e) => setFromUser(e.target.value)}
        placeholder="Your Username"
      /><br />

      <input
        value={toUser}
        onChange={(e) => setToUser(e.target.value)}
        placeholder="Send To (Username)"
      /><br />

      <div style={{ border: '1px solid #000', padding: '10px', height: '200px', overflowY: 'auto' }}>
        {chat.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message"
      />
      <button onClick={sendPrivateMessage}>Send</button>
    </div>
  );
}

export default PrivateChat;
