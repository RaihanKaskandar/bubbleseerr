'use client';
import { BeakerIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import { InlineSpinner } from '@app/components/Common/LoadingSpinner';
import { apiSend, errorMessage } from '@app/lib/api';

interface KavitaFormProps {
  initial: { kavitaUrl: string; kavitaApiKey: string };
  onSaved?: () => void;
  saveText?: string;
  extraActions?: React.ReactNode;
}

/** Optional: Kavita, for the "Read in Kavita" button */
export default function KavitaForm({ initial, onSaved, saveText = 'Save Changes', extraActions }: KavitaFormProps) {
  const [url, setUrl] = useState(initial.kavitaUrl);
  const [apiKey, setApiKey] = useState(initial.kavitaApiKey);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const test = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const result = await apiSend<{ success: boolean; message?: string }>('/api/v1/settings/kavita/test', 'POST', { url, apiKey });
      if (result.success) {
        toast.success('Connected to Kavita');
      } else {
        setTestError(result.message ?? "Couldn't connect");
      }
    } catch (e) {
      setTestError(errorMessage(e));
    } finally {
      setTesting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiSend('/api/v1/settings', 'PUT', { kavitaUrl: url, kavitaApiKey: apiKey });
      toast.success('Kavita settings saved');
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="form-row">
        <label htmlFor="kavita-url" className="text-label">
          URL
          <span className="label-tip">The address people open Kavita on, e.g. http://192.168.1.10:5000</span>
        </label>
        <div className="form-input-area">
          <div className="form-input-field">
            <input id="kavita-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://kavita:5000" />
          </div>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="kavita-key" className="text-label">
          API Key
          <span className="label-tip">In Kavita: your user settings → API Key / OPDS</span>
        </label>
        <div className="form-input-area">
          <div className="form-input-field">
            <input id="kavita-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
        </div>
      </div>
      {testError && (
        <div className="mt-6 max-w-xl">
          <Alert type="error" title="Couldn't connect to Kavita">{testError}</Alert>
        </div>
      )}
      <div className="actions">
        <div className="flex justify-end">
          {extraActions}
          <span className="ml-3 inline-flex rounded-md shadow-sm">
            <Button buttonType="warning" onClick={() => void test()} disabled={testing || !url || !apiKey}>
              {testing ? <InlineSpinner className="mr-2 h-5 w-5" /> : <BeakerIcon />}
              <span>{testing ? 'Testing...' : 'Test'}</span>
            </Button>
          </span>
          <span className="ml-3 inline-flex rounded-md shadow-sm">
            <Button buttonType="primary" type="submit" disabled={saving}>
              <CheckIcon />
              <span>{saving ? 'Saving...' : saveText}</span>
            </Button>
          </span>
        </div>
      </div>
    </form>
  );
}
