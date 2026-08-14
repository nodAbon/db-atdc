'use client';

import { useState } from 'react';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || '비밀번호를 변경하지 못했습니다.');
        return;
      }
      window.location.assign('/');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg-body)' }}>
      <form className="card" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>비밀번호 변경</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>
          8자 이상, 영문 대/소문자·숫자·특수문자 중 3종 이상을 사용해주세요.
        </p>
        <label style={{ display: 'block', marginTop: 20, fontWeight: 700 }}>새 비밀번호</label>
        <input className="form-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required style={{ width: '100%', marginTop: 8 }} />
        <label style={{ display: 'block', marginTop: 16, fontWeight: 700 }}>새 비밀번호 확인</label>
        <input className="form-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} maxLength={128} required style={{ width: '100%', marginTop: 8 }} />
        {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 24 }}>
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </main>
  );
}
