import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import '../css/videoCall.css';

const socket = io(process.env.REACT_APP_BACKEND_URL);
const servers = {
  iceServers: [
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};


export default function GroupVideoCall() {
  const username = localStorage.getItem('username');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');

  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef({});
  const remoteVideosRef = useRef({});
  const [remoteVideos, setRemoteVideos] = useState([]);

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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideoRef.current.srcObject = stream;
    localVideoRef.current.muted = true;
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
      let stream = remoteVideosRef.current[targetUsername];
      if (!stream) {
        stream = new MediaStream();
        remoteVideosRef.current[targetUsername] = stream;
      }

      stream.addTrack(e.track);
      setRemoteVideos(prev => [
        ...prev.filter(v => v.id !== targetUsername),
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
      default: return 'Ready to call';
    }
  };

  return (
    <>
     <div className="video-call-container">
        <div className="header">
          <h2>Group Video Call</h2>
        </div>

        <div className="controls-panel">
          <div className="user-info-card">
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>User Status</h3>
            <div className={`status-indicator status-${callStatus}`}>
              <span className="status-dot"></span>
            </div>
              <span><strong>{username}</strong> - {getStatusText()}</span>

          </div>

          <div className="search-card">
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Add Participants</h3>
            <input
              className="search-input"
              placeholder="Search users to invite..."
              value={searchQuery}
              onChange={(e) => searchUsers(e.target.value)}
            />

            <ul className="users-list">
              {searchResults.map(user => (
                <li 
                  key={user._id} 
                  className={`user-item ${selectedUsers.some(u => u.username === user.username) ? 'selected' : ''}`}
                  onClick={() => toggleUser(user)}
                >
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
        </div>

        <div className="call-controls">
          <button 
            className="start-call-btn" 
            onClick={startGroupCall} 
            disabled={selectedUsers.length === 0}
          >
            {selectedUsers.length > 0 
              ? `🚀 Start Video Call (${selectedUsers.length} participant${selectedUsers.length > 1 ? 's' : ''})`
              : '📱 Select participants to start call'
            }
          </button>
        </div>

        {incoming && (
          <div className="incoming-call">
            <p>📞 Incoming video call from <strong>{incoming.from}</strong></p>
            <button className="answer-btn" onClick={answerCall}>
              ✅ Answer Call
            </button>
          </div>
        )}

        <div className="video-section">
          <div className="local-video-container">
            <h3 className="section-title">
              <span>📷</span>
              Your Video
            </h3>
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="local-video"
            />
          </div>

          {remoteVideos.length === 0 ? (
            <>
              <h3 className="section-title">
                <span>👥</span>
                Participants ({remoteVideos.length})
              </h3>
              <div className="remote-videos-grid">
                {remoteVideos.map(({ id, stream }) => (
                  <div key={id} className="remote-video-item">
                    <h5>👤 {id}</h5>
                    <video
                      autoPlay
                      playsInline
                      className="remote-video"
                      ref={(el) => { if (el) el.srcObject = stream; }}
                    />
                  </div>
                ))}
              </div>
              // <button className="end-call-btn" onClick={() => setRemoteVideos(0)}>
              //   End Call
              // </button>
            </>
          ) : (
            <div className="empty-state">
              <h3 className="section-title">
                <span>👥</span>
                Participants
              </h3>
              <p>No participants yet. Start a call to see other participants here.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
