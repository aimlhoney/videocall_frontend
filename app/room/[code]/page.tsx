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
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: [
        'turn:16.171.9.161:3478?transport=udp',
        'turn:16.171.9.161:3478?transport=tcp',
      ],
      username: 'honey',
      credential: 'honeyturn123',
    },
  ],
};

function CameraOffAvatar({ name }: { name: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#f0f0f0',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: '#111',
        color: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 26, fontWeight: 800,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      }}>
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
      <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{name}</span>
    </div>
  );
}

function NameBadge({ name, isHost, isSelf, micOn }: {
  name: string; isHost: boolean; isSelf: boolean; micOn: boolean;
}) {
  return (
    <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center', zIndex: 2 }}>
      <span style={{
        background: 'rgba(0,0,0,0.55)', color: '#fff',
        fontSize: 11, fontWeight: 700, padding: '4px 10px',
        borderRadius: 999, backdropFilter: 'blur(8px)',
      }}>
        {name}{isHost ? ' · Host' : ''}{isSelf ? ' · You' : ''}
      </span>
      {!micOn && (
        <span style={{
          background: 'rgba(185,28,28,0.85)', color: '#fff',
          fontSize: 10, padding: '4px 8px', borderRadius: 999,
        }}>
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
  const pipRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [remotePresent, setRemotePresent] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roomStatus, setRoomStatus] = useState<'WAITING' | 'ACTIVE' | 'ENDED'>('WAITING');

  const [userId] = useState(() => {
    if (typeof window === 'undefined') return `user-${Math.random().toString(36).slice(2)}`;
    const existing = sessionStorage.getItem('hostId');
    return existing || `user-${Math.random().toString(36).slice(2)}`;
  });

  const displayName = typeof window !== 'undefined' ? sessionStorage.getItem('displayName') || '' : '';
  const previewCameraEnabled = typeof window !== 'undefined' ? sessionStorage.getItem('previewCameraEnabled') !== 'false' : true;
  const previewMicEnabled = typeof window !== 'undefined' ? sessionStorage.getItem('previewMicEnabled') !== 'false' : true;

  const isHost = participants.some((p) => p.userId === userId && p.isHost);
  const me = participants.find((p) => p.userId === userId);
  const remotePeer = participants.find((p) => p.userId !== userId);
  const isPipMode = participants.length === 2;
  const isGridMode = participants.length > 2;
  const isSoloMode = participants.length <= 1;

  const onPipPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startPos.current = { x: e.clientX - currentPos.current.x, y: e.clientY - currentPos.current.y };
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
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) socketRef.current?.emit('webrtc-ice-candidate', { roomCode, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      remoteStreamRef.current = stream;
      if (connectionTimerRef.current) { clearTimeout(connectionTimerRef.current); connectionTimerRef.current = null; }
      setConnectionTimeout(false);
      setRemotePresent(true);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') clearRemote();
    };
    return pc;
  };

  const setupLocalMedia = async () => {
  if (localStreamRef.current) return;

  // Only request video if camera was enabled in preview
  const stream = await navigator.mediaDevices.getUserMedia({
    video: previewCameraEnabled ? { facingMode: 'user' } : false,
    audio: true,
  });

  // If camera was disabled, create an empty video track placeholder
  if (!previewCameraEnabled) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 640, 480);
    }
    const silentVideoTrack = canvas.captureStream(0).getVideoTracks()[0];
    if (silentVideoTrack) {
      silentVideoTrack.enabled = false;
      stream.addTrack(silentVideoTrack);
    }
  }

  const audioTrack = stream.getAudioTracks()[0];
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
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = setTimeout(() => { setConnectionTimeout(true); }, 15000);
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

  useEffect(() => {
    if (joined && localVideoRef.current && localStreamRef.current) {
      if (!localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [joined]);

  useEffect(() => {
    if (remotePresent && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remotePresent]);

  const toggleMedia = async (type: 'camera' | 'mic') => {
  if (!localStreamRef.current || !socketRef.current || !me) return;

  if (type === 'mic') {
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
    socketRef.current.emit('toggle-media', {
      roomCode, userId,
      cameraOn: me.cameraOn,
      micOn: !me.micOn,
    });
    return;
  }

  if (type === 'camera') {
    if (me.cameraOn) {
      // ── Turn OFF — stop all video tracks ──
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current!.removeTrack(t);
      });

      // Replace with null in peer connection sender
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(null);

      // Refresh local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      socketRef.current.emit('toggle-media', {
        roomCode, userId, cameraOn: false, micOn: me.micOn,
      });

    } else {
  // ── Turn ON — get fresh camera stream ──
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
    });
    const newVideoTrack = newStream.getVideoTracks()[0];

    // Remove ALL old video tracks first (including canvas placeholder)
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.stop();
      localStreamRef.current!.removeTrack(t);
    });

    // Add fresh real camera track
    localStreamRef.current.addTrack(newVideoTrack);

    // Replace track in peer connection sender
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video' || s.track === null);
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    } else {
      pcRef.current?.addTrack(newVideoTrack, localStreamRef.current);
    }

    // Force video element full refresh
    if (localVideoRef.current) {
      localVideoRef.current.pause();
      localVideoRef.current.srcObject = null;
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.muted = true;
      await localVideoRef.current.play().catch(() => {});
    }

    socketRef.current.emit('toggle-media', {
      roomCode, userId, cameraOn: true, micOn: me.micOn,
    });

  } catch (err) {
    console.error('Camera restart failed:', err);
  }
}
  }
};

    // ── Error state ──
  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f4' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#b91c1c', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{error}</p>
          <button onClick={() => router.push('/')} style={{ height: 44, padding: '0 24px', borderRadius: 12, border: 'none', background: '#111', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (!joined) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f4' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
          <p style={{ color: '#666', fontSize: 15 }}>Joining room <strong style={{ color: '#111' }}>{roomCode}</strong>...</p>
        </div>
      </div>
    );
  }

  // ── Main room UI ──
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#f4f4f4',
      overflow: 'hidden',
      padding: '12px',
      gap: 10,
      boxSizing: 'border-box',
    }}>

      {/* Room info bar */}
      <div style={{
        flexShrink: 0,
        background: '#fff',
        border: '1px solid #e7e7e7',
        borderRadius: 16,
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>
            Room {roomCode}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
            Signed in as <strong style={{ color: '#111' }}>{displayName}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Status badge */}
          <span style={{
            padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: roomStatus === 'WAITING' ? '#fef3c7' : roomStatus === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
            color: roomStatus === 'WAITING' ? '#92400e' : roomStatus === 'ACTIVE' ? '#166534' : '#991b1b',
          }}>
            {roomStatus}
          </span>
          {/* Host controls */}
          {isHost && roomStatus === 'WAITING' && (
            <button
              onClick={() => socketRef.current?.emit('start-meeting', { roomCode })}
              style={{ height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Start
            </button>
          )}
          {isHost && roomStatus === 'ACTIVE' && (
            <button
              onClick={() => socketRef.current?.emit('end-meeting', { roomCode })}
              style={{ height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              End
            </button>
          )}
          {/* Leave button */}
          <button
            onClick={() => {
              localStreamRef.current?.getTracks().forEach((t) => t.stop());
              closePeer();
              socketRef.current?.disconnect();
              router.push('/');
            }}
            style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid #e7e7e7', background: '#fff', color: '#111', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Video stage */}
      <div style={{
        flex: 1,
        background: '#fff',
        border: '1px solid #e7e7e7',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', background: '#111', minHeight: 0 }}>

          {/* PiP mode */}
          {isPipMode && (
            <div style={{ position: 'absolute', inset: 0 }}>
              {/* Remote full screen */}
              <div style={{ position: 'absolute', inset: 0 }}>
                {remotePresent ? (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {remotePeer && !remotePeer.cameraOn && <CameraOffAvatar name={remotePeer.name} />}
                  </>
                ) : (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      {connectionTimeout ? (
                        <>
                          <div style={{ color: '#ff6b6b', fontSize: 15, fontWeight: 600 }}>Could not connect to {remotePeer?.name ?? 'participant'}</div>
                          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '0 20px' }}>Connection failed. Please check your internet and try rejoining.</div>
                          <button onClick={() => { setConnectionTimeout(false); window.location.reload(); }} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, background: '#4a90e2', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                            Rejoin Room
                          </button>
                        </>
                      ) : (
                        <>
                          <div style={{ color: '#aaa', fontSize: 14 }}>Connecting to {remotePeer?.name ?? 'participant'}...</div>
                          <div style={{ fontSize: 12, color: '#666' }}>This may take a few seconds</div>
                        </>
                      )}
                    </div>
                  </>
                )}
                <NameBadge name={remotePeer?.name ?? 'Guest'} isHost={remotePeer?.isHost ?? false} isSelf={false} micOn={remotePeer?.micOn ?? true} />
              </div>

              {/* Local PiP draggable */}
              <div
                ref={pipRef}
                onPointerDown={onPipPointerDown}
                onPointerMove={onPipPointerMove}
                onPointerUp={onPipPointerUp}
                style={{
                  position: 'absolute',
                  bottom: 16, right: 16,
                  width: 'clamp(100px, 25%, 160px)',
                  aspectRatio: '16/9',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '2px solid #fff',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  cursor: 'grab',
                  zIndex: 10,
                  touchAction: 'none',
                  transform: `translate(${pipOffset.x}px, ${pipOffset.y}px)`,
                }}
              >
                <video ref={setLocalVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                {!me?.cameraOn && <CameraOffAvatar name={displayName} />}
                <div style={{ position: 'absolute', bottom: 4, left: 6, zIndex: 2 }}>
                  <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>You</span>
                </div>
              </div>
            </div>
          )}

          {/* Solo mode */}
          {isSoloMode && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <video ref={setLocalVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <video ref={setRemoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
              {!me?.cameraOn && <CameraOffAvatar name={displayName} />}
              <NameBadge name={displayName} isHost={me?.isHost ?? false} isSelf micOn={me?.micOn ?? true} />
              {/* Waiting indicator */}
              <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, padding: '6px 14px', borderRadius: 999, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
                Waiting for others to join...
              </div>
            </div>
          )}

          {/* Grid mode */}
          {isGridMode && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <div style={{ position: 'relative', background: '#222' }}>
                <video ref={setLocalVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                {!me?.cameraOn && <CameraOffAvatar name={displayName} />}
                <NameBadge name={displayName} isHost={me?.isHost ?? false} isSelf micOn={me?.micOn ?? true} />
              </div>
              <div style={{ position: 'relative', background: '#222' }}>
                {remotePresent ? (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {remotePeer && !remotePeer.cameraOn && <CameraOffAvatar name={remotePeer.name} />}
                  </>
                ) : (
                  <>
                    <video ref={setRemoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13 }}>
                      Waiting for participant...
                    </div>
                  </>
                )}
                <NameBadge name={remotePeer?.name ?? 'Guest'} isHost={remotePeer?.isHost ?? false} isSelf={false} micOn={remotePeer?.micOn ?? true} />
              </div>
            </div>
          )}

        </div>

        {/* Controls bar */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          gap: 10,
          padding: '10px 12px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
        }}>
          <button
            onClick={() => toggleMedia('camera')}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              border: '1px solid #e7e7e7',
              background: me?.cameraOn ? '#fff' : '#fee2e2',
              color: me?.cameraOn ? '#111' : '#b91c1c',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {me?.cameraOn ? '📷 Camera On' : '📷 Camera Off'}
          </button>
          <button
            onClick={() => toggleMedia('mic')}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              border: '1px solid #e7e7e7',
              background: me?.micOn ? '#fff' : '#fee2e2',
              color: me?.micOn ? '#111' : '#b91c1c',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {me?.micOn ? '🎙 Mic On' : '🎙 Mic Off'}
          </button>
        </div>
      </div>

    </div>
  );
}