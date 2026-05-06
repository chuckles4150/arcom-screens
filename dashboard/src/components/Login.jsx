import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { setStoredPassword, api } from '../api.js';
import { T } from '../theme.js';

export function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');
    setStoredPassword(password);
    try {
      await api.ping();
      onSuccess();
    } catch {
      setError('Incorrect password');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bgApp,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: T.s5,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: T.bgSurface,
        borderRadius: 14,
        padding: T.s12,
        border: `1px solid ${T.line2}`,
        boxShadow: T.shadowMd,
      }}>
        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: T.s3,
          marginBottom: T.s10,
          paddingBottom: T.s5,
          borderBottom: `1px solid ${T.line1}`,
        }}>
          <div style={{
            width: 40,
            height: 40,
            background: T.arcNavy,
            borderRadius: T.radiusSm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="14" rx="1" stroke={T.fgOnDark} strokeWidth="1.5"/>
              <path d="M8 18v3M16 18v3M6 21h12" stroke={T.fgOnDark} strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: T.fontDisplay,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.16em',
              color: T.fgBrand,
            }}>
              ARCOM SCREENS
            </div>
            <div style={{
              fontSize: 11,
              color: T.fg3,
              marginTop: 2,
              fontFamily: T.fontMono,
            }}>
              Display network · v2.1
            </div>
          </div>
        </div>

        <h1 style={{
          fontFamily: T.fontDisplay,
          fontWeight: 700,
          fontSize: 26,
          color: T.fgBrand,
          marginBottom: T.s2,
          marginTop: 0,
          letterSpacing: '-0.01em',
        }}>
          Sign in
        </h1>
        <p style={{
          fontSize: 14,
          color: T.fg3,
          marginBottom: T.s6,
          marginTop: 0,
          lineHeight: 1.6,
        }}>
          Enter the dashboard password to manage office screens.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{
            fontFamily: T.fontDisplay,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: T.fgAccent,
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: T.s2,
          }}>
            Password
          </label>
          <div style={{ position: 'relative', marginBottom: T.s4 }}>
            <Lock size={18} style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: T.fg3,
              pointerEvents: 'none',
            }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                fontSize: 14,
                fontFamily: T.fontBody,
                color: T.fg1,
                background: T.bgApp,
                border: `1px solid ${T.line2}`,
                borderRadius: T.radiusSm,
                outline: 'none',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => e.target.style.borderColor = T.arcNavy}
              onBlur={(e) => e.target.style.borderColor = T.line2}
            />
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: T.s2,
              padding: '10px 14px',
              background: T.statusDangerBg,
              border: `1px solid ${T.statusDanger}33`,
              borderRadius: T.radiusSm,
              fontSize: 13,
              color: T.statusDanger,
              marginBottom: T.s4,
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 14,
              fontFamily: T.fontDisplay,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: T.fgOnDark,
              background: loading || !password ? T.fg3 : T.arcNavy,
              border: 'none',
              borderRadius: T.radiusSm,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'background 150ms',
            }}
          >
            {loading ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
