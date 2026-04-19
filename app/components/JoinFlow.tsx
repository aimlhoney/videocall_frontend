'use client';

export function JoinFlow({
  name,
  joinCode,
  onJoinCodeChange,
  onPreview,
}: {
  name: string;
  joinCode: string;
  onJoinCodeChange: (val: string) => void;
  onPreview: () => void;
}) {
  const disabled = !name.trim() || !joinCode.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        value={joinCode}
        onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
        placeholder="Enter room code"
        maxLength={6}
        onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) onPreview(); }}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 16,
          border: '1px solid #e7e7e7',
          background: '#fff',
          padding: '0 18px',
          fontSize: 15,
          fontFamily: 'monospace',
          letterSpacing: 4,
          color: '#111',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      <button
        onClick={onPreview}
        disabled={disabled}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 16,
          border: 'none',
          background: '#111',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        Preview Camera & Mic
      </button>
    </div>
  );
}