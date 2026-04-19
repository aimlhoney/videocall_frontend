'use client';

import { useEffect, useRef } from 'react';

export function PreviewScreen({
  name,
  stream,
  cameraEnabled,
  micEnabled,
  onToggleCamera,
  onToggleMic,
  onBack,
  onJoin,
}: {
  name: string;
  stream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onBack: () => void;
  onJoin: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div style={{
      marginTop: 18,
      borderRadius: 20,
      border: '1px solid #e7e7e7',
      background: '#f8f8f8',
      padding: 16,
    }}>
      <h3 style={{ marginTop: 0, marginBottom: 14, color: '#111', fontSize: 16, fontWeight: 700 }}>
        Preview before joining
      </h3>

      {/* Video + avatar overlay */}
      <div style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid #e7e7e7',
        background: '#ddd',
        marginBottom: 14,
        position: 'relative',
      }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
          }}
        />

        {/* Avatar shown when camera is off */}
        {!cameraEnabled && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#e7e7e7',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#111',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 800,
            }}>
              {name ? name.charAt(0).toUpperCase() : '?'}
            </div>
            <span style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>
              {name || 'You'}
            </span>
          </div>
        )}

        {/* Live indicator when camera is on */}
        {cameraEnabled && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Live Preview
          </div>
        )}
      </div>

      {/* Camera / Mic toggles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <button
          onClick={onToggleCamera}
          style={{
            flex: 1,
            height: 46,
            borderRadius: 14,
            border: '1px solid #e7e7e7',
            background: cameraEnabled ? '#fff' : '#efefef',
            color: cameraEnabled ? '#111' : '#b91c1c',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {cameraEnabled ? '📷 Camera On' : '📷 Camera Off'}
        </button>

        <button
          onClick={onToggleMic}
          style={{
            flex: 1,
            height: 46,
            borderRadius: 14,
            border: '1px solid #e7e7e7',
            background: micEnabled ? '#fff' : '#efefef',
            color: micEnabled ? '#111' : '#b91c1c',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {micEnabled ? '🎙 Mic On' : '🎙 Mic Off'}
        </button>
      </div>

      {/* Back / Join */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            border: '1px solid #e7e7e7',
            background: '#fff',
            color: '#111',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Back
        </button>

        <button
          onClick={onJoin}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            border: 'none',
            background: '#111',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Join Room
        </button>
      </div>
    </div>
  );
}