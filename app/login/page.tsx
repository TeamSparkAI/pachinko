'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants';

type Phase = 'loading' | 'signin' | 'create';

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sess = await fetch('/api/auth/session', { credentials: 'include' });
        if (cancelled) return;
        if (sess.ok) {
          router.replace('/dashboard');
          return;
        }
        const setup = await fetch('/api/auth/setup-status', { credentials: 'include' });
        if (cancelled) return;
        if (!setup.ok) {
          setPhase('signin');
          setError('Could not load setup status. Try sign in.');
          return;
        }
        const j = (await setup.json()) as { hasUsers?: boolean };
        setPhase(j.hasUsers ? 'signin' : 'create');
      } catch {
        if (!cancelled) {
          setPhase('signin');
          setError('Network error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || 'Login failed');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || 'Could not create account');
        if (res.status === 403) {
          setPhase('signin');
        }
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Could not create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-gray-600">
        Loading…
      </div>
    );
  }

  const isCreate = phase === 'create';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={isCreate ? onSubmitCreate : onSubmitSignIn}
        className="w-full max-w-sm bg-white shadow rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-gray-900">
          {isCreate ? 'Create admin account' : 'Sign in'}
        </h1>
        {isCreate && (
          <p className="text-sm text-gray-600">
            No users exist yet. Create the first account for the default organization (you can add
            API keys in Settings after signing in).
          </p>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div>
          <label htmlFor="email" className="block text-sm text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete={isCreate ? 'email' : 'username'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isCreate ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
            minLength={isCreate ? MIN_PASSWORD_LENGTH : undefined}
          />
        </div>
        {isCreate && (
          <div>
            <label htmlFor="passwordConfirm" className="block text-sm text-gray-700 mb-1">
              Confirm password
            </label>
            <input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? (isCreate ? 'Creating account…' : 'Signing in…') : isCreate ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
