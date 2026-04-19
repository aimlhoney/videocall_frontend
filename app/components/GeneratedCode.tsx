'use client';

type MeetingType = 'now' | 'scheduled';

export function GeneratedCode({
  code,
  meetingType,
  scheduledAt,
  onCopy,
  onPreviewAndJoin,
}: {
  code: string;
  meetingType: MeetingType;
  scheduledAt: string;
  onCopy: () => void;
  onPreviewAndJoin: () => void;
}) {
  return (
    <div style={{
      marginTop: 18,
      borderRadius: 20,
      border: '1px solid #e7e7e7',
      background: '#f8f8f8',
      padding: 20,
      textAlign: 'center',
    }}>
      <p style={{ color: '#666', marginTop: 0, fontSize: 13 }}>
        Meeting code generated
      </p>

      <div style={{
        fontSize: 36,
        fontWeight: 800,
        color: '#111',
        letterSpacing: 6,
        marginBottom: 8,
      }}>
        {code}
      </div>

      <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
        {meetingType === 'scheduled'
          ? `Scheduled for ${scheduledAt}`
          : 'Ready to use now'}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
        <button
            onClick={onCopy}
            style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            border: '1px solid #e7e7e7',
            background: '#fff',
            color: '#111',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            }}
        >
            Copy Code
        </button>

        <button
            onClick={onPreviewAndJoin}
            style={{
            flex: 1.4,
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: '#111',
            color: '#fff',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            padding: '0 12px',
            }}
        >
            Preview & Join Now
        </button>
        </div>
    </div>
  );
}