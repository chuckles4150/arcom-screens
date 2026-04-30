import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { api } from '../api.js';

export function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await api.login(password);
      if (ok) onSuccess();
      else setError('Wrong password');
    } catch (err) {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.brandMark}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="14" rx="1" stroke="#FAF7F2" strokeWidth="1.5"/>
              <path d="M8 18v3M16 18v3M6 21h12" stroke="#FAF7F2" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <p style={styles.brandText}>ARCOM</p>
            <p style={styles.brandSub}>Screen Manager</p>
          </div>
        </div>

        <p style={styles.eyebrow}>SIGN IN</p>
        <h1 style={styles.title}>Enter password</h1>
        <p style={styles.body}>Internal tool — operational access only.</p>

        <div style={styles.field}>
          <div style={styles.inputWrap}>
            <Lock size={14} strokeWidth={1.75} style={styles.inputIcon} />
            <input
              type="password"
              style={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Password"
              autoFocus
            />
          </div>
          {error && (
            <p style={styles.error}>
              <AlertCircle size={12} strokeWidth={1.75} /> {error}
            </p>
          )}
        </div>

        <button
          style={{...styles.btn, ...(loading || !password ? styles.btnDisabled : {})}}
          onClick={handleSubmit}
          disabled={loading || !password}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#002B49',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "'Open Sans', system-ui, sans-serif",
  },
  card: {
    background: '#FAF7F2',
    borderRadius: 14,
    padding: 36,
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  brandMark: {
    width: 36, height: 36,
    borderRadius: 8,
    background: '#002B49',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandText: {
    margin: 0,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.12em',
    color: '#002B49',
  },
  brandSub: {
    margin: 0,
    fontSize: 11,
    color: '#567B49',
    letterSpacing: '0.04em',
  },
  eyebrow: {
    margin: 0,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.12em',
    color: '#567B49',
    textTransform: 'uppercase',
  },
  title: {
    margin: '4px 0 8px',
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#2B2A27',
  },
  body: {
    margin: '0 0 24px',
    fontSize: 13,
    color: '#8A8275',
  },
  field: {
    marginBottom: 16,
  },
  inputWrap: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#8A8275',
    pointerEvents: 'none',
  },
  input: {
    height: 44,
    width: '100%',
    padding: '0 14px 0 36px',
    border: '0.5px solid #E4DDCF',
    borderRadius: 8,
    background: '#FFFFFF',
    color: '#2B2A27',
    fontFamily: "'Open Sans', sans-serif",
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
  },
  error: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#B3432B',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    width: '100%',
    background: '#002B49',
    color: '#FAF7F2',
    height: 44,
    borderRadius: 999,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.04em',
    border: 'none',
    cursor: 'pointer',
    transition: 'filter 120ms',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};
