'use client';
// Adapted from Seerr's Login and LocalLogin (MIT, https://github.com/seerr-team/seerr)
import { ArrowLeftOnRectangleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

import Button from '@app/components/Common/Button';
import ImageFader from '@app/components/Common/ImageFader';
import { InlineSpinner } from '@app/components/Common/LoadingSpinner';
import Logo from '@app/components/Layout/Logo';
import { apiSend, errorMessage, fetcher } from '@app/lib/api';

export default function LoginForm({ appTitle, mediaServer }: { appTitle: string; mediaServer: string | null }) {
  const params = useSearchParams();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data: backdrops } = useSWR<number[]>('/api/v1/public/backdrops', fetcher);

  useEffect(() => {
    document.title = `Sign In - ${appTitle}`;
  }, [appTitle]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiSend('/api/v1/auth/login', 'POST', { login, password });
      const next = params.get('next');
      // Only go to pages of this site
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-900 py-14">
      <ImageFader rotationSpeed={6000} backgroundImages={(backdrops ?? []).map((id) => `/api/v1/image/volume/${id}`)} />
      <div className="status-bar-fade absolute-top-glow pointer-events-none absolute z-[1] w-full" />
      <div className="relative z-40 mt-10 flex flex-col items-center px-4 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="relative flex h-48 w-full max-w-full items-center justify-center">
          <Logo title={appTitle} size="lg" />
        </div>
      </div>
      <div className="relative z-50 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800/50 shadow sm:rounded-lg" style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}>
          {error && (
            <div className="mb-4 rounded-md bg-red-600 p-4 sm:rounded-t-lg sm:rounded-b-none" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon className="h-5 w-5 text-red-300" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-300">{error}</h3>
                </div>
              </div>
            </div>
          )}
          <div className="px-10 py-8">
            <form onSubmit={submit}>
              <h2 className={`-mt-1 text-center text-lg font-bold text-neutral-200 ${mediaServer ? 'mb-2' : 'mb-6'}`}>
                Sign in to continue
              </h2>
              {mediaServer && (
                <p className="mb-6 text-center text-sm text-gray-400">
                  Use your {mediaServer} account or your {appTitle} account
                </p>
              )}
              <div className="mb-4 mt-1">
                <label htmlFor="login" className="sr-only">Email or username</label>
                <div className="form-input-field">
                  <input
                    id="login"
                    name="login"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Email or username"
                    required
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="!bg-gray-700/80 py-2.5 !text-base placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="mb-2 mt-1">
                <label htmlFor="password" className="sr-only">Password</label>
                <div className="form-input-field">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="!bg-gray-700/80 py-2.5 !text-base placeholder:text-gray-400"
                  />
                </div>
                <p className="pt-2 text-right text-xs text-gray-400">{mediaServer ? `Forgot your password? Reset it in ${mediaServer} or ask the admin.` : 'Forgot your password? Ask the admin.'}</p>
              </div>
              <Button buttonType="primary" type="submit" disabled={submitting} className="mt-2 w-full shadow-sm">
                {submitting ? <InlineSpinner className="mr-2 h-5 w-5" /> : <ArrowLeftOnRectangleIcon />}
                <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
