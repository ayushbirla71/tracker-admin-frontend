import { Eye, EyeOff, Route, Bell, MapPinned } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import heroImage from '../assets/login-hero.webp';
import logo from '../assets/logo.png';
import { APP_NAME, POWERED_BY } from '../brand';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof TypeError ? 'Cannot reach the server. Check your connection.' : err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      {/* the banner already carries the ad96 logo; the text sits on a dark gradient at the bottom */}
      <section className="login-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="hero-copy">
          <h1>Know where your team is, and where their time goes.</h1>
          <ul>
            <li><MapPinned size={18} /> Live map of every worker</li>
            <li><Route size={18} /> 24h, 48h and 7-day route history with stops</li>
            <li><Bell size={18} /> Alerts when someone goes offline or arrives on site</li>
          </ul>
          <p className="hero-credit">Powered by <strong>{POWERED_BY}</strong></p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <img className="login-logo" src={logo} alt={APP_NAME} width={84} height={84} />
          <h2>Sign in</h2>
          <p className="muted">Administrator access</p>
          <label>
            Email
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </label>
          <label>
            Password
            <span className="password-field">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="icon-btn" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="panel-credit muted small">{APP_NAME} · Powered by {POWERED_BY}</p>
      </section>
    </div>
  );
}
