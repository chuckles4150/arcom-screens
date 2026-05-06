import React, { useState } from 'react';
import { Bell, Send, Check, AlertCircle } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { useFetch } from '../../hooks/useFetch.js';

export function SettingsPage({ onToast, onError }) {
  const settingsQ = useFetch(() => api.getSettings(), []);

  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead />

      {settingsQ.loading ? (
        <div style={{ color: T.fg3 }}>Loading…</div>
      ) : settingsQ.error ? (
        <div style={{ color: T.statusDanger }}>Failed to load settings.</div>
      ) : (
        <AlertSettingsCard
          settings={settingsQ.data}
          onSaved={() => { settingsQ.refetch(); onToast?.('Settings saved'); }}
          onError={onError}
        />
      )}

      <FuturePhasesCard />
    </div>
  );
}

function PageHead() {
  return (
    <div>
      <div style={{
        fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
      }}>
        System · Config
      </div>
      <h1 style={{
        margin: 0,
        fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
        color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
      }}>
        Settings
      </h1>
      <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
    </div>
  );
}

function AlertSettingsCard({ settings, onSaved, onError }) {
  const configured = !!settings.alertWebhookConfigured;
  const [url, setUrl] = useState('');
  const [onOffline, setOnOffline] = useState(settings.alertOnOffline);
  const [onReboot, setOnReboot] = useState(settings.alertOnReboot);
  const [cooldown, setCooldown] = useState(settings.alertCooldownMinutes);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function handleSave(e) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const patch = {
        alertOnOffline: onOffline,
        alertOnReboot: onReboot,
        alertCooldownMinutes: parseInt(cooldown, 10) || 0,
      };
      if (url.trim()) patch.alertWebhookUrl = url.trim();
      await api.updateSettings(patch);
      setUrl('');
      onSaved?.();
    } catch (err) {
      onError?.(err.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearWebhook() {
    if (saving) return;
    setSaving(true);
    try {
      await api.updateSettings({ alertWebhookUrl: '' });
      setUrl('');
      onSaved?.();
    } catch (err) {
      onError?.(err.message || 'Could not clear webhook');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.sendAlertTest({ kind: 'test' });
      setTestResult(result);
    } catch (err) {
      setTestResult({ fired: false, reason: err.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHead icon={<Bell size={18} strokeWidth={1.75} color={T.arcYellow600} />} eyebrow="Alerts" title="Webhook notifications" />

      <p style={{ margin: 0, fontSize: 13, color: T.fg3, lineHeight: 1.55 }}>
        When a screen goes offline (or reboots, optionally), the server POSTs a Slack-compatible JSON payload
        (<code style={mono}>{'{ "text": "..." }'}</code>) to the URL below. Works with Slack, Discord, Mattermost, ntfy, or any inbound webhook.
      </p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Webhook URL">
          <Input
            type="url"
            value={url}
            placeholder={configured ? settings.alertWebhookUrlMask : 'https://hooks.slack.com/services/T0/B0/…'}
            onChange={setUrl}
          />
          <Hint>
            {configured
              ? 'Currently set. Leave blank to keep, paste a new URL to replace, or use Clear webhook.'
              : 'Not configured yet — alerts will not fire.'}
          </Hint>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Toggle
            label="Alert on offline"
            sub="Watchdog flips a screen offline → fire webhook"
            value={onOffline}
            onChange={setOnOffline}
          />
          <Toggle
            label="Alert on reboot"
            sub="Heartbeat detects a Pi reboot → fire webhook (off by default — reboots are noisy)"
            value={onReboot}
            onChange={setOnReboot}
          />
        </div>

        <Field label="Cooldown (minutes)">
          <Input
            type="number"
            value={cooldown}
            onChange={(v) => setCooldown(parseInt(v, 10) || 0)}
          />
          <Hint>Per (screen, event) — stops a flapping screen from spamming. Manual alerts ignore the cooldown.</Hint>
        </Field>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !configured}
            title={configured ? 'Sends a one-off test payload' : 'Configure a webhook first'}
            style={ghostBtnStyle(testing || !configured)}
          >
            <Send size={13} strokeWidth={1.75} /> {testing ? 'Sending…' : 'Send test alert'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {configured && (
              <button
                type="button"
                onClick={handleClearWebhook}
                style={ghostBtnStyle(false, T.statusDanger)}
              >
                Clear webhook
              </button>
            )}
            <button type="submit" disabled={saving} style={primaryBtnStyle(saving)}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        {testResult && <TestResult result={testResult} />}
      </form>
    </Card>
  );
}

function FuturePhasesCard() {
  return (
    <Card>
      <CardHead
        icon={<AlertCircle size={18} strokeWidth={1.75} color={T.arcSage} />}
        eyebrow="Roadmap"
        title="Coming later"
      />
      <ul style={{ margin: 0, paddingLeft: 20, color: T.fg2, fontSize: 13, lineHeight: 1.7 }}>
        <li>Per-screen alert routing (different webhooks per location).</li>
        <li>Email/SMS notification channels.</li>
        <li>Quiet hours (suppress alerts overnight).</li>
        <li>Schedule timezone awareness.</li>
      </ul>
    </Card>
  );
}

// ── Primitives ────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 14,
      padding: 24,
      display: 'flex', flexDirection: 'column', gap: 16,
      boxShadow: T.shadowXs,
    }}>
      {children}
    </div>
  );
}

function CardHead({ icon, eyebrow, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {icon}
      <div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 10.5, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3,
        }}>{eyebrow}</div>
        <div style={{
          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 18, color: T.fgBrand,
        }}>{title}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', color: T.fgAccent, textTransform: 'uppercase',
      }}>{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }) {
  return (
    <p style={{ margin: '4px 0 0', fontSize: 11, color: T.fg3, lineHeight: 1.5 }}>{children}</p>
  );
}

function Input({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={{
        height: 40,
        padding: '0 14px',
        border: `1px solid ${T.line2}`,
        borderRadius: T.radiusSm,
        background: T.bgSurface,
        color: T.fg1,
        fontFamily: T.fontBody,
        fontSize: 14,
        outline: 'none',
        width: '100%',
      }}
    />
  );
}

function Toggle({ label, sub, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', border: `1px solid ${T.line1}`,
      borderRadius: 10, background: T.bgSurfaceAlt,
    }}>
      <button
        type="button"
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange?.(!value)}
        style={{
          position: 'relative',
          width: 36, height: 20,
          flexShrink: 0,
          borderRadius: 999,
          background: value ? T.arcSage : T.arcStone,
          padding: 0,
          transition: 'background 150ms',
          marginTop: 2,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: T.arcWhite,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 150ms',
        }} />
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.04em', color: T.fg1,
        }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11.5, color: T.fg3, lineHeight: 1.5, marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function TestResult({ result }) {
  const ok = result.fired === true;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: ok ? T.statusOkBg : T.statusDangerBg,
      color: ok ? T.statusOk : T.statusDanger,
      borderRadius: 8,
      fontSize: 13,
    }}>
      {ok ? <Check size={14} strokeWidth={2} /> : <AlertCircle size={14} strokeWidth={2} />}
      <span>
        {ok
          ? 'Alert sent. Check the webhook target.'
          : `Could not send: ${result.reason || 'unknown'}`}
      </span>
    </div>
  );
}

function primaryBtnStyle(disabled) {
  return {
    padding: '10px 18px',
    background: disabled ? T.fg3 : T.arcNavy,
    color: T.fgOnDark,
    border: 'none',
    borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function ghostBtnStyle(disabled, color = T.fgBrand) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px',
    background: 'transparent',
    color: disabled ? T.fg3 : color,
    border: `1px solid ${disabled ? T.line2 : color}`,
    borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const mono = {
  fontFamily: T.fontMono, background: T.bgInset,
  padding: '2px 6px', borderRadius: 4, fontSize: 12, color: T.fg1,
};
