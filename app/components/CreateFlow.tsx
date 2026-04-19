'use client';

type MeetingType = 'now' | 'scheduled';

export function CreateFlow({
  name,
  meetingType,
  scheduledAt,
  creating,
  onMeetingTypeChange,
  onScheduledAtChange,
  onCreateRoom,
}: {
  name: string;
  meetingType: MeetingType;
  scheduledAt: string;
  creating: boolean;
  onMeetingTypeChange: (type: MeetingType) => void;
  onScheduledAtChange: (val: string) => void;
  onCreateRoom: () => void;
}) {
  const disabled =
    creating || !name.trim() || (meetingType === 'scheduled' && !scheduledAt);

  return (
    <div style={{
      marginTop: 16,
      borderRadius: 20,
      border: '1px solid #e7e7e7',
      background: '#f8f8f8',
      padding: 16,
    }}>
      <p style={{ margin: '0 0 12px', color: '#111', fontWeight: 600, fontSize: 14 }}>
        Do you want to create the meeting for now or for some date?
      </p>

      {/* Now / Schedule toggle */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => onMeetingTypeChange('now')}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            border: meetingType === 'now' ? 'none' : '1px solid #e7e7e7',
            background: meetingType === 'now' ? '#111' : '#fff',
            color: meetingType === 'now' ? '#fff' : '#111',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Meet Now
        </button>
        <button
          onClick={() => onMeetingTypeChange('scheduled')}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            border: meetingType === 'scheduled' ? 'none' : '1px solid #e7e7e7',
            background: meetingType === 'scheduled' ? '#111' : '#fff',
            color: meetingType === 'scheduled' ? '#fff' : '#111',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Schedule
        </button>
      </div>

      {/* Date/time picker */}
      {meetingType === 'scheduled' && (
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 16,
            border: '1px solid #e7e7e7',
            background: '#fff',
            padding: '0 18px',
            fontSize: 15,
            color: '#111',
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 14,
          }}
        />
      )}

      {/* Generate button */}
      <button
        onClick={onCreateRoom}
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
        {creating ? 'Generating...' : 'Generate Meeting Code'}
      </button>
    </div>
  );
}