import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_BACKEND_URL);
const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};


function AudioCall() {
  const username = localStorage.getItem('username');
  const [targetUser, setTargetUser] = useState('');
  const [incoming, setIncoming] = useState(null);
  const [connected, setConnected] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [currentCaller, setCurrentCaller] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
const [searchTimeout, setSearchTimeout] = useState(null);


  const localAudioRef = useRef();
  const remoteAudioRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();

  useEffect(() => {
    if (username) socket.emit('register', username);

    socket.on('incoming-call', ({ from, offer }) => {
      setIncoming({ from, offer });
      setCurrentCaller(from);
    });

    socket.on('call-answered', async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setConnected(true);
        setCallStatus('connected');
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (peerRef.current) await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call-rejected', () => endCall());
    socket.on('call-ended', () => endCall());
    socket.on('user-not-found', () => endCall());

    return () => {
      socket.off('incoming-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('user-not-found');
    };
  }, [username]);

  const setupPeerConnection = () => {
    const peer = new RTCPeerConnection(servers);

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        const target = currentCaller || targetUser;
        socket.emit('ice-candidate', {
          to: target,
          candidate: e.candidate,
          from: username
        });
      }
    };

    peer.ontrack = (event) => {
      const remoteStream = new MediaStream();
      remoteStream.addTrack(event.track);
      remoteAudioRef.current.srcObject = remoteStream;
    };


    peer.onconnectionstatechange = () => {
        console.log("ICE state:", peer.iceConnectionState);

      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        endCall();
      }
    };

    return peer;
  };

  const getMediaStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
      localAudioRef.current.muted = true;
    }
    localStreamRef.current = stream;
    return stream;
  };

  const startCall = async () => {
    if (!targetUser.trim()) return;
    setCallStatus('calling');
    setCurrentCaller(targetUser);
    peerRef.current = setupPeerConnection();
    const stream = await getMediaStream();
    stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
    const offer = await peerRef.current.createOffer({ offerToReceiveAudio: true });
    await peerRef.current.setLocalDescription(offer);
    socket.emit('call-user', { to: targetUser, from: username, offer });
  };

  const answerCall = async () => {
    setCallStatus('connecting');
    peerRef.current = setupPeerConnection();
    const stream = await getMediaStream();
    stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
    await peerRef.current.setRemoteDescription(new RTCSessionDescription(incoming.offer));
    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);
    socket.emit('answer-call', {
      to: incoming.from,
      answer,
      from: username
    });
    setConnected(true);
    setCallStatus('connected');

    setIncoming(null);
  };

  const endCall = () => {
    if (currentCaller && callStatus !== 'idle') {
      socket.emit('end-call', { to: currentCaller, from: username });
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setConnected(false);
    setCallStatus('idle');
    setIncoming(null);
    setCurrentCaller(null);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Audio Call</h2>
      <h3>Username: {username}</h3>
      <p><strong>Status:</strong> {callStatus}</p>

      {callStatus === 'idle' && (
        <div>



         <input
  value={targetUser}
  onChange={(e) => {
    const value = e.target.value;
    setTargetUser(value);

    if (searchTimeout) clearTimeout(searchTimeout);

    setSearchTimeout(setTimeout(async () => {
      if (value.trim() === '') {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/users/search?q=${value}`);
        const data = await res.json();
        setSearchResults(data);
      } catch (err) {
        console.error('User search failed', err);
      }
    }, 300)); 
  }}
  placeholder="Search username"
  style={{ padding: '5px', marginRight: '5px' }}
/>

{searchResults.length > 0 && (
  <ul style={{
    border: '1px solid #ccc',
    marginTop: '4px',
    padding: '4px',
    listStyle: 'none',
    maxHeight: '120px',
    overflowY: 'auto',
    backgroundColor: '#fff',
    position: 'absolute',
    zIndex: 10,
    width: '200px'
  }}>
    {searchResults.map(user => (
      <li
        key={user._id}
        onClick={() => {
          setTargetUser(user.username);
          setSearchResults([]);
        }}
        style={{ padding: '5px', cursor: 'pointer' }}
      >
        {user.username}
      </li>
    ))}
  </ul>
)}



          <button onClick={startCall}>Start Call</button>
        </div>
      )}

      {incoming && (
        <div style={{ marginTop: '10px' }}>
          <p>Incoming call from: {incoming.from}</p>
          <button onClick={answerCall} style={{ marginRight: '5px' }}>Answer</button>
          <button onClick={() => {
            socket.emit('reject-call', { to: incoming.from, from: username });
            setIncoming(null);
          }}>Reject</button>

        </div>
      )}

      {connected && (
        <div style={{ marginTop: '10px' }}>
          <p>Call Connected</p>
          <button onClick={endCall}>End Call</button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h4>Audio</h4>
        <audio ref={localAudioRef} autoPlay muted></audio>
        <audio ref={remoteAudioRef} autoPlay controls></audio>
      </div>
    </div>
  );
}

export default AudioCall;