'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Mode = 'idle' | 'create' | 'join';
type MeetingType = 'now' | 'scheduled';

export default function HomePage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [meetingType, setMeetingType] = useState<MeetingType>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const saveName = () => {
    sessionStorage.setItem('displayName', name.trim());
  };

  const stopPreview = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => stopPreview();
  }, []);

  const startPreview = async () => {
    try {
      setError('');
      stopPreview();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      previewStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) videoTrack.enabled = cameraEnabled;
      if (audioTrack) audioTrack.enabled = micEnabled;

      setShowPreview(true);
    } catch (err) {
      console.error(err);
      setError('Could not access camera or microphone');
    }
  };

  // Attach stream to video after element mounts
  useEffect(() => {
    if (showPreview && videoRef.current && previewStreamRef.current) {
      videoRef.current.srcObject = previewStreamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [showPreview]);

  const togglePreviewCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    const track = previewStreamRef.current?.getVideoTracks()[0];
    if (track) track.enabled = next;
  };

  const togglePreviewMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    const track = previewStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = next;
  };

  const createRoom = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      saveName();
      const hostId = `host-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('hostId', hostId);

      const res = await fetch(`${API}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${name.trim()}'s Meeting`,
          hostId,
          hostName: name.trim(),
          meetingType,
          scheduledAt: meetingType === 'scheduled' ? scheduledAt : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create room');
      const data: { code: string } = await res.json();
      setGeneratedCode(data.code);
    } catch (err) {
      console.error(err);
      setError('Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const beginJoinFlow = async () => {
    if (!name.trim() || !joinCode.trim()) return;
    saveName();
    await startPreview();
  };

  const joinRoom = () => {
    if (!name.trim() || !joinCode.trim()) return;
    sessionStorage.setItem('previewCameraEnabled', String(cameraEnabled));
    sessionStorage.setItem('previewMicEnabled', String(micEnabled));
    stopPreview();
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  };

  const previewGeneratedRoom = async () => {
    if (!generatedCode) return;
    setJoinCode(generatedCode);
    await startPreview();
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #e7e7e7', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.08)', padding: 24 }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: '#f8f8f8', border: '1px solid #e7e7e7', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            🎥
          </div>
          <h1 style={{ margin: 0, color: '#111', fontSize: 32 }}>VideoCall</h1>
          <p style={{ marginTop: 8, color: '#666', fontSize: 14 }}>Create, schedule, preview and join meetings</p>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#111' }}>Your Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={{ width: '100%', height: 54, borderRadius: 16, border: '1px solid #e7e7e7', background: '#f8f8f8', padding: '0 18px', fontSize: 16, color: '#111', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {!showPreview && generatedCode === '' && (
          <>
            <button
              onClick={() => setMode('create')}
              style={{ width: '100%', height: 54, borderRadius: 16, background: '#111', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              Create Meeting
            </button>

            {mode === 'create' && (
              <div style={{ marginTop: 16, borderRadius: 20, border: '1px solid #e7e7e7', background: '#f8f8f8', padding: 16 }}>
                <p style={{ margin: '0 0 12px', color: '#111', fontWeight: 600 }}>
                  Do you want to create the meeting for now or for some date?
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <button
                    onClick={() => setMeetingType('now')}
                    style={{ flex: 1, height: 48, borderRadius: 14, border: meetingType === 'now' ? 'none' : '1px solid #e7e7e7', background: meetingType === 'now' ? '#111' : '#fff', color: meetingType === 'now' ? '#fff' : '#111', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Meet Now
                  </button>
                  <button
                    onClick={() => setMeetingType('scheduled')}
                    style={{ flex: 1, height: 48, borderRadius: 14, border: meetingType === 'scheduled' ? 'none' : '1px solid #e7e7e7', background: meetingType === 'scheduled' ? '#111' : '#fff', color: meetingType === 'scheduled' ? '#fff' : '#111', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Schedule
                  </button>
                </div>

                {meetingType === 'scheduled' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    style={{ width: '100%', height: 54, borderRadius: 16, border: '1px solid #e7e7e7', background: '#fff', padding: '0 18px', fontSize: 16, color: '#111', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }}
                  />
                )}

                <button
                  onClick={createRoom}
                  disabled={creating || !name.trim() || (meetingType === 'scheduled' && !scheduledAt)}
                  style={{ width: '100%', height: 52, borderRadius: 16, background: '#111', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: creating || !name.trim() || (meetingType === 'scheduled' && !scheduledAt) ? 0.5 : 1 }}
                >
                  {creating ? 'Generating...' : 'Generate Meeting Code'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e7e7e7' }} />
              <span style={{ fontSize: 11, letterSpacing: 2, color: '#666', fontWeight: 700 }}>OR JOIN</span>
              <div style={{ flex: 1, height: 1, background: '#e7e7e7' }} />
            </div>

            <div style={{ borderRadius: 20, border: mode === 'join' ? '1px solid #e7e7e7' : 'none', background: mode === 'join' ? '#f8f8f8' : 'transparent', padding: mode === 'join' ? 16 : 0 }}>
              <button
                onClick={() => setMode(mode === 'join' ? 'idle' : 'join')}
                style={{ width: '100%', height: 52, borderRadius: 16, border: '1px solid #e7e7e7', background: '#fff', color: '#111', fontWeight: 700, cursor: 'pointer', marginBottom: mode === 'join' ? 14 : 0 }}
              >
                Join Existing Meeting
              </button>

              {mode === 'join' && (
                <>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    maxLength={6}
                    style={{ width: '100%', height: 54, borderRadius: 16, border: '1px solid #e7e7e7', background: '#fff', padding: '0 18px', fontSize: 16, fontFamily: 'monospace', letterSpacing: 4, color: '#111', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }}
                  />
                  <button
                    onClick={() => void beginJoinFlow()}
                    disabled={!name.trim() || !joinCode.trim()}
                    style={{ width: '100%', height: 52, borderRadius: 16, background: '#111', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: !name.trim() || !joinCode.trim() ? 0.5 : 1 }}
                  >
                    Preview Camera & Mic
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {generatedCode !== '' && !showPreview && (
          <div style={{ marginTop: 18, borderRadius: 20, border: '1px solid #e7e7e7', background: '#f8f8f8', padding: 20, textAlign: 'center' }}>
            <p style={{ color: '#666', marginTop: 0 }}>Meeting code generated</p>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#111', letterSpacing: 6 }}>{generatedCode}</div>
            <p style={{ color: '#666', fontSize: 14 }}>
              {meetingType === 'scheduled' ? `Scheduled for ${scheduledAt}` : 'Ready to use now'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                style={{ flex: 1, height: 52, borderRadius: 16, border: '1px solid #e7e7e7', background: '#fff', color: '#111', fontWeight: 700, cursor: 'pointer' }}
              >
                Copy Code
              </button>
              <button
                onClick={() => void previewGeneratedRoom()}
                style={{ flex: 1, height: 52, borderRadius: 16, border: 'none', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Preview & Join Now
              </button>
            </div>
          </div>
        )}

        {showPreview && (
          <div style={{ marginTop: 18, borderRadius: 20, border: '1px solid #e7e7e7', background: '#f8f8f8', padding: 16 }}>
            <h3 style={{ marginTop: 0, color: '#111' }}>Preview before joining</h3>

            {/* FIX 2: relative wrapper so avatar overlays the video */}
            <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 18, overflow: 'hidden', border: '1px solid #e7e7e7', background: '#ddd', marginBottom: 16, position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              {/* Avatar shown when camera is disabled */}
              {!cameraEnabled && (
                <div style={{ position: 'absolute', inset: 0, background: '#e7e7e7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800 }}>
                    {name ? name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>{name || 'You'}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <button
                onClick={togglePreviewCamera}
                style={{ flex: 1, height: 48, borderRadius: 14, border: '1px solid #e7e7e7', background: cameraEnabled ? '#fff' : '#efefef', color: cameraEnabled ? '#111' : '#b91c1c', fontWeight: 700, cursor: 'pointer' }}
              >
                {cameraEnabled ? '📷 Camera On' : '📷 Camera Off'}
              </button>
              <button
                onClick={togglePreviewMic}
                style={{ flex: 1, height: 48, borderRadius: 14, border: '1px solid #e7e7e7', background: micEnabled ? '#fff' : '#efefef', color: micEnabled ? '#111' : '#b91c1c', fontWeight: 700, cursor: 'pointer' }}
              >
                {micEnabled ? '🎙 Mic On' : '🎙 Mic Off'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { stopPreview(); setShowPreview(false); }}
                style={{ flex: 1, height: 52, borderRadius: 16, border: '1px solid #e7e7e7', background: '#fff', color: '#111', fontWeight: 700, cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={joinRoom}
                style={{ flex: 1, height: 52, borderRadius: 16, border: 'none', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Join Room
              </button>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}