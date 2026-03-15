'use client';

import { useState, useRef, useCallback } from 'react';
import { MaterialIcon } from '@/components/ui/material-icon';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscribed, disabled }: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    if (disabled || transcribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setDuration(0);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return; // too short

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');

          const res = await fetch('/api/proxy/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.text) {
            onTranscribed(data.text);
          } else {
            alert(`语音转写失败: ${data.error || '未知错误'}`);
          }
        } catch {
          alert('语音服务未连接，请确认 Python 服务已启动');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert('无法访问麦克风，请检查浏览器权限');
    }
  }, [disabled, transcribing, onTranscribed]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <button
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onMouseLeave={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={disabled || transcribing}
      title={recording ? '松开结束录音' : '按住说话'}
      className={cn(
        'flex h-10 items-center justify-center gap-1 rounded-xl transition-all',
        recording
          ? 'w-24 bg-insufficient-bg text-insufficient-text ring-2 ring-insufficient-icon'
          : transcribing
            ? 'w-10 bg-partial-bg text-partial-text'
            : 'w-10 text-on-surface-low hover:bg-surface-2 hover:text-on-surface-medium',
        (disabled || transcribing) && !recording && 'opacity-50'
      )}
    >
      {recording ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-insufficient-icon" />
          <span className="text-label-md">{formatDuration(duration)}</span>
        </>
      ) : (
        <MaterialIcon
          name={transcribing ? 'hourglass_empty' : 'mic'}
          size={20}
          className={transcribing ? 'animate-spin' : ''}
        />
      )}
    </button>
  );
}
