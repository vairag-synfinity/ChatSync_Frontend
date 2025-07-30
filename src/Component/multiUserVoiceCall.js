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

  const localAudioRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef({});
  const remoteStreamsRef = useRef({});
  const [remoteAudios, setRemoteAudios] = useState([]);

  useEffect(() => {
    socket.emit('register', username);

    socket.on('incoming-call', async ({ from, offer }) => {
      console.log(`Incoming call from ${from}`);
      setIncoming({ from, offer });
    });

    socket.on('call-answered', async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
    };
  }, [username]);

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
    console.log('🎤📷 Tracks from local stream:', stream.getTracks());
stream.getTracks().forEach(track => {
  console.log(`Track kind: ${track.kind}, enabled: ${track.enabled}`);
});

    return stream;
  };

  const createPeerConnection = (targetUsername) => {
    const peer = new RTCPeerConnection(servers);

    peer.onicecandidate = (e) => {
  if (e.candidate) {
    console.log('📤 Sending ICE to', targetUsername);
    socket.emit('ice-candidate', { to: targetUsername, from: username, candidate: e.candidate });
  }
};

socket.on('ice-candidate', async ({ from, candidate }) => {
  console.log('📥 Received ICE from', from);
  const peer = peersRef.current[from];
  if (peer && candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
  }
});


    peer.ontrack = (e) => {
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

    peersRef.current[targetUsername] = peer;
    return peer;
  };

  const startGroupCall = async () => {
    const stream = await getLocalStream();
    for (const user of selectedUsers) {
      const peer = createPeerConnection(user.username);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('call-user', {
        to: user.username,
        from: username,
        offer
      });
    }
    setCallStatus('calling');
  };

  const answerCall = async () => {
    const { from, offer } = incoming;
    const peer = createPeerConnection(from);
    const stream = await getLocalStream();
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit('answer-call', { to: from, from: username, answer });
    setIncoming(null);
    setCallStatus('connected');
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling': return 'Calling...';
      case 'connected': return 'Connected';
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
        </div>

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

        <div className="call-controls">
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
                  <p>👤 {id}</p>
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
