import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { setStoredPassword, api } from '../api.js';
import { T } from './styles.js';

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
    } catch (err) {
      setError('Incorrect password');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bone,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: T.s5,
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: T.white,
        borderRadius: T.r3,
        padding: T.s7,
        border: `1px solid ${T.sand}`,
        boxShadow: '0 4px 20px rgba(15, 26, 36, 0.04)',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: T.s3,
          marginBottom: T.s7,
          paddingBottom: T.s5,
          borderBottom: `1px solid ${T.sand}`,
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: T.navyMid,
            borderRadius: T.r2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="14" rx="1" stroke={T.bone} strokeWidth="1.5"/>
              <path d="M8 18v3M16 18v3M6 21h12" stroke={T.bone} strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: T.fontDisplay,
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.16em',
              color: T.navyMid,
            }}>
              ARCOM SCREENS
            </div>
            <div style={{
              fontSize: '11px',
              color: T.taupe,
              marginTop: '2px',
            }}>
              Display network
            </div>
          </div>
        </div>

        <h1 style={{
          fontFamily: T.fontDisplay,
          fontWeight: 600,
          fontSize: '24px',
          color: T.navyDeep,
          marginBottom: T.s2,
          letterSpacing: '-0.01em',
        }}>
          Sign in
        </h1>
        <p style={{
          fontSize: '14px',
          color: T.taupe,
          marginBottom: T.s6,
          lineHeight: 1.6,
        }}>
          Enter the dashboard password to manage office screens.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{
            fontFamily: T.fontDisplay,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            color: T.taupe,
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: T.s2,
          }}>
            Password
          </label>
          <div style={{ position: 'relative', marginBottom: T.s4 }}>
            <Lock size={18} style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: T.taupe,
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
                fontSize: '14px',
                fontFamily: T.fontBody,
                color: T.navyDeep,
                background: T.bone,
                border: `1px solid ${T.sand}`,
                borderRadius: T.r2,
                outline: 'none',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => e.target.style.borderColor = T.navyMid}
              onBlur={(e) => e.target.style.borderColor = T.sand}
            />
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: T.s2,
              padding: '10px 14px',
              background: 'rgba(192, 69, 40, 0.06)',
              border: `1px solid rgba(192, 69, 40, 0.2)`,
              borderRadius: T.r2,
              fontSize: '13px',
              color: T.brick,
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
              padding: '12px',
              fontSize: '14px',
              fontFamily: T.fontDisplay,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: T.bone,
              background: loading || !password ? T.taupe : T.navyMid,
              border: 'none',
              borderRadius: T.r2,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'background 150ms',
            }}
          >
            {loading ? 'Checking...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
