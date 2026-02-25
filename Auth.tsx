import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, db } from '../firebase';
import logoUrl from '../assets/logo.webp';
import './Auth.css';

type AuthMode = 'login' | 'register' | 'pending';

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleLogin = async () => {
    if (!email || !password) { setMessage({ type: 'error', text: 'Enter email and password.' }); return; }
    setLoading(true); setMessage(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Check account status in DB
      const snap = await get(ref(db, `users/${cred.user.uid}`));
      const record = snap.val();
      if (record && record.status === 'pending') {
        await auth.signOut();
        setMode('pending');
        return;
      }
      if (record && record.status === 'rejected') {
        await auth.signOut();
        setMessage({ type: 'error', text: 'Your account request has been declined. Contact an administrator.' });
        return;
      }
      // approved — App.tsx will pick up the auth state change
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Login failed.' });
    } finally { setLoading(false); }
  };

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
      // Write pending user record to DB
      await set(ref(db, `users/${cred.user.uid}`), {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: displayName.trim(),
        role: 'Staff',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        assignedCities: [],
      });
      // Sign them out immediately — they must wait for approval
      await auth.signOut();
      setMode('pending');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Registration failed.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img src={logoUrl} alt="Casino Uniform Manager Pro" className="auth-logo" />
        </div>
        <h1 className="auth-title">Uniform Manager Pro</h1>

        {mode === 'pending' ? (
          <div className="auth-pending">
            <div className="pending-icon">⏳</div>
            <h2>Account Pending Approval</h2>
            <p>Your account request has been submitted and is awaiting administrator approval. You'll be able to log in once an admin reviews your request.</p>
            <button className="btn btn-dark" onClick={() => { setMode('login'); setMessage(null); }}>
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setMessage(null); }}>Sign In</button>
              <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setMessage(null); }}>Request Access</button>
            </div>

            {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

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
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : undefined)}
                />
              </div>

              <div className="form-group">
                <label className="field-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Choose a password (min 6 chars)' : 'Password'}
                  className="input-dark"
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
                />
              </div>

              {mode === 'register' && (
                <p className="auth-notice">
                  ℹ️ After registering, an administrator must approve your account and assign your city access before you can log in.
                </p>
              )}

              <button
                className="btn btn-gold auth-submit"
                onClick={mode === 'login' ? handleLogin : handleRegister}
                disabled={loading}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Submit Access Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
