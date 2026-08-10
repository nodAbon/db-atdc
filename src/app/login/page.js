'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { usePersistentTheme } from '../../lib/usePersistentTheme';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('next') || searchParams.get('redirect') || '/';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '아이디 또는 비밀번호가 올바르지 않습니다.');
        return;
      }

      if (typeof window !== 'undefined' && data.user) {
        localStorage.setItem('user-is-admin', String(!!data.user.isAdmin));
        localStorage.setItem('user-position', data.user.position || '');
        localStorage.setItem('user-emp-no', data.user.empNo || '');
        localStorage.setItem('user-name', data.user.name || '');
        localStorage.setItem('user-rank', data.user.rank || '');
        localStorage.setItem('user-login-id', data.user.loginId || '');
        localStorage.setItem('user-team', data.user.team || '');
      }

      window.location.assign(redirect);
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', padding: 20 }}>
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '36px 32px',
          borderRadius: 20,
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--blue), var(--purple))',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 20,
              boxShadow: '0 8px 20px rgba(91, 136, 214, 0.3)',
              marginBottom: 14,
            }}
          >
            H
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: -0.5 }}>
            HECTO 근태관리시스템
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            서비스 이용을 위해 로그인해 주세요.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
              아이디 (사번)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-3)' }} />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="사번 또는 아이디 입력"
                required
                autoComplete="username"
                className="form-input"
                style={{ width: '100%', paddingLeft: 36, height: 42, fontSize: 13.5 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-3)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                autoComplete="current-password"
                className="form-input"
                style={{ width: '100%', paddingLeft: 36, height: 42, fontSize: 13.5 }}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'rgba(208, 107, 107, 0.12)',
                border: '1px solid rgba(208, 107, 107, 0.25)',
                borderRadius: 10,
                color: 'var(--red)',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              height: 44,
              fontSize: 14,
              fontWeight: 700,
              marginTop: 6,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--blue), var(--purple))',
              boxShadow: '0 4px 14px rgba(91, 136, 214, 0.3)',
            }}
          >
            <LogIn size={16} />
            <span>{loading ? '로그인 중...' : '로그인'}</span>
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)' }}>
          © HECTO Group · Attendance Management
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading-spinner">로그인 화면을 불러오는 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
