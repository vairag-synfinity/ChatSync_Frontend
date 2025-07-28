import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_BACKEND_URL);
const servers = {
  iceServers: [
     { urls: 'stun:stun.l.google.com:19302' }
    // { urls: 'stun:stun1.l.google.com:19302' }
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
    setIncoming({ from, offer }); // shows UI button to accept
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
}, []);


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
    //   console.log('Search results:', data);
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

  return (
    <div style={{ padding: 20 }}>
      <h2>Group Video Call</h2>
      <p>Logged in as: <strong>{username}</strong></p>

      <input
        placeholder="Search users"
        value={searchQuery}
        onChange={(e) => searchUsers(e.target.value)}
        style={{ padding: 5, width: 200 }}
      />

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {searchResults.map(user => (
          <li key={user._id}>
            <label>
              <input
                type="checkbox"
                checked={selectedUsers.some(u => u.username === user.username)}
                onChange={() => toggleUser(user)}
              />
              {user.username}
            </label>
          </li>
        ))}
      </ul>

      <button onClick={startGroupCall} disabled={selectedUsers.length === 0}>
        Start Call with Selected
      </button>

      {incoming && (
        <div>
          <p>Incoming call from {incoming.from}</p>
          <button onClick={answerCall}>Answer</button>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <h4>Local Video</h4>
<video ref={localVideoRef} autoPlay muted style={{ width: 200 }} />

<h4>Remote Videos</h4>
{remoteVideos.map(({ id, stream }) => (
  <div key={id}>
    <p>{id}</p>
    <video
      autoPlay
      playsInline
      style={{ width: 200 }}
      ref={(el) => { if (el) el.srcObject = stream; }}
    />
  </div>
))}

      </div>
    </div>
  );
}
