import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import '../css/ChatApp.css';

const socket = io(process.env.REACT_APP_BACKEND_URL);

export default function AllChat() {
  const [message, setMessage] = useState('');
  const [publicChat, setPublicChat] = useState([]);
  const [privateChats, setPrivateChats] = useState(new Map());
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState('public');
  const [currentUser] = useState(localStorage.getItem('username') || 'Anonymous');
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.emit('register_user', currentUser);

    socket.on('receive_message', (data) => {
      if (data.type === 'public') setPublicChat((prev) => [...prev, data]);
    });

    socket.on('receive_private_message', (data) => {
      console.log('Received private message:', data);
      setPrivateChats((prev) => {
        const newChats = new Map(prev);
        const chat = newChats.get(data.username) || [];
        newChats.set(data.username, [...chat, { ...data, isReceived: true }]);
        return newChats;
      });
    });

    socket.on('private_message_sent', (data) => {
      setPrivateChats((prev) => {
        const newChats = new Map(prev);
        const chat = newChats.get(data.receiver) || [];
        newChats.set(data.receiver, [...chat, { ...data, isReceived: false }]);
        return newChats;
      });
    });

    socket.on('private_chat_history', (data) => {
      const otherUser = data.user1 === currentUser ? data.user2 : data.user1;
      setPrivateChats((prev) => {
        const newChats = new Map(prev);
        const formatted = data.messages.map(msg => ({
          ...msg,
          isReceived: msg.username !== currentUser
        }));
        newChats.set(otherUser, formatted);
        return newChats;
      });
    });

    socket.on('users_updated', (users) => {
      setActiveUsers(users.filter(user => user !== currentUser));
    });

    socket.on('message_deleted', (data) => {
      setPublicChat((prev) => prev.filter(msg => msg._id !== data.messageId));
    });

    socket.on('user_not_found', (data) => alert(`User ${data.username} is not online`));

    return () => {
      socket.off('receive_message');
      socket.off('receive_private_message');
      socket.off('private_message_sent');
      socket.off('private_chat_history');
      socket.off('users_updated');
      socket.off('message_deleted');
      socket.off('user_not_found');
    };
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [publicChat, privateChats, selectedChat]);

  const sendMessage = () => {
    if (!message.trim()) return;
    if (selectedChat === 'public') {
      socket.emit('send_message', { username: currentUser, text: message });
    } else {
      socket.emit('send_private_message', { to: selectedChat, from: currentUser, text: message });
    }
    setMessage('');
  };

  const handleUserClick = (username) => {
    setSelectedChat(username);
    if (!privateChats.has(username)) {
      socket.emit('get_private_chat_history', { user1: currentUser, user2: username });
    }
  };

  const handleDelete = (messageId) => {
    if (selectedChat === 'public') socket.emit('delete_message', { messageId });
  };

  const getCurrentChat = () => selectedChat === 'public' ? publicChat : (privateChats.get(selectedChat) || []);

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="header">Users</div>
        <div className="user-info">Welcome, {currentUser}</div>
        <div className="user-list">
          <div className={`user-item ${selectedChat === 'public' ? 'active' : ''}`} onClick={() => setSelectedChat('public')}>
            <div className="avatar">#</div>
            <div>
              <div className="name">Public Chat</div>
              <div className="meta">{publicChat.length} messages</div>
            </div>
          </div>
          <div className="active-users">Active Users ({activeUsers.length})</div>
          {activeUsers.map((user, index) => (
            <div key={index} className={`user-item ${selectedChat === user ? 'active' : ''}`} onClick={() => handleUserClick(user)}>
              <div className="avatar">{user.charAt(0).toUpperCase()}</div>
              <div>
                <div className="name">{user}</div>
                <div className="meta">{privateChats.has(user) ? `${privateChats.get(user).length} messages` : 'Click to chat'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chat-area">
        <div className="chat-header">
          {selectedChat === 'public' ? `Public Chat` : `Chat with ${selectedChat}`}
          <div className="chat-subheader">{selectedChat === 'public' ? 'Group Conversation' : 'Private Conversation'}</div>
        </div>

        <div className="chat-messages">
          {getCurrentChat().map((msg, index) => {
            const isOwn = selectedChat === 'public' ? msg.username === currentUser : !msg.isReceived;
            return (
              <div key={msg._id || index} className={`message ${isOwn ? 'own' : ''}`}>
                {selectedChat === 'public' && <div className="msg-user">{msg.username}</div>}
                <div className="msg-text">{msg.text}</div>
                <div className="msg-meta">
                  <span>{new Date(msg.createdAtDate).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  {selectedChat === 'public' && msg.username === currentUser && (
                    <button className="delete-btn" onClick={() => handleDelete(msg._id)}>🗑️</button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef}></div>
        </div>

        <div className="chat-input">
          <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder={selectedChat === 'public' ? 'Type a message to everyone...' : `Type a message to ${selectedChat}...`} />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}
