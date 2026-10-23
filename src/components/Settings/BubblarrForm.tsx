'use client';
import { BeakerIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import { InlineSpinner } from '@app/components/Common/LoadingSpinner';
import { apiSend, errorMessage } from '@app/lib/api';
import type { RootFolder } from '@app/lib/types';

interface BubblarrFormProps {
  initial: { bubblarrUrl: string; bubblarrApiKey: string; bubblarrRootFolderId: number | null };
  onSaved?: () => void;
  saveText?: string;
}

/** Connect to Bubblarr: URL, API key, test, root folder */
export default function BubblarrForm({ initial, onSaved, saveText = 'Save Changes' }: BubblarrFormProps) {
  const [url, setUrl] = useState(initial.bubblarrUrl);
  const [apiKey, setApiKey] = useState(initial.bubblarrApiKey);
  const [rootFolderId, setRootFolderId] = useState<number | null>(initial.bubblarrRootFolderId);
  const [rootFolders, setRootFolders] = useState<RootFolder[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const test = async (): Promise<boolean> => {
    setTesting(true);
    setTestError(null);
    try {
      const result = await apiSend<{ success: boolean; message?: string; rootFolders?: RootFolder[] }>(
        '/api/v1/settings/bubblarr/test', 'POST', { url, apiKey }
      );
      if (!result.success) {
        setTestError(result.message ?? "Couldn't connect");
        setRootFolders(null);
        return false;
      }
      setRootFolders(result.rootFolders ?? []);
      if (result.rootFolders?.length && !result.rootFolders.some((f) => f.id === rootFolderId)) {
        setRootFolderId(result.rootFolders[0].id);
      }
      toast.success('Connected to Bubblarr');
      return true;
    } catch (e) {
      setTestError(errorMessage(e));
      return false;
    } finally {
      setTesting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootFolders && !(await test())) {
      return;
    }
    setSaving(true);
    try {
      await apiSend('/api/v1/settings', 'PUT', {
        bubblarrUrl: url,
        bubblarrApiKey: apiKey,
        bubblarrRootFolderId: rootFolderId,
      });
      toast.success('Bubblarr settings saved');
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
        <label htmlFor="bubblarr-url" className="text-label">
          URL<span className="label-required">*</span>
          <span className="label-tip">For example http://192.168.1.10:5657</span>
        </label>
        <div className="form-input-area">
          <div className="form-input-field">
            <input id="bubblarr-url" type="url" required value={url} onChange={(e) => { setUrl(e.target.value); setRootFolders(null); }} placeholder="http://bubblarr:5656" />
          </div>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="bubblarr-key" className="text-label">
          API Key<span className="label-required">*</span>
          <span className="label-tip">In Bubblarr: Settings → General → API Key</span>
        </label>
        <div className="form-input-area">
          <div className="form-input-field">
            <input id="bubblarr-key" type="password" required autoComplete="off" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setRootFolders(null); }} />
          </div>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="bubblarr-root" className="text-label">
          Root Folder
          <span className="label-tip">Where new comics are put</span>
        </label>
        <div className="form-input-area">
          <div className="form-input-field">
            <select id="bubblarr-root" value={rootFolderId ?? ''} onChange={(e) => setRootFolderId(e.target.value ? Number(e.target.value) : null)} disabled={!rootFolders}>
              {!rootFolders && <option value={rootFolderId ?? ''}>{rootFolderId ? `Root folder ${rootFolderId} (test to see all)` : 'Test the connection first'}</option>}
              {rootFolders?.map((f) => (
                <option key={f.id} value={f.id}>{f.folder}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {testError && (
        <div className="mt-6 max-w-xl">
          <Alert type="error" title="Couldn't connect to Bubblarr">{testError}</Alert>
        </div>
      )}
      <div className="actions">
        <div className="flex justify-end">
          <span className="ml-3 inline-flex rounded-md shadow-sm">
            <Button buttonType="warning" onClick={() => void test()} disabled={testing || !url || !apiKey}>
              {testing ? <InlineSpinner className="mr-2 h-5 w-5" /> : <BeakerIcon />}
              <span>{testing ? 'Testing...' : 'Test'}</span>
            </Button>
          </span>
          <span className="ml-3 inline-flex rounded-md shadow-sm">
            <Button buttonType="primary" type="submit" disabled={saving || testing}>
              <CheckIcon />
              <span>{saving ? 'Saving...' : saveText}</span>
            </Button>
          </span>
        </div>
      </div>
    </form>
  );
}
