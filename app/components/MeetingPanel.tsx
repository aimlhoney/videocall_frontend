'use client';

import { useState } from 'react';
import { CreateFlow } from './CreateFlow';
import { JoinFlow } from './JoinFlow';
import { GeneratedCode } from './GeneratedCode';
import { PreviewScreen } from './PreviewScreen';

type Mode = 'idle' | 'create' | 'join';
type MeetingType = 'now' | 'scheduled';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function MeetingPanel() {
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
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const saveName = () => sessionStorage.setItem('displayName', name.trim());

  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }
  };

  const startPreview = async () => {
    try {
      setError('');
      stopPreview();

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access requires HTTPS or localhost.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) videoTrack.enabled = cameraEnabled;
      if (audioTrack) audioTrack.enabled = micEnabled;

      setPreviewStream(stream);
      setShowPreview(true);
    } catch (err) {
      console.error(err);
      setError('Could not access camera or microphone');
    }
  };

const togglePreviewCamera = async () => {
  if (!previewStream) return;

  if (cameraEnabled) {
    // Turn OFF — stop track completely (kills hardware light)
    previewStream.getVideoTracks().forEach((t) => {
      t.stop();
      previewStream.removeTrack(t);
    });
    setCameraEnabled(false);
  } else {
    // Turn ON — get fresh camera stream
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      previewStream.addTrack(newVideoTrack);
      // Force PreviewScreen video element to refresh
      setPreviewStream(new MediaStream(previewStream.getTracks()));
      setCameraEnabled(true);
    } catch (err) {
      console.error('Camera restart error:', err);
      setError('Could not restart camera');
    }
  }
};

  const togglePreviewMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    const track = previewStream?.getAudioTracks()[0];
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
    window.location.href = `/room/${joinCode.trim().toUpperCase()}`;
  };

  const previewGeneratedRoom = async () => {
    if (!generatedCode) return;
    setJoinCode(generatedCode);
    await startPreview();
  };

  const handleBack = () => {
    stopPreview();
    setShowPreview(false);
  };

  return (
    <section style={{
    background: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
    padding: 'clamp(16px, 5vw, 32px)',
    border: '1px solid rgba(255,255,255,0.15)',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
    }}>

      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <h2 style={{ margin: 0, color: '#111', fontSize: 22, fontWeight: 800 }}>
          Get Started
        </h2>
        <p style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
          Create, schedule, preview and join meetings
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 12,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* Name input — always visible */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#111', fontSize: 14 }}>
          Your Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 16,
            border: '1px solid #e7e7e7',
            background: '#f8f8f8',
            padding: '0 18px',
            fontSize: 15,
            color: '#111',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Preview screen */}
      {showPreview && (
        <PreviewScreen
          name={name}
          stream={previewStream}
          cameraEnabled={cameraEnabled}
          micEnabled={micEnabled}
          onToggleCamera={togglePreviewCamera}
          onToggleMic={togglePreviewMic}
          onBack={handleBack}
          onJoin={joinRoom}
        />
      )}

      {/* Generated code screen */}
      {!showPreview && generatedCode !== '' && (
        <GeneratedCode
          code={generatedCode}
          meetingType={meetingType}
          scheduledAt={scheduledAt}
          onCopy={() => navigator.clipboard.writeText(generatedCode)}
          onPreviewAndJoin={() => void previewGeneratedRoom()}
        />
      )}

      {/* Main create/join flow */}
      {!showPreview && generatedCode === '' && (
        <>
          {/* Create Meeting button */}
          <button
            onClick={() => setMode(mode === 'create' ? 'idle' : 'create')}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 16,
              background: '#111',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Create Meeting
          </button>

          {mode === 'create' && (
            <CreateFlow
              name={name}
              meetingType={meetingType}
              scheduledAt={scheduledAt}
              creating={creating}
              onMeetingTypeChange={setMeetingType}
              onScheduledAtChange={setScheduledAt}
              onCreateRoom={createRoom}
            />
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e7e7e7' }} />
            <span style={{ fontSize: 11, letterSpacing: 2, color: '#999', fontWeight: 700 }}>
              OR JOIN
            </span>
            <div style={{ flex: 1, height: 1, background: '#e7e7e7' }} />
          </div>

          {/* Join Meeting button */}
          <div style={{
            borderRadius: 20,
            border: mode === 'join' ? '1px solid #e7e7e7' : 'none',
            background: mode === 'join' ? '#f8f8f8' : 'transparent',
            padding: mode === 'join' ? 16 : 0,
          }}>
            <button
              onClick={() => setMode(mode === 'join' ? 'idle' : 'join')}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 16,
                border: '1px solid #e7e7e7',
                background: '#fff',
                color: '#111',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                marginBottom: mode === 'join' ? 14 : 0,
              }}
            >
              Join Existing Meeting
            </button>

            {mode === 'join' && (
              <JoinFlow
                name={name}
                joinCode={joinCode}
                onJoinCodeChange={setJoinCode}
                onPreview={() => void beginJoinFlow()}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}