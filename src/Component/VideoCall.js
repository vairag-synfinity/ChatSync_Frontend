import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_BACKEND_URL);
const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function VideoCall() {
    const username = localStorage.getItem('username');
    const [targetUser, setTargetUser] = useState('');
    const [incoming, setIncoming] = useState(null);
    const [connected, setConnected] = useState(false);
    const [callStatus, setCallStatus] = useState('idle');

    const localVideoRef = useRef();
    const remoteVideoRef = useRef();

    const peerRef = useRef();
    const localStreamRef = useRef();

    useEffect(() => {
        if (username) socket.emit('register', username);

        socket.on('incoming-call', ({ from, offer }) => setIncoming({ from, offer }));

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

        return () => {
            socket.off('incoming-call');
            socket.off('call-answered');
            socket.off('ice-candidate');
        };
    }, [username]);

    const setupPeerConnection = () => {
        const peer = new RTCPeerConnection(servers);

        peer.onicecandidate = (e) => {
            if (e.candidate) {
                const target = incoming ? incoming.from : targetUser;
                socket.emit('ice-candidate', { to: target, candidate: e.candidate });
            }
        };

        peer.ontrack = (e) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = e.streams[0];
                remoteVideoRef.current.play().catch(() => { });
            }
        };


        peer.onconnectionstatechange = () => {
            if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
                endCall();
            }
        };

        return peer;
    };

    const getMediaStream = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('getUserMedia is not supported on this device/browser.');
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
        }
        localStreamRef.current = stream;
        return stream;
    };

    const startCall = async () => {
        if (!targetUser.trim()) return;
        setCallStatus('calling');
        peerRef.current = setupPeerConnection();
        const stream = await getMediaStream();
        stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
        const offer = await peerRef.current.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
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
        socket.emit('answer-call', { to: incoming.from, answer });
        setIncoming(null);
    };

    const endCall = () => {
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setConnected(false);
        setCallStatus('idle');
        setIncoming(null);
    };

    // if (!username) {
    //   return (
    //     <div style={{ padding: '20px' }}>
    //       <h2>Audio Call App</h2>
    //       <p>Set username first in console:</p>
    //       <code>localStorage.setItem('username', 'yourname')</code>
    //     </div>
    //   );
    // }

    return (
        <div style={{ padding: '20px' }}>
            <h2>Video Call</h2>
            <h3>Username:{username}</h3>
            <p><strong>Status:</strong> {callStatus}</p>

            {callStatus === 'idle' && (
                <div>
                    <input
                        value={targetUser}
                        onChange={(e) => setTargetUser(e.target.value)}
                        placeholder="Enter username"
                        style={{ padding: '5px', marginRight: '5px' }}
                    />
                    <button onClick={startCall}>Start Call</button>
                </div>
            )}

            {incoming && (
                <div style={{ marginTop: '10px' }}>
                    <p>Incoming call from: {incoming.from}</p>
                    <button onClick={answerCall} style={{ marginRight: '5px' }}>Answer</button>
                    <button onClick={() => { setIncoming(null); setCallStatus('idle'); }}>Reject</button>
                </div>
            )}

            {connected && (
                <div style={{ marginTop: '10px' }}>
                    <p>Call Connected</p>
                    <button onClick={endCall}>End Call</button>
                </div>
            )}

            <div style={{ marginTop: '20px' }}>
                <h4>Video</h4>
                <video ref={localVideoRef} autoPlay muted style={{ width: '200px', border: '1px solid black' }}></video>
                <video ref={remoteVideoRef} autoPlay style={{ width: '200px', border: '1px solid black' }}></video>

            </div>
        </div>
    );
}

export default VideoCall;
