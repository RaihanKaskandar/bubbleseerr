'use client';
import { ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { apiSend, errorMessage } from '@app/lib/api';

function copy(text: string) {
  void navigator.clipboard?.writeText(text).then(
    () => toast.success('Copied'),
    () => toast.error("Couldn't copy, select the text instead")
  );
}

/** What to enter in Bubblarr → Settings → General → Webhooks */
export default function WebhookInfo({ secret: initialSecret, appUrl }: { secret: string; appUrl?: string }) {
  const [secret, setSecret] = useState(initialSecret);
  const base = (appUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  const url = `${base}/api/v1/webhook/bubblarr`;

  const regenerate = async () => {
    try {
      const result = await apiSend<{ webhookSecret: string }>('/api/v1/settings/webhook', 'POST');
      setSecret(result.webhookSecret);
      toast.success('New secret made. Update it in Bubblarr too.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const field = (id: string, label: string, value: string, tip: string, extra?: React.ReactNode) => (
    <div className="form-row">
      <label htmlFor={id} className="text-label">
        {label}
        <span className="label-tip">{tip}</span>
      </label>
      <div className="form-input-area">
        <div className="form-input-field">
          <input id={id} type="text" readOnly value={value} className="rounded-l-only" onFocus={(e) => e.target.select()} />
          <button type="button" className="input-action" onClick={() => copy(value)} aria-label={`Copy ${label}`}>
            <ClipboardDocumentIcon />
          </button>
          {extra}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <p className="description">
        In Bubblarr, go to Settings → General → Webhooks and enter this URL and secret. Then requests become
        &quot;Available&quot; the moment Bubblarr has downloaded them. Without it, Bubbleseerr checks every 10 minutes.
      </p>
      {field('webhook-url', 'Webhook URL', url, 'Bubblarr must be able to reach this address')}
      {field(
        'webhook-secret',
        'Secret',
        secret,
        'Proves the webhooks come from your Bubblarr',
        <button type="button" className="input-action" onClick={() => void regenerate()} aria-label="Make a new secret">
          <ArrowPathIcon />
        </button>
      )}
      <div className="mt-4 max-w-6xl sm:grid sm:grid-cols-3 sm:gap-4">
        <div />
        <p className="text-xs text-gray-500 sm:col-span-2">
          Tip: if Bubblarr runs in Docker on the same server, use the server&apos;s IP address in the URL, not &quot;localhost&quot;.
        </p>
      </div>
    </div>
  );
}
