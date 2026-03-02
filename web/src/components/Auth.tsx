import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, db } from '../firebase';
import logoUrl from '../assets/logo.png';
import './Auth.css';

type AuthMode = 'login' | 'register' | 'pending' | 'reset';

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const goTo = (m: AuthMode) => { setMode(m); setMessage(null); };

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) { setMessage({ type: 'error', text: 'Enter email and password.' }); return; }
    setLoading(true); setMessage(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await get(ref(db, `users/${cred.user.uid}`));
      const record = snap.val();
      if (record?.status === 'pending') {
        await auth.signOut();
        setMode('pending');
        return;
      }
      if (record?.status === 'rejected') {
        await auth.signOut();
        setMessage({ type: 'error', text: 'Your account request was declined. Contact an administrator.' });
        return;
      }
      // approved → App.tsx handles auth state change
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Login failed.' });
    } finally { setLoading(false); }
  };

  // ─── REGISTER ─────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      setMessage({ type: 'error', text: 'All fields are required.' }); return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' }); return;
    }
    setLoading(true); setMessage(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await set(ref(db, `users/${cred.user.uid}`), {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: displayName.trim(),
        role: 'Staff',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        assignedCities: [],
      });
      await auth.signOut();
      setMode('pending');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Registration failed.' });
    } finally { setLoading(false); }
  };

  // ─── PASSWORD RESET ───────────────────────────────────────────────────────
  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Enter your email address first.' }); return;
    }
    setLoading(true); setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Always show success — don't reveal whether the email exists
      setMessage({ type: 'success', text: 'If that email is registered, a reset link has been sent. Check your inbox and spam folder.' });
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found') {
        setMessage({ type: 'success', text: 'If that email is registered, a reset link has been sent. Check your inbox and spam folder.' });
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to send reset email.' });
      }
    } finally { setLoading(false); }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img src={logoUrl} alt="Uniform Manager" className="auth-logo" />
        </div>
        <h1 className="auth-title">Uniform Manager Pro</h1>

        {/* ── PENDING APPROVAL ── */}
        {mode === 'pending' && (
          <div className="auth-pending">
            <div className="pending-icon">⏳</div>
            <h2>Account Pending Approval</h2>
            <p>
              Your account request has been submitted. An administrator will review it shortly.
              You'll be able to log in once approved.
            </p>
            <button className="btn btn-dark" onClick={() => goTo('login')}>
              Back to Sign In
            </button>
          </div>
        )}

        {/* ── PASSWORD RESET ── */}
        {mode === 'reset' && (
          <div className="auth-reset">
            <h2 className="reset-title">Reset Password</h2>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Enter your account email and we'll send you a link to reset your password.
            </p>

            {message && (
              <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
                {message.text}
              </div>
            )}

            <div className="form-group">
              <label className="field-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePasswordReset(); }}
                placeholder="your@email.com"
                className="input-dark"
                autoFocus
              />
            </div>

            <button
              className="btn btn-gold auth-submit"
              onClick={handlePasswordReset}
              disabled={loading}
              style={{ marginTop: '0.75rem' }}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>

            <button
              className="btn btn-dark auth-submit"
              onClick={() => goTo('login')}
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* ── SIGN IN / REGISTER ── */}
        {(mode === 'login' || mode === 'register') && (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => goTo('login')}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => goTo('register')}
              >
                Request Access
              </button>
            </div>

            {message && (
              <div className={`alert alert-${message.type}`}>{message.text}</div>
            )}

            <div className="auth-form">
              {mode === 'register' && (
                <div className="form-group">
                  <label className="field-label">Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    className="input-dark"
                    autoFocus
                  />
                </div>
              )}

              <div className="form-group">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-dark"
                  autoFocus={mode === 'login'}
                  onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleLogin(); }}
                />
              </div>

              <div className="form-group">
                <label className="field-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min 6 characters' : 'Password'}
                  className="input-dark"
                  onKeyDown={e => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister(); }}
                />
              </div>

              {/* Forgot password link — only on login */}
              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
                  <button
                    className="btn-link"
                    style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}
                    onClick={() => goTo('reset')}
                    type="button"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === 'register' && (
                <p className="auth-notice">
                  ℹ️ After submitting, an administrator must approve your account and assign city
                  access before you can log in.
                </p>
              )}

              <button
                className="btn btn-gold auth-submit"
                onClick={mode === 'login' ? handleLogin : handleRegister}
                disabled={loading}
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Submit Access Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
