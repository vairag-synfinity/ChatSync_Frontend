import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import '../css/voiceCall.css';

const socket = io(process.env.REACT_APP_BACKEND_URL);
const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function GroupAudioCall() {
  const username = localStorage.getItem('username');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);

  const localAudioRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef({});
  const remoteStreamsRef = useRef({});
  const [remoteAudios, setRemoteAudios] = useState([]);

  useEffect(() => {
    socket.emit('register', username);

    // Handle room creation/joining
    socket.on('room-created', ({ roomId, participants }) => {
      console.log(`Room ${roomId} created with participants:`, participants);
      setCurrentRoom(roomId);
      setRoomParticipants(participants);
      setCallStatus('calling');
    });

    socket.on('user-joined-room', ({ roomId, participant, participants }) => {
      console.log(`${participant} joined room ${roomId}`);
      setRoomParticipants(participants);
    });

    // Handle peer-to-peer connections
    socket.on('incoming-call', async ({ from, offer, roomId }) => {
      console.log(`Incoming call from ${from} in room ${roomId}`);
      setIncoming({ from, offer, roomId });
    });

    socket.on('call-answered', async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Handle when someone wants to connect to you
    socket.on('request-connection', async ({ from, roomId }) => {
      console.log(`Connection request from ${from} in room ${roomId}`);
      if (currentRoom === roomId) {
        await initiateCallTo(from);
      }
    });

    socket.on('user-left-room', ({ participant, participants }) => {
      console.log(`${participant} left the room`);
      // Clean up peer connection
      if (peersRef.current[participant]) {
        peersRef.current[participant].close();
        delete peersRef.current[participant];
      }
      // Remove remote stream
      if (remoteStreamsRef.current[participant]) {
        delete remoteStreamsRef.current[participant];
      }
      // Update UI
      setRemoteAudios(prev => prev.filter(audio => audio.id !== participant));
      setRoomParticipants(participants);
    });

    return () => {
      socket.off('room-created');
      socket.off('user-joined-room');
      socket.off('incoming-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
      socket.off('request-connection');
      socket.off('user-left-room');
    };
  }, [username, currentRoom]);

  const toggleUser = (user) => {
    setSelectedUsers(prev =>
      prev.find(u => u.username === user.username)
        ? prev.filter(u => u.username !== user.username)
        : [...prev, user]
    );
  };

  const searchUsers = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) return setSearchResults([]);

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/users/search?q=${q}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed', err);
    }
  };

  const getLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localAudioRef.current.srcObject = stream;
    localAudioRef.current.muted = true;
    localStreamRef.current = stream;
    return stream;
  };

  const createPeerConnection = (targetUsername) => {
    const peer = new RTCPeerConnection(servers);

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', {
          to: targetUsername,
          from: username,
          candidate: e.candidate
        });
      }
    };

    peer.ontrack = (e) => {
      console.log(`Received track from ${targetUsername}`);
      let stream = remoteStreamsRef.current[targetUsername];
      if (!stream) {
        stream = new MediaStream();
        remoteStreamsRef.current[targetUsername] = stream;
      }

      stream.addTrack(e.track);
      setRemoteAudios(prev => [
        ...prev.filter(a => a.id !== targetUsername),
        { id: targetUsername, stream }
      ]);
    };

    peer.onconnectionstatechange = () => {
      console.log(`Connection with ${targetUsername}: ${peer.connectionState}`);
      if (peer.connectionState === 'connected') {
        setCallStatus('connected');
      }
    };

    peersRef.current[targetUsername] = peer;
    return peer;
  };

  const initiateCallTo = async (targetUsername) => {
    const stream = await getLocalStream();
    const peer = createPeerConnection(targetUsername);
    
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit('call-user', {
      to: targetUsername,
      from: username,
      offer,
      roomId: currentRoom
    });
  };

  const startGroupCall = async () => {
    // Create room with selected users
    const participantUsernames = selectedUsers.map(user => user.username);
    participantUsernames.push(username); // Add self to participants
    
    socket.emit('create-room', {
      participants: participantUsernames,
      creator: username
    });

    // Get local stream ready
    await getLocalStream();
  };

  const answerCall = async () => {
    const { from, offer, roomId } = incoming;
    setCurrentRoom(roomId);
    
    const peer = createPeerConnection(from);
    const stream = await getLocalStream();
    
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit('answer-call', { 
      to: from, 
      from: username, 
      answer,
      roomId 
    });

    // Join the room
    socket.emit('join-room', { roomId, username });
    
    setIncoming(null);
    setCallStatus('connected');
  };

  const endCall = () => {
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      peer.close();
    });
    peersRef.current = {};

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Clear remote streams
    remoteStreamsRef.current = {};
    setRemoteAudios([]);

    // Leave room
    if (currentRoom) {
      socket.emit('leave-room', { roomId: currentRoom, username });
    }

    // Reset state
    setCurrentRoom(null);
    setRoomParticipants([]);
    setCallStatus('idle');
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling': return 'Calling...';
      case 'connected': return `Connected (Room: ${currentRoom})`;
      default: return 'Ready';
    }
  };

  return (
    <>
      <div className="group-call-container">
        <div className="header">
          <h2>Group Audio Call</h2>
        </div>

        <div className="user-info">
          <p>
            <span className={`status-indicator status-${callStatus}`}></span>
            <strong>Logged in as: {username}</strong> - {getStatusText()}
          </p>
          {roomParticipants.length > 0 && (
            <p>Room participants: {roomParticipants.join(', ')}</p>
          )}
        </div>

        {callStatus === 'idle' && (
          <div className="search-section">
            <input
              className="search-input"
              placeholder="Search users to add to call..."
              value={searchQuery}
              onChange={(e) => searchUsers(e.target.value)}
            />

            <ul className="users-list">
              {searchResults.map(user => (
                <li key={user._id} className="user-item" onClick={() => toggleUser(user)}>
                  <label className="user-label">
                    <input
                      className="user-checkbox"
                      type="checkbox"
                      checked={selectedUsers.some(u => u.username === user.username)}
                      onChange={() => toggleUser(user)}
                    />
                    {user.username}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="call-controls">
          {callStatus === 'idle' ? (
            <button
              className="start-call-btn"
              onClick={startGroupCall}
              disabled={selectedUsers.length === 0}
            >
              {selectedUsers.length > 0
                ? `Start Call with ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}`
                : 'Select users to start call'
              }
            </button>
          ) : (
            <button className="end-call-btn" onClick={endCall}>
              End Call
            </button>
          )}
        </div>

        {incoming && (
          <div className="incoming-call">
            <p>📞 Incoming call from <strong>{incoming.from}</strong></p>
            <button className="answer-btn" onClick={answerCall}>
              Answer Call
            </button>
          </div>
        )}

        <div className="audio-section">
          <h4>🎤 Local Audio</h4>
          <audio ref={localAudioRef} autoPlay muted />

          {remoteAudios.length > 0 && (
            <>
              <h4>🔊 Remote Audio ({remoteAudios.length} participant{remoteAudios.length > 1 ? 's' : ''})</h4>
              {remoteAudios.map(({ id, stream }) => (
                <div key={id} className="remote-audio-item">
                  <p>🎧 {id}</p>
                  <audio
                    className="audio-controls"
                    autoPlay
                    controls
                    ref={(el) => { if (el) el.srcObject = stream; }}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
