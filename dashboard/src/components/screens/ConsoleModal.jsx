import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Pause, Play, ArrowDown, Terminal } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';

const SOURCES = [
  { id: 'journal', label: 'Journal' },
  { id: 'dmesg',   label: 'Dmesg'   },
  { id: 'syslog',  label: 'Syslog'  },
];

const POLL_MS = 3000;

export function ConsoleModal({ screen, onClose }) {
  const [tab, setTab] = useState('journal');
  const [paused, setPaused] = useState(false);
  // One state slot per source so switching tabs doesn't lose history.
  const [streams, setStreams] = useState(() => Object.fromEntries(
    SOURCES.map(s => [s.id, { lines: [], lastIdx: 0 }])
  ));
  const streamsRef = useRef(streams);
  streamsRef.current = streams;

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Active-tab polling. We poll only the active source; other tabs remain
  // frozen at whatever they last had. Switching tabs doesn't reset their
  // history but does immediately fetch updates for the new active tab.
  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    const fetchAndAppend = async () => {
      if (cancelled) return;
      try {
        const since = streamsRef.current[tab]?.lastIdx ?? 0;
        const { lines, lastIdx } = await api.screenLogs(screen.id, tab, since);
        if (cancelled) return;
        if (lines.length > 0 || lastIdx !== since) {
          setStreams(prev => ({
            ...prev,
            [tab]: {
              lines: [...(prev[tab]?.lines || []), ...lines].slice(-1000),
              lastIdx,
            },
          }));
        }
      } catch {
        // Silent — don't crash the modal on a transient fetch error.
      }
    };

    fetchAndAppend();
    const id = setInterval(fetchAndAppend, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [tab, paused, screen.id]);

  const stream = streams[tab] || { lines: [], lastIdx: 0 };

  // Stop click + keydown propagation so the modal doesn't also close the
  // underlying DrillPanel when it's rendered inside DrillPanel's tree.
  const stopBubble = (e) => e.stopPropagation();

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose?.(); }}
      onKeyDown={stopBubble}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,43,73,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        zIndex: 110,
        animation: 'arc-fade 160ms ease-out',
      }}
    >
      <div
        onClick={stopBubble}
        style={{
          background: T.arcChar,
          color: '#E8E0D2',
          width: '100%',
          maxWidth: 960,
          height: '78vh',
          maxHeight: 720,
          display: 'flex', flexDirection: 'column',
          borderRadius: 14,
          boxShadow: T.shadowLg,
          overflow: 'hidden',
        }}
      >
        <Header
          screen={screen}
          tab={tab}
          onTab={setTab}
          paused={paused}
          onTogglePause={() => setPaused(p => !p)}
          onClose={onClose}
        />
        <LogPane lines={stream.lines} paused={paused} />
        <Footer screenName={screen.name} source={tab} count={stream.lines.length} />
      </div>
    </div>
  );
}

function Header({ screen, tab, onTab, paused, onTogglePause, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: 14,
      padding: '14px 18px',
      borderBottom: '1px solid rgba(232,224,210,0.12)',
      background: 'rgba(0,0,0,0.2)',
      flexShrink: 0,
    }}>
      <Terminal size={18} strokeWidth={1.75} color={T.arcSage} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.14em', color: 'rgba(232,224,210,0.55)',
          textTransform: 'uppercase',
        }}>
          Console · {screen.hostname}
        </div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: '#FAF7F2',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {screen.name}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(232,224,210,0.12)',
        borderRadius: 999,
        padding: 3,
      }}>
        {SOURCES.map(s => {
          const active = s.id === tab;
          return (
            <button
              key={s.id}
              onClick={() => onTab(s.id)}
              style={{
                padding: '6px 14px',
                fontFamily: T.fontDisplay, fontSize: 11.5, fontWeight: 700,
                letterSpacing: '0.06em',
                color: active ? T.arcNavy : 'rgba(232,224,210,0.7)',
                background: active ? T.arcSage : 'transparent',
                borderRadius: 999,
                border: 'none',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={onTogglePause}
        title={paused ? 'Resume' : 'Pause'}
        style={iconBtnStyle()}
      >
        {paused ? <Play size={14} strokeWidth={2} /> : <Pause size={14} strokeWidth={2} />}
      </button>
      <button onClick={onClose} aria-label="Close" style={iconBtnStyle()}>
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function iconBtnStyle() {
  return {
    width: 32, height: 32, borderRadius: 8,
    color: '#E8E0D2',
    background: 'rgba(255,255,255,0.06)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(232,224,210,0.12)',
  };
}

function LogPane({ lines, paused }) {
  const scrollRef = useRef(null);
  const [stuckToBottom, setStuckToBottom] = useState(true);

  // Auto-scroll to bottom unless the user has scrolled away.
  useEffect(() => {
    if (!stuckToBottom) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, stuckToBottom]);

  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStuckToBottom(dist < 40);
  }, []);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setStuckToBottom(true);
    }
  }, []);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          padding: '12px 18px',
          fontFamily: T.fontMono,
          fontSize: 12,
          lineHeight: 1.55,
          color: '#E8E0D2',
          background: T.arcChar,
        }}
      >
        {lines.length === 0 ? (
          <div style={{ color: 'rgba(232,224,210,0.45)', fontStyle: 'italic' }}>
            {paused
              ? 'Paused. Resume to receive new lines.'
              : 'Waiting for the first heartbeat (logs arrive in batches every ~30 s)…'}
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: colorFor(line),
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {!stuckToBottom && (
        <button
          onClick={jumpToBottom}
          style={{
            position: 'absolute',
            right: 18,
            bottom: 14,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: T.arcYellow, color: T.arcNavy,
            border: 'none', borderRadius: 999,
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
            boxShadow: T.shadowMd,
            cursor: 'pointer',
          }}
        >
          <ArrowDown size={13} strokeWidth={2} /> Jump to bottom
        </button>
      )}
    </div>
  );
}

// Light syntax tinting based on common log severity markers.
function colorFor(line) {
  if (/\b(ERR|ERROR|FAIL|FAILED|FATAL|PANIC|CRIT)\b/i.test(line)) return '#FF8B72';
  if (/\b(WARN|WARNING)\b/i.test(line)) return '#FFD080';
  if (/\b(NOTICE|INFO)\b/i.test(line)) return '#B6CFA9';
  return '#E8E0D2';
}

function Footer({ screenName, source, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 18px',
      borderTop: '1px solid rgba(232,224,210,0.12)',
      background: 'rgba(0,0,0,0.2)',
      fontFamily: T.fontMono, fontSize: 11,
      color: 'rgba(232,224,210,0.55)',
      flexShrink: 0,
    }}>
      <span>{screenName} · {source}</span>
      <span>{count} line{count === 1 ? '' : 's'} buffered · ≈30 s latency</span>
    </div>
  );
}
