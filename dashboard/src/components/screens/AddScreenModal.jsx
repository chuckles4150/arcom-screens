import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';

export function AddScreenModal({ onClose, onAdded, onError }) {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [url, setUrl] = useState('https://arcom.site/');
  const [refresh, setRefresh] = useState(10);
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSave = name && hostname && url && !submitting;

  async function handleSave(e) {
    e?.preventDefault();
    if (!canSave) return;
    setSubmitting(true);
    try {
      const created = await api.addScreen({
        name, hostname, ip,
        urls: [{ url, duration: 60 }],
        refresh: parseInt(refresh, 10) || 10,
        location,
      });
      onAdded?.(created);
    } catch (err) {
      onError?.(err.message || 'Could not register screen');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Register a display" eyebrow="NEW SCREEN" onClose={onClose}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <Input value={name} onChange={setName} placeholder="e.g. Workshop floor" autoFocus />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Hostname">
            <Input value={hostname} onChange={setHostname} placeholder="pi-workshop" />
          </Field>
          <Field label="IP address (optional)">
            <Input value={ip} onChange={setIp} placeholder="192.168.1.xxx" />
          </Field>
        </div>

        <Field label="URL" hint="Add a single URL to start. Rotation can be configured after the screen is registered.">
          <Input value={url} onChange={setUrl} />
        </Field>

        <Field label="Refresh interval (minutes)">
          <Input type="number" value={refresh} onChange={(v) => setRefresh(parseInt(v, 10) || 0)} />
        </Field>

        <Field label="Location">
          <Input value={location} onChange={setLocation} placeholder="Where is this screen mounted?" />
        </Field>

        <div style={{
          background: T.bgSurfaceAlt,
          borderLeft: `3px solid ${T.arcSage}`,
          borderRadius: 6,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: 12,
          color: T.fg1,
          lineHeight: 1.5,
        }}>
          <AlertCircle size={14} strokeWidth={1.75} style={{ flexShrink: 0, color: T.fgAccent, marginTop: 2 }} />
          <span>The Pi must be flashed with the Arcom kiosk image and on the office network. It will appear online once it phones home.</span>
        </div>

        <ModalFoot
          onCancel={onClose}
          submitLabel={submitting ? 'Registering…' : 'Add screen'}
          disabled={!canSave}
        />
      </form>
    </ModalShell>
  );
}

// ── Shared modal primitives (also used by EditScreenModal) ───────

export function ModalShell({ title, eyebrow, onClose, children, maxWidth = 540 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,43,73,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, zIndex: 100,
        animation: 'arc-fade 160ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bgApp,
          borderRadius: 14,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: T.shadowLg,
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '20px 24px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16,
          borderBottom: `1px solid ${T.line1}`,
          background: T.bgSurface,
        }}>
          <div>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.fgAccent,
            }}>
              {eyebrow}
            </div>
            <h2 style={{
              margin: '4px 0 0',
              fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 700,
              color: T.fgBrand, letterSpacing: '-0.01em',
            }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8,
              color: T.fg3, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalFoot({ onCancel, submitLabel, disabled, leftSlot }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 12,
      paddingTop: 16,
      borderTop: `1px solid ${T.line1}`,
      marginTop: 4,
    }}>
      <div>{leftSlot}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: T.fgBrand,
            border: `1px solid ${T.line2}`,
            borderRadius: 999,
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
          }}
        >Cancel</button>
        <button
          type="submit"
          disabled={disabled}
          style={{
            padding: '9px 18px',
            background: disabled ? T.fg3 : T.arcNavy,
            color: T.fgOnDark,
            border: 'none',
            borderRadius: 999,
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >{submitLabel}</button>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', color: T.fgAccent, textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: T.fg3, lineHeight: 1.5 }}>{hint}</p>
      )}
    </div>
  );
}

export function Input({ value, onChange, type = 'text', placeholder, autoFocus, style }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        height: 40,
        padding: '0 14px',
        border: `1px solid ${T.line2}`,
        borderRadius: T.radiusSm,
        background: T.bgSurface,
        color: T.fg1,
        fontFamily: T.fontBody,
        fontSize: 14,
        transition: 'border-color 120ms',
        outline: 'none',
        width: '100%',
        ...style,
      }}
      onFocus={(e) => e.currentTarget.style.borderColor = T.arcNavy}
      onBlur={(e) => e.currentTarget.style.borderColor = T.line2}
    />
  );
}
