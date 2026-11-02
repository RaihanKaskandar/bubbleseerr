'use client';
// Adapted from Seerr's Setup (MIT, https://github.com/seerr-team/seerr)
import { CheckIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Button from '@app/components/Common/Button';
import Logo from '@app/components/Layout/Logo';
import BubblarrForm from '@app/components/Settings/BubblarrForm';
import KavitaForm from '@app/components/Settings/KavitaForm';
import WebhookInfo from '@app/components/Settings/WebhookInfo';
import { apiSend, errorMessage } from '@app/lib/api';
import type { PublicUser } from '@app/lib/types';

const STEPS = ['Create Admin', 'Connect Bubblarr', 'Connect Kavita', 'Finish'];

function SetupSteps({ current }: { current: number }) {
  return (
    <nav className="relative z-50" aria-label="Setup steps">
      <ul className="divide-y divide-gray-600 rounded-md border border-gray-600 bg-gray-800/50 md:flex md:divide-y-0">
        {STEPS.map((description, i) => {
          const step = i + 1;
          const active = step === current;
          const completed = step < current;
          return (
            <li key={description} className="relative md:flex md:flex-1" aria-current={active ? 'step' : undefined}>
              <div className="flex items-center space-x-4 px-6 py-4 text-sm font-medium leading-5">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-indigo-600' : 'border-white'} ${completed ? 'border-indigo-600 bg-indigo-600' : ''}`}>
                  {completed ? <CheckIcon className="h-6 w-6 text-white" /> : <p className={active ? 'text-white' : 'text-indigo-200'}>{step}</p>}
                </div>
                <p className={`text-sm font-medium leading-5 ${active ? 'text-white' : 'text-indigo-200'}`}>{description}</p>
              </div>
              {step < STEPS.length && (
                <div className="absolute right-0 top-0 hidden h-full w-5 md:block">
                  <svg className="h-full w-full text-gray-600" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                    <path d="M0 -2L20 40L0 82" vectorEffect="non-scaling-stroke" stroke="currentcolor" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface SetupWizardProps {
  appTitle: string;
  startStep: number;
  user: PublicUser | null;
  settings: {
    bubblarrUrl: string;
    bubblarrApiKey: string;
    bubblarrRootFolderId: number | null;
    kavitaUrl: string;
    kavitaApiKey: string;
    webhookSecret: string;
  };
}

export default function SetupWizard({ appTitle, startStep, settings }: SetupWizardProps) {
  const [step, setStep] = useState(startStep);
  const [webhookSecret, setWebhookSecret] = useState(settings.webhookSecret);
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `Setup - ${appTitle}`;
  }, [appTitle]);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("The passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await apiSend('/api/v1/setup/admin', 'POST', { email: form.email, username: form.username, password: form.password });
      setStep(2);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const goToFinish = async () => {
    try {
      const s = await fetch('/api/v1/settings').then((r) => r.json());
      setWebhookSecret(s.webhookSecret ?? '');
    } catch {
      // Shown in the settings later anyway
    }
    setStep(4);
  };

  const finish = async () => {
    setBusy(true);
    try {
      await apiSend('/api/v1/setup/finish', 'POST');
      window.location.href = '/';
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-gray-900 py-12">
      <div className="absolute top-0 h-64 w-full bg-gradient-to-bl from-gray-800 to-gray-900">
        <div className="relative inset-0 h-full w-full bg-gradient-to-t from-gray-900 to-transparent" />
      </div>
      <div className="relative z-40 px-4 sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="relative mb-10 flex h-32 max-w-full items-center justify-center sm:mx-auto sm:h-48 sm:max-w-md">
          <Logo title={appTitle} size="lg" />
        </div>
        <SetupSteps current={step} />
        <div className="mt-10 w-full rounded-md border border-gray-600 bg-gray-800/50 p-4 text-white">
          {step === 1 && (
            <form onSubmit={createAdmin} className="mx-auto max-w-lg">
              <div className="mb-2 flex justify-center text-xl font-bold">Create your admin account</div>
              <div className="mb-6 flex justify-center text-center text-sm text-gray-400">
                This is the owner account. You can create accounts for other people later. Without a password, anyone who can open this site can sign in as the owner.
              </div>
              {(
                [
                  ['email', 'Email (optional)', 'email', 'email'],
                  ['username', 'Username', 'text', 'username'],
                  ['password', 'Password (optional)', 'password', 'new-password'],
                  ['confirm', 'Repeat password', 'password', 'new-password'],
                ] as const
              ).map(([key, label, type, autoComplete]) => (
                <div key={key} className="mb-4">
                  <label htmlFor={`setup-${key}`}>{label}</label>
                  <input
                    id={`setup-${key}`}
                    type={type}
                    required={key === 'username'}
                    minLength={key === 'username' ? 2 : undefined}
                    autoComplete={autoComplete}
                    autoCapitalize="none"
                    value={form[key]}
                    onChange={set(key)}
                    className="!text-base sm:!text-sm"
                  />
                </div>
              ))}
              <Button buttonType="primary" type="submit" disabled={busy} className="mt-2 w-full">
                {busy ? 'Creating...' : 'Create Account'}
              </Button>
            </form>
          )}
          {step === 2 && (
            <div>
              <h3 className="heading">Connect Bubblarr</h3>
              <p className="description">Bubbleseerr sends requests to Bubblarr, which finds and downloads the comics.</p>
              <BubblarrForm initial={settings} saveText="Save and Continue" onSaved={() => setStep(3)} />
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 className="heading">Connect Kavita (optional)</h3>
              <p className="description">Show a &quot;Read in Kavita&quot; button on comics that are available. You can skip this.</p>
              <KavitaForm
                initial={settings}
                saveText="Save and Continue"
                onSaved={() => void goToFinish()}
                extraActions={
                  <span className="inline-flex rounded-md shadow-sm">
                    <Button onClick={() => void goToFinish()}>Skip</Button>
                  </span>
                }
              />
            </div>
          )}
          {step === 4 && (
            <div>
              <h3 className="heading">Almost done: get updates from Bubblarr</h3>
              <WebhookInfo secret={webhookSecret} />
              <div className="actions">
                <div className="flex justify-end">
                  <Button buttonType="primary" onClick={() => void finish()} disabled={busy}>
                    {busy ? 'Finishing...' : 'Finish Setup'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
