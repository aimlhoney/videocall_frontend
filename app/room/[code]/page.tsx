'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Participant {
  id: string;
  userId: string;
  name: string;
  isHost: boolean;
  cameraOn: boolean;
  micOn: boolean;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function CameraOffAvatar({ name }: { name: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#e7e7e7',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#111',
        color: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 24, fontWeight: 800,
      }}>
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
      <span style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>{name}</span>
    </div>
  );
}

function NameBadge({ name, isHost, isSelf, micOn }: { name: string; isHost: boolean; isSelf: boolean; micOn: boolean }) {
  return (
    <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center', zIndex: 2 }}>
      <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
        {name}{isHost ? ' (Host)' : ''}{isSelf ? ' · You' : ''}
      </span>
      {!micOn && (
        <span style={{ background: 'rgba(185,28,28,0.85)', color: '#fff', fontSize: 11, padding: '4px 8px', borderRadius: 999 }}>
          🎙 Muted
        </span>
      )}
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = useMemo(() => String(params.code || ''), [params.code]);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Callback refs: every time React mounts a new <video> element (e.g. layout
  // switches from solo → pip), re-attach the stream so the feed stays visible.
  const setLocalVideoRef = (el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.muted = true;
      el.play().catch(() => {});
    }
  };

  const setRemoteVideoRef = (el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play().catch(() => {});
    }
  };

  const previewSyncedRef = useRef(false);

  // Draggable PiP state
  const pipRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [remotePresent, setRemotePresent] = useState(false);
  const [roomStatus, setRoomStatus] = useState<'WAITING' | 'ACTIVE' | 'ENDED'>('WAITING');

  const [userId] = useState(() => {
    const existing = sessionStorage.getItem('hostId');
    return existing || `user-${Math.random().toString(36).slice(2)}`;
  });

  const displayName =
    typeof window !== 'undefined' ? sessionStorage.getItem('displayName') || '' : '';

  const previewCameraEnabled =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('previewCameraEnabled') !== 'false'
      : true;

  const previewMicEnabled =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('previewMicEnabled') !== 'false'
      : true;

  const isHost = participants.some((p) => p.userId === userId && p.isHost);
  const me = participants.find((p) => p.userId === userId);
  const remotePeer = participants.find((p) => p.userId !== userId);

  const isPipMode = participants.length === 2;
  const isGridMode = participants.length > 2;
  const isSoloMode = participants.length <= 1;

  // ── Draggable PiP handlers ──
  const onPipPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startPos.current = {
      x: e.clientX - currentPos.current.x,
      y: e.clientY - currentPos.current.y,
    };
    pipRef.current?.setPointerCapture(e.pointerId);
  };

  const onPipPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const newX = e.clientX - startPos.current.x;
    const newY = e.clientY - startPos.current.y;
    currentPos.current = { x: newX, y: newY };
    setPipOffset({ x: newX, y: newY });
  };

  const onPipPointerUp = () => { dragging.current = false; };

  // ── WebRTC helpers ──
  const clearRemote = () => {
    remoteStreamRef.current = null;
    setRemotePresent(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause();
      remoteVideoRef.current.srcObject = null;
    }
  };

  const closePeer = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    clearRemote();
  };

  const createPeerConnection = () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', { roomCode, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      remoteStreamRef.current = stream;
      setRemotePresent(true);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        clearRemote();
      }
    };

    return pc;
  };

  const setupLocalMedia = async () => {
    if (localStreamRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    });

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (videoTrack) videoTrack.enabled = previewCameraEnabled;
    if (audioTrack) audioTrack.enabled = previewMicEnabled;

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      await localVideoRef.current.play().catch(() => {});
    }
  };

  const makeOffer = async () => {
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit('webrtc-offer', { roomCode, offer });
  };

  useEffect(() => {
    if (!displayName) { router.push('/'); return; }

    const socket = io(API_URL, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', async () => {
      try {
        await setupLocalMedia();
        socket.emit('join-room', { roomCode, userId, name: displayName });
      } catch (err) {
        console.error(err);
        setError('Could not access camera or microphone');
      }
    });

    socket.on('room-update', async (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
      setJoined(true);

      if (!previewSyncedRef.current) {
        previewSyncedRef.current = true;
        if (!previewCameraEnabled || !previewMicEnabled) {
          socket.emit('toggle-media', { roomCode, userId, cameraOn: previewCameraEnabled, micOn: previewMicEnabled });
        }
      }

      const others = data.participants.filter((p) => p.userId !== userId);
      if (others.length === 0) { closePeer(); return; }
      if (!pcRef.current) createPeerConnection();
      if (others.length === 1 && userId < others[0].userId) {
        try { await makeOffer(); } catch (err) { console.error('offer error', err); }
      }
    });

    socket.on('participant-update', ({ userId: uid, cameraOn, micOn }) => {
      setParticipants((prev) => prev.map((p) => (p.userId === uid ? { ...p, cameraOn, micOn } : p)));
    });

    socket.on('meeting-started', () => setRoomStatus('ACTIVE'));
    socket.on('meeting-ended', () => setRoomStatus('ENDED'));
    socket.on('room-error', (msg: string) => setError(msg || 'Failed to join room'));

    socket.on('webrtc-offer', async (offer: RTCSessionDescriptionInit) => {
      try {
        const pc = createPeerConnection();
        if (pc.signalingState !== 'stable') return;
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { roomCode, answer });
      } catch (err) { console.error('offer handling error', err); }
    });

    socket.on('webrtc-answer', async (answer: RTCSessionDescriptionInit) => {
      try {
        const pc = pcRef.current;
        if (!pc || pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(answer);
      } catch (err) { console.error('answer handling error', err); }
    });

    socket.on('webrtc-ice-candidate', async (candidate: RTCIceCandidateInit) => {
      try {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.addIceCandidate(candidate);
      } catch (err) { console.error('ice error', err); }
    });

    socket.on('disconnect', () => clearRemote());

    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      closePeer();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [displayName, roomCode, router, userId]);

  // Re-attach local stream if video element was ready before stream (should rarely happen)
  useEffect(() => {
    if (joined && localVideoRef.current && localStreamRef.current) {
      if (!localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [joined]);

  // Re-attach remote stream after remotePresent flips true
  useEffect(() => {
    if (remotePresent && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remotePresent]);

  const toggleMedia = (type: 'camera' | 'mic') => {
    if (!localStreamRef.current || !socketRef.current || !me) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (type === 'camera' && videoTrack) videoTrack.enabled = !videoTrack.enabled;
    if (type === 'mic' && audioTrack) audioTrack.enabled = !audioTrack.enabled;
    socketRef.current.emit('toggle-media', {
      roomCode, userId,
      cameraOn: type === 'camera' ? !me.cameraOn : me.cameraOn,
      micOn: type === 'mic' ? !me.micOn : me.micOn,
    });
  };

  if (error) {
    return (
      <main style={{ minHeight: '100vh', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#b91c1c', fontSize: 18 }}>{error}</p>
          <button onClick={() => router.push('/')} style={{ marginTop: 12, height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: '#111', color: '#fff', cursor: 'pointer' }}>
            Back to home
          </button>
        </div>
      </main>
    );
  }

  if (!joined) {
    return (
      <main style={{ minHeight: '100vh', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111' }}>
        Joining room {roomCode}...
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f4f4', padding: 16, color: '#111' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}>

        {/* Header */}
        <div style={{ background: '#fff', border: '1px solid #e7e7e7', borderRadius: 24, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Room {roomCode}</h1>
            <p style={{ margin: '6px 0 0', color: '#666' }}>
              Signed in as <strong style={{ color: '#111' }}>{displayName}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '8px 14px', borderRadius: 999, background: roomStatus === 'WAITING' ? '#fef3c7' : roomStatus === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: roomStatus === 'WAITING' ? '#92400e' : roomStatus === 'ACTIVE' ? '#166534' : '#991b1b', fontSize: 13, fontWeight: 700 }}>
              {roomStatus}
            </span>
            <button
              onClick={() => {
                localStreamRef.current?.getTracks().forEach((t) => t.stop());
                closePeer();
                socketRef.current?.disconnect();
                router.push('/');
              }}
              style={{ height: 44, padding: '0 16px', borderRadius: 14, border: '1px solid #e7e7e7', background: '#fff', color: '#111', fontWeight: 600, cursor: 'pointer' }}
            >
              Leave
            </button>
          </div>
        </div>

        {/* Host controls */}
        {isHost && roomStatus === 'WAITING' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => socketRef.current?.emit('start-meeting', { roomCode })} style={{ height: 48, padding: '0 20px', borderRadius: 14, border: 'none', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Start Meeting
            </button>
          </div>
        )}
        {isHost && roomStatus === 'ACTIVE' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => socketRef.current?.emit('end-meeting', { roomCode })} style={{ height: 48, padding: '0 20px', borderRadius: 14, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              End Meeting
            </button>
          </div>
        )}

        {/*
          ─────────────────────────────────────────────────────────
          VIDEO STAGE
          Both <video> elements are ALWAYS in the DOM.
          CSS controls their size/position based on layout mode.
          ─────────────────────────────────────────────────────────
        */}
        <div style={{ background: '#fff', border: '1px solid #e7e7e7', borderRadius: 24, overflow: 'hidden' }}>

          {/* ── PiP mode: full remote + draggable local overlay ── */}
          {isPipMode && (
            <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', background: '#222' }}>

              {/* Remote — full size */}
              <div style={{ position: 'absolute', inset: 0 }}>
                {remotePresent ? (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {remotePeer && !remotePeer.cameraOn && <CameraOffAvatar name={remotePeer.name} />}
                  </>
                ) : (
                  // Hidden placeholder keeps remoteVideoRef mounted
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 15 }}>
                      Connecting to {remotePeer?.name ?? 'participant'}...
                    </div>
                  </>
                )}
                <NameBadge name={remotePeer?.name ?? 'Guest'} isHost={remotePeer?.isHost ?? false} isSelf={false} micOn={remotePeer?.micOn ?? true} />
              </div>

              {/* Local — draggable PiP overlay */}
              <div
                ref={pipRef}
                onPointerDown={onPipPointerDown}
                onPointerMove={onPipPointerMove}
                onPointerUp={onPipPointerUp}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  width: 180,
                  aspectRatio: '16 / 9',
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '2px solid #fff',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  cursor: 'grab',
                  zIndex: 10,
                  touchAction: 'none',
                  transform: `translate(${pipOffset.x}px, ${pipOffset.y}px)`,
                }}
              >
                <video ref={setLocalVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                {!me?.cameraOn && <CameraOffAvatar name={displayName} />}
                <div style={{ position: 'absolute', bottom: 4, left: 6, zIndex: 2 }}>
                  <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>You</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Solo mode: just local, full width ── */}
          {isSoloMode && (
            <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', background: '#ddd' }}>
              <video ref={setLocalVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              {/* Remote video hidden but mounted so ref never breaks */}
              <video ref={setRemoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
              {!me?.cameraOn && <CameraOffAvatar name={displayName} />}
              <NameBadge name={displayName} isHost={me?.isHost ?? false} isSelf micOn={me?.micOn ?? true} />
            </div>
          )}

          {/* ── Grid mode: 3+ participants ── */}
          {isGridMode && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2 }}>
              {/* Local tile */}
              <div style={{ aspectRatio: '16 / 9', position: 'relative', background: '#ddd' }}>
                <video ref={setLocalVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                {!me?.cameraOn && <CameraOffAvatar name={displayName} />}
                <NameBadge name={displayName} isHost={me?.isHost ?? false} isSelf micOn={me?.micOn ?? true} />
              </div>
              {/* Remote tile */}
              <div style={{ aspectRatio: '16 / 9', position: 'relative', background: '#ddd' }}>
                {remotePresent ? (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {remotePeer && !remotePeer.cameraOn && <CameraOffAvatar name={remotePeer.name} />}
                  </>
                ) : (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 14 }}>
                      Waiting for another participant
                    </div>
                  </>
                )}
                <NameBadge name={remotePeer?.name ?? 'Guest'} isHost={remotePeer?.isHost ?? false} isSelf={false} micOn={remotePeer?.micOn ?? true} />
              </div>
            </div>
          )}

          {/* Controls bar — always visible */}
          <div style={{ display: 'flex', gap: 12, padding: 12 }}>
            <button
              onClick={() => toggleMedia('camera')}
              style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid #e7e7e7', background: me?.cameraOn ? '#fff' : '#efefef', color: me?.cameraOn ? '#111' : '#b91c1c', fontWeight: 700, cursor: 'pointer' }}
            >
              {me?.cameraOn ? '📷 Camera On' : '📷 Camera Off'}
            </button>
            <button
              onClick={() => toggleMedia('mic')}
              style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid #e7e7e7', background: me?.micOn ? '#fff' : '#efefef', color: me?.micOn ? '#111' : '#b91c1c', fontWeight: 700, cursor: 'pointer' }}
            >
              {me?.micOn ? '🎙 Mic On' : '🎙 Mic Off'}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}