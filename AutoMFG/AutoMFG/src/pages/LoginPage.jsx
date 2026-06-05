import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, MOCK_USERS } from '../store/authStore';
import { Eye, EyeOff, AlertCircle, Building2, User, Check, Shield } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError('Invalid username or password. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    }}>
      {/* Left — Brand Panel */}
      <div style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background grid accent */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: 0.4,
        }} />
        <div style={{
          position: 'absolute',
          bottom: -200,
          left: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(28,105,212,0.08) 0%, transparent 70%)',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              background: 'var(--bmw-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7.5 3.75L12 12 4.5 8.25 12 4.5z" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 28, letterSpacing: '0.12em', color: 'var(--white)' }}>
                AutoMFG
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 300, letterSpacing: '0.3em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>
                Manufacturing Execution Suite
              </div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 56, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.1, color: 'var(--white)', marginBottom: 20 }}>
            PRODUCTION<br />
            <span style={{ color: 'var(--bmw-blue)' }}>INTELLIGENCE</span><br />
            PLATFORM
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 400 }}>
            Enterprise-grade Manufacturing Execution System for real-time production monitoring, 
            quality control, and operational excellence.
          </p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginTop: 48, border: '1px solid var(--border)' }}>
            {[
              { value: '13', label: 'Modules' },
              { value: '9', label: 'Roles' },
              { value: '99.9%', label: 'Uptime' },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '20px 16px',
                background: 'var(--bg-elevated)',
                borderRight: '1px solid var(--border)',
              }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--bmw-blue)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>
            © 2026 AutoMFG · All rights reserved
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 6 }}>
              System Access
            </h2>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
              Enter your credentials to continue
            </p>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--red-dim)',
              border: '1px solid var(--red)',
              marginBottom: 24,
            }}>
              <AlertCircle size={14} color="var(--red)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--red)' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. prod.manager"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted-text)',
                    cursor: 'pointer',
                  }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
            </button>
          </form>

          {/* Department / Role Selector Scroller */}
          <div style={{
            marginTop: 40,
            border: '1px solid var(--border)',
            padding: '16px',
            background: 'rgba(255,255,255,0.01)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--muted-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Building2 size={12} color="var(--bmw-blue)" />
                Select Department & User
              </div>
            </div>

            {/* Scrollable list */}
            <div style={{
              maxHeight: '210px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingRight: 4,
            }}>
              {MOCK_USERS.map((user) => {
                const isSelected = username === user.username;
                const isSysAdmin = user.role === 'sys_admin';
                return (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => {
                      setUsername(user.username);
                      setPassword(user.password);
                    }}
                    style={{
                      background: isSelected ? 'var(--bmw-blue-subtle)' : 'var(--bg-elevated)',
                      border: isSelected ? '1px solid var(--bmw-blue)' : '1px solid var(--border)',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                      color: isSelected ? 'var(--white)' : 'var(--text-primary)',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border-active)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-elevated)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        background: isSelected ? 'var(--bmw-blue)' : 'var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? 'var(--white)' : 'var(--muted-text)',
                        borderRadius: '0',
                      }}>
                        {isSysAdmin ? <Shield size={12} /> : <User size={12} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          color: isSelected ? 'var(--white)' : 'var(--text-primary)'
                        }}>
                          {user.name}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 10,
                        color: isSelected ? 'var(--white)' : 'var(--muted-text)',
                        background: isSelected ? 'rgba(28,105,212,0.15)' : 'rgba(255,255,255,0.02)',
                        padding: '2px 6px',
                        border: isSelected ? '1px solid rgba(28,105,212,0.3)' : '1px solid var(--border)'
                      }}>
                        {user.username}
                      </span>
                      {isSelected && <Check size={12} color="var(--bmw-blue)" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
