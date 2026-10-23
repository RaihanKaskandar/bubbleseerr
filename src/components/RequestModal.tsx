'use client';
/**
 * Request a comic, in the style of Seerr's request modal. Made for people new
 * to comics: three plain choices instead of "volumes" and "issues".
 */
import { CheckIcon } from '@heroicons/react/24/solid';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';

import Alert from '@app/components/Common/Alert';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import Toggle from '@app/components/Common/Toggle';
import IssueStatusBadge from '@app/components/IssueStatusBadge';
import { apiSend, errorMessage, fetcher } from '@app/lib/api';
import type { LookupVolumeDetails, RequestItem, RequestStatus } from '@app/lib/types';

export interface ComicResponse {
  volume: LookupVolumeDetails;
  requestStatus: RequestStatus | null;
  requests: RequestItem[];
  kavitaUrl: string | null;
  kavitaConfigured?: boolean;
}

type Choice = 'all' | 'future' | 'pick';

interface RequestModalProps {
  comicvineId: number;
  show: boolean;
  onCancel: () => void;
  onComplete?: () => void;
}

const CHOICES: { value: Choice; title: string; description: string }[] = [
  {
    value: 'all',
    title: 'The whole series',
    description: 'Every issue that has come out, and every new one when it comes out.',
  },
  {
    value: 'future',
    title: 'Only new issues',
    description: "Start following the series: get new issues from now on, but not the ones already out.",
  },
  {
    value: 'pick',
    title: 'Pick issues',
    description: 'Choose exactly which issues you want, e.g. just #1 to try it out.',
  },
];

export default function RequestModal({ comicvineId, show, onCancel, onComplete }: RequestModalProps) {
  const { data, error } = useSWR<ComicResponse>(show ? `/api/v1/comic/${comicvineId}` : null, fetcher);
  const [choice, setChoice] = useState<Choice>('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setChoice('all');
      setSelected([]);
    }
  }, [show]);

  const issues = useMemo(
    () => [...(data?.volume.issues ?? [])].sort((a, b) => a.calculated_issue_number - b.calculated_issue_number),
    [data]
  );
  const requestable = issues.filter((i) => i.library?.status !== 'downloaded');
  const available = issues.length - requestable.length;

  const toggleIssue = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = requestable.length > 0 && requestable.every((i) => selected.includes(i.comicvine_id));

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await apiSend<{ created: boolean }>('/api/v1/requests', 'POST', {
        comicvineId,
        issues: choice === 'pick' ? selected : choice,
      });
      toast.success(
        result.created
          ? `${data?.volume.title} was requested. You'll find it under Requests.`
          : `${data?.volume.title} was already requested.`
      );
      onComplete?.();
      onCancel();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onCancel={onCancel}
      title="Request Comic"
      subTitle={data?.volume.title ?? ''}
      backdrop={data?.volume.cover_link}
      onOk={submit}
      okText={submitting ? 'Requesting' : 'Request'}
      okDisabled={!data || (choice === 'pick' && selected.length === 0)}
      loading={submitting}
    >
      {!data && !error && <SmallLoadingSpinner />}
      {error && <Alert type="error" title="Couldn't load this comic">{errorMessage(error)}</Alert>}
      {data && (
        <>
          {available > 0 && (
            <p className="mb-4 text-gray-300">
              {available === issues.length
                ? 'Every issue that is out is already available.'
                : `${available} of ${issues.length} issues are already available; you only get what's missing.`}
            </p>
          )}
          <fieldset>
            <legend className="sr-only">What do you want?</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {CHOICES.map((c) => (
                <label
                  key={c.value}
                  className={`relative mb-0 flex cursor-pointer flex-col rounded-lg border p-4 text-left transition ${
                    choice === c.value
                      ? 'border-indigo-500 bg-indigo-600/30 ring-1 ring-indigo-500'
                      : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="request-choice"
                    value={c.value}
                    checked={choice === c.value}
                    onChange={() => setChoice(c.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between text-base font-semibold text-white">
                    {c.title}
                    {choice === c.value && <CheckIcon className="h-5 w-5 text-indigo-400" />}
                  </span>
                  <span className="mt-1 text-xs font-normal leading-snug text-gray-300">{c.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {choice === 'pick' && (
            <div className="mt-4 flex flex-col">
              <div className="-mx-4 sm:mx-0">
                <div className="max-h-80 overflow-y-auto border border-gray-700 shadow backdrop-blur sm:rounded-lg">
                  <table className="min-w-full">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="w-16 bg-gray-700 px-4 py-3">
                          <Toggle
                            label="Select all missing issues"
                            checked={allSelected}
                            onChange={(on) => setSelected(on ? requestable.map((i) => i.comicvine_id) : [])}
                            disabled={requestable.length === 0}
                          />
                        </th>
                        <th className="bg-gray-700 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">Issue</th>
                        <th className="hidden bg-gray-700 px-5 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 sm:table-cell md:px-6">Released</th>
                        <th className="bg-gray-700 px-2 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {issues.map((issue) => {
                        const downloaded = issue.library?.status === 'downloaded';
                        return (
                          <tr key={issue.comicvine_id}>
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium leading-5 text-gray-100">
                              <Toggle
                                label={`Issue #${issue.issue_number}`}
                                checked={downloaded || selected.includes(issue.comicvine_id)}
                                disabled={downloaded}
                                onChange={() => toggleIssue(issue.comicvine_id)}
                              />
                            </td>
                            <td className="px-1 py-3 text-sm font-medium leading-5 text-gray-100 md:px-6">
                              #{issue.issue_number}
                              {issue.title && <span className="block text-xs font-normal text-gray-400">{issue.title}</span>}
                            </td>
                            <td className="hidden whitespace-nowrap px-5 py-3 text-sm leading-5 text-gray-200 sm:table-cell md:px-6">{issue.date ?? 'Unknown'}</td>
                            <td className="whitespace-nowrap py-3 pr-2 text-sm leading-5 text-gray-200 md:px-6">
                              <IssueStatusBadge status={issue.library?.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">{selected.length} selected</p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
