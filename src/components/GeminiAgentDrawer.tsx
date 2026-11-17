import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { AgentChatMessage, AgentPersona } from '../types/gym';

interface GeminiAgentDrawerProps {
  open: boolean;
  onClose: () => void;
  messages: AgentChatMessage[];
  sending: boolean;
  persona: AgentPersona;
  onChangePersona: (persona: AgentPersona) => void;
  onClearChat: () => void;
  onSendMessage: (text: string) => Promise<string | null>;
  onTranscribeAudio: (audioBase64: string, mimeType: string) => Promise<string>;
  onSpeakText: (
    text: string
  ) => Promise<{ audioBase64: string; mimeType: string; useBrowserVoice?: boolean }>;
}

const PERSONAS: AgentPersona[] = [
  'Club Manager',
  'Front Desk Helper',
  'Sales Coach',
  'Head Trainer',
];

const PROMPT_GROUPS: { label: string; prompts: string[] }[] = [
  {
    label: 'Ask for Insights',
    prompts: [
      'Give me a quick club briefing for today',
      'Who has overdue payments or hasn’t visited lately?',
      'Which classes today still have open spots or a waitlist?',
    ],
  },
  {
    label: 'Make Instant Updates',
    prompts: [
      'Check Marcus Thorne into the Strength area',
      'Save a fitness checkup for Maya Lin (132 lbs, 55.2 cardio score)',
      'Send reminders for expiring memberships and due follow-ups',
    ],
  },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#0F172A]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={idx} className="italic text-[#334155]">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <span
          key={idx}
          className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-medium text-[#0F172A]"
        >
          {token.slice(1, -1)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

const FormattedReply: React.FC<{ content: string }> = ({ content }) => {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    // Section heading (#, ##, ###)
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      blocks.push(
        <div
          key={`h-${i}`}
          className="pt-1 text-[13px] font-semibold text-[#0F172A] tracking-tight"
        >
          {renderInlineFormatting(headingMatch[1])}
        </div>
      );
      i += 1;
      continue;
    }

    // Unordered list (- , * , • )
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, '').trim());
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1.5 pl-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#334155]">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#059669] shrink-0" />
              <span className="flex-1">{renderInlineFormatting(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. , 2. )
    if (/^\d+\.\s+/.test(line)) {
      const items: { num: string; text: string }[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const match = lines[i].trim().match(/^(\d+)\.\s+(.+)$/);
        if (match) {
          items.push({ num: match[1], text: match[2] });
        }
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="space-y-1.5 pl-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#334155]">
              <span className="mt-0.5 min-w-[16px] text-[12px] font-semibold text-[#059669]">
                {item.num}.
              </span>
              <span className="flex-1">{renderInlineFormatting(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph (group contiguous non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,4}\s+/.test(lines[i].trim()) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-[13px] leading-relaxed text-[#1E293B]">
        {renderInlineFormatting(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-2">{blocks}</div>;
};

export const GeminiAgentDrawer: React.FC<GeminiAgentDrawerProps> = ({
  open,
  onClose,
  messages,
  sending,
  persona,
  onChangePersona,
  onClearChat,
  onSendMessage,
  onTranscribeAudio,
  onSpeakText,
}) => {
  const [input, setInput] = useState('');
  const [voiceRepliesOn, setVoiceRepliesOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, sending, transcribing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!open) return null;

  const stopAudioPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  const speakWithBrowserFallback = (text: string, messageId: string): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    const clean = stripMarkdownForSpeech(text).slice(0, 1200);
    if (!clean) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
    };
    utterance.onerror = () => {
      setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
    };
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const playReplyVoice = async (text: string, messageId: string) => {
    if (!text.trim()) return;
    if (speakingMessageId === messageId) {
      stopAudioPlayback();
      return;
    }
    stopAudioPlayback();
    setVoiceError(null);
    setLoadingAudioId(messageId);
    try {
      const { audioBase64, mimeType, useBrowserVoice } = await onSpeakText(text);
      if (useBrowserVoice || !audioBase64) {
        const fellBack = speakWithBrowserFallback(text, messageId);
        if (!fellBack) {
          setVoiceError('Voice playback is unavailable in this browser.');
          setSpeakingMessageId(null);
        }
        return;
      }
      const audio = new Audio(`data:${mimeType || 'audio/wav'};base64,${audioBase64}`);
      audioPlayerRef.current = audio;
      setSpeakingMessageId(messageId);
      audio.onended = () => {
        setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
        audioPlayerRef.current = null;
      };
      audio.onerror = () => {
        setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
        audioPlayerRef.current = null;
      };
      await audio.play();
    } catch {
      const fellBack = speakWithBrowserFallback(text, messageId);
      if (!fellBack) {
        setVoiceError('Unable to play voice reply right now.');
        setSpeakingMessageId(null);
      }
    } finally {
      setLoadingAudioId(null);
    }
  };

  const handleCopyReply = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(stripMarkdownForSpeech(text));
      setCopiedId(messageId);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === messageId ? null : cur));
      }, 1800);
    } catch {
      // Ignore clipboard permission denial
    }
  };

  const submitTextAndMaybeSpeak = async (text: string, speakAfter: boolean) => {
    setVoiceError(null);
    const reply = await onSendMessage(text);
    if (reply && speakAfter) {
      void playReplyVoice(reply, `auto-${Date.now()}`);
    }
  };

  const triggerSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || transcribing) return;
    setInput('');
    await submitTextAndMaybeSpeak(trimmed, voiceRepliesOn);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await triggerSend();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void triggerSend();
    }
  };

  const cleanupRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    setRecordSeconds(0);
  };

  const startVoiceRecording = async () => {
    setVoiceError(null);
    stopAudioPlayback();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const supportedType = preferredTypes.find((t) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
      );

      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        cleanupRecording();

        if (blob.size < 400) {
          setVoiceError('Recording was too short. Please try speaking again.');
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const transcript = await onTranscribeAudio(base64, mime);
          if (!transcript.trim()) {
            setVoiceError('I didn’t catch that clearly. Could you try speaking again?');
            return;
          }
          await submitTextAndMaybeSpeak(transcript.trim(), true);
        } catch (err) {
          setVoiceError(
            err instanceof Error ? err.message : 'Could not understand that voice clip.'
          );
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      cleanupRecording();
      setVoiceError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Please allow microphone access in your browser to use voice chat.'
          : 'Could not access your microphone.'
      );
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    audioChunksRef.current = [];
    cleanupRecording();
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/35"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-xl bg-white h-full border-l border-[#E2E8F0] flex flex-col shadow-[0_8px_24px_-4px_rgba(15,23,42,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-[#84CC16]" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F172A]">
                Kinetix Club Concierge
              </h2>
              <p className="text-xs text-[#64748B]">
                Executive gym assistant — ask questions or update records by text or voice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (voiceRepliesOn) stopAudioPlayback();
                setVoiceRepliesOn((v) => !v);
              }}
              title={voiceRepliesOn ? 'Mute automatic voice replies' : 'Speak replies out loud'}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                voiceRepliesOn
                  ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B]'
              }`}
            >
              {voiceRepliesOn ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {voiceRepliesOn ? 'Voice On' : 'Voice Off'}
              </span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  stopAudioPlayback();
                  onClearChat();
                }}
                title="Start a new conversation"
                aria-label="Start a new conversation"
                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopAudioPlayback();
                onClose();
              }}
              aria-label="Close assistant"
              className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Assistant Role Selector */}
        <div className="px-6 py-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-semibold text-[#64748B] mr-1 whitespace-nowrap">
            Style:
          </span>
          {PERSONAS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onChangePersona(role)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                persona === role
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8FAFC]">
          {messages.length === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F172A]">
                    Good to see you. How can I help run the club?
                  </div>
                  <p className="mt-1 text-xs text-[#475569] leading-relaxed">
                    Ask in plain everyday language or tap the microphone to speak. I give clear, practical answers and can look up or update members, classes, prospects, billing, and reminders.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {PROMPT_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                      {group.label}
                    </div>
                    <div className="space-y-1.5">
                      {group.prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void submitTextAndMaybeSpeak(prompt, voiceRepliesOn)}
                          disabled={sending || transcribing}
                          className="w-full text-left rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:border-[#059669] hover:bg-[#ECFDF5]/60 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[92%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#0F172A] text-white text-[13px] leading-relaxed whitespace-pre-wrap'
                    : 'bg-white border border-[#E2E8F0] text-[#0F172A]'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <FormattedReply content={msg.content} />
                )}
              </div>

              {msg.toolActions && msg.toolActions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[92%]">
                  {msg.toolActions.map((act, idx) => (
                    <span
                      key={`${msg.id}-tool-${idx}`}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        act.mutated
                          ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                          : 'border-[#E2E8F0] bg-white text-[#475569]'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      {act.summary}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-1.5 flex items-center gap-3">
                <span className="text-[10px] text-[#94A3B8]">{msg.timestamp}</span>
                {msg.role === 'assistant' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void playReplyVoice(msg.content, msg.id)}
                      disabled={loadingAudioId === msg.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669] hover:text-[#047857] cursor-pointer disabled:opacity-50"
                    >
                      {speakingMessageId === msg.id ? (
                        <>
                          <Square className="h-2.5 w-2.5 fill-current" />
                          Stop
                        </>
                      ) : loadingAudioId === msg.id ? (
                        'Preparing voice...'
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" />
                          Listen
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopyReply(msg.content, msg.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-[#059669]" />
                          <span className="text-[#059669]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {(sending || transcribing) && (
            <div className="flex items-start">
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#64748B]">
                <span className="h-2 w-2 rounded-full bg-[#059669] animate-pulse" />
                {transcribing
                  ? 'Listening to your voice message...'
                  : 'Reviewing your club data and preparing an answer...'}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="px-4 py-2 bg-[#FEF2F2] border-t border-[#FECACA] text-xs font-medium text-[#B91C1C] flex items-center justify-between gap-2">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="text-[11px] font-semibold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input / Voice Bar */}
        <div className="p-4 border-t border-[#E2E8F0] bg-white">
          {recording ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Mic className="h-4 w-4 text-[#059669]" />
                <div>
                  <div className="text-xs font-semibold text-[#047857]">
                    Listening... {formatDuration(recordSeconds)}
                  </div>
                  <div className="text-[11px] text-[#059669]">
                    Speak naturally, then tap Stop &amp; Send
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop &amp; Send
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void startVoiceRecording()}
                disabled={sending || transcribing}
                title="Speak your request"
                aria-label="Speak your request"
                className="inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-[#059669] hover:border-[#059669] hover:bg-[#ECFDF5] disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Mic className="h-4 w-4" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask a question or give an instruction (Enter to send)..."
                className="flex-1 resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs leading-relaxed text-[#0F172A] focus:outline-none focus:border-[#059669] max-h-[120px]"
              />

              <button
                type="submit"
                disabled={sending || transcribing || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
};

