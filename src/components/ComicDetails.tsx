'use client';
// Adapted from Seerr's MovieDetails and TvDetails (MIT, https://github.com/seerr-team/seerr)
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, BookOpenIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { NewspaperIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';

import { useUser } from '@app/components/AppContext';
import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import IssueStatusBadge from '@app/components/IssueStatusBadge';
import RequestItem from '@app/components/RequestItem';
import RequestModal, { type ComicResponse } from '@app/components/RequestModal';
import StatusBadge from '@app/components/StatusBadge';
import { apiSend, errorMessage, fetcher } from '@app/lib/api';
import { InlineSpinner } from '@app/components/Common/LoadingSpinner';
import { Permission } from '@app/lib/permissions';
import { canRequest, displayStatus } from '@app/lib/status';
import { formatDate, htmlToParagraphs } from '@app/lib/text';
import type { Ratings } from '@app/server/ratings';

export default function ComicDetails({ comicvineId }: { comicvineId: number }) {
  const { data, error, mutate } = useSWR<ComicResponse>(`/api/v1/comic/${comicvineId}`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: ratings } = useSWR<Ratings | null>(`/api/v1/comic/${comicvineId}/ratings`, fetcher, {
    revalidateOnFocus: false,
  });
  const { hasPermission } = useUser();
  const [showRequest, setShowRequest] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [explain, setExplain] = useState(false);
  const [findingInKavita, setFindingInKavita] = useState(false);

  /** Not in Kavita yet: let Kavita scan, then show the Read button */
  const findInKavita = async () => {
    setFindingInKavita(true);
    try {
      const result = await apiSend<{ kavitaUrl: string | null; message?: string }>(
        `/api/v1/comic/${comicvineId}/kavita`,
        'POST'
      );
      if (result.kavitaUrl) {
        void mutate((current) => current && { ...current, kavitaUrl: result.kavitaUrl }, { revalidate: false });
        toast.success('Found it in Kavita');
      } else {
        toast.error(result.message ?? "Kavita is still scanning. Try again in a minute.");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setFindingInKavita(false);
    }
  };

  const issues = useMemo(
    () => [...(data?.volume.issues ?? [])].sort((a, b) => b.calculated_issue_number - a.calculated_issue_number),
    [data]
  );
  const paragraphs = useMemo(() => htmlToParagraphs(data?.volume.description), [data]);

  if (error) {
    return (
      <div className="mt-8">
        <Alert type="error" title="Couldn't load this comic">{errorMessage(error)}</Alert>
      </div>
    );
  }
  if (!data) {
    return <LoadingSpinner />;
  }

  const { volume } = data;
  const library = volume.library;
  const status = displayStatus(library.status, data.requestStatus);
  const counts = library.issues;
  const downloaded = issues.filter((i) => i.library?.status === 'downloaded').length;
  const shownIssues = showAllIssues ? issues : issues.slice(0, 12);

  return (
    <div className="media-page" style={{ height: 493 }}>
      <PageTitle title={volume.title} />
      <RequestModal
        comicvineId={comicvineId}
        show={showRequest}
        onCancel={() => setShowRequest(false)}
        onComplete={() => void mutate(fetcher(`/api/v1/comic/${comicvineId}?fresh=1`))}
      />
      {volume.cover_link && (
        <div className="media-page-bg-image overflow-hidden">
          {/* Comics have no backdrops, so the cover is blurred instead */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={volume.cover_link} alt="" className="h-full w-full scale-110 object-cover object-top blur-2xl" />
          <div
            className="absolute inset-0"
            style={{
              // From the status bar's color at the top, like the rest of the app
              backgroundImage:
                'linear-gradient(180deg, rgba(17, 24, 39, 1) 0%, rgba(17, 24, 39, 0.47) calc(6rem + env(safe-area-inset-top)), rgba(17, 24, 39, 1) 100%)',
            }}
          />
        </div>
      )}

      <div className="media-header">
        <div className="media-poster">
          {volume.cover_link ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={volume.cover_link} alt="" className="w-full" />
          ) : (
            <div className="aspect-[2/3] w-full bg-gray-700" />
          )}
        </div>
        <div className="media-title">
          <div className="media-status">
            <StatusBadge status={status} />
            {volume.translated && <Badge badgeType="warning">Foreign Edition</Badge>}
          </div>
          <h1>
            {volume.title} {volume.year && <span className="media-year">({volume.year})</span>}
          </h1>
          <span className="media-attributes">
            {[
              volume.publisher,
              volume.volume_number > 1 ? `Volume ${volume.volume_number}` : null,
              `${volume.issue_count} issues`,
              counts && counts.downloaded > 0 ? `${counts.downloaded} available` : null,
            ]
              .filter(Boolean)
              .map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="mr-1">|</span>}
                  {part}
                </span>
              ))}
          </span>
        </div>
        <div className="media-actions">
          {data.kavitaUrl ? (
            <Button href={data.kavitaUrl} external buttonType="success" className="mr-2">
              <BookOpenIcon />
              <span>Read in Kavita</span>
            </Button>
          ) : (
            data.kavitaConfigured &&
            (status === 'available' || status === 'partially_available') && (
              <Button
                buttonType="ghost"
                className="mr-2"
                disabled={findingInKavita}
                onClick={() => void findInKavita()}
                title="Kavita doesn't have this comic yet. Ask Kavita to scan for it."
              >
                {findingInKavita ? <InlineSpinner className="mr-2 h-5 w-5" /> : <BookOpenIcon />}
                <span>{findingInKavita ? 'Looking in Kavita...' : 'Find in Kavita'}</span>
              </Button>
            )
          )}
          {hasPermission(Permission.REQUEST) && canRequest(status) && (
            <Button buttonType="primary" onClick={() => setShowRequest(true)}>
              <ArrowDownTrayIcon />
              <span>{status === 'none' ? 'Request' : 'Request More'}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="media-overview">
        <div className="media-overview-left min-w-0">
          <h2>Overview</h2>
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>No description available.</p>
          )}

          <div className="mt-8 flex items-center justify-between">
            <h2 className="flex items-center">
              Issues
              <button
                type="button"
                className="ml-2 text-gray-400 hover:text-white"
                onClick={() => setExplain((e) => !e)}
                aria-expanded={explain}
                aria-label="What are issues?"
              >
                <QuestionMarkCircleIcon className="h-6 w-6" />
              </button>
            </h2>
            <span className="text-sm text-gray-400">
              {downloaded} of {issues.length} available
            </span>
          </div>
          {explain && (
            <div className="mt-3">
              <Alert type="info" title="Comics come in issues">
                A comic series (like this one) is published in parts called <strong>issues</strong>, usually one a month,
                numbered #1, #2 and so on. When you request the series, you get every issue. A series can restart at #1
                with a new <strong>volume</strong>; each volume is its own entry here.
              </Alert>
            </div>
          )}
          {issues.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-700 shadow">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="bg-gray-700/80 px-4 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200">Issue</th>
                    <th className="hidden bg-gray-700/80 px-4 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 sm:table-cell">Released</th>
                    <th className="bg-gray-700/80 px-4 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 bg-gray-800/50">
                  {shownIssues.map((issue) => (
                    <tr key={issue.comicvine_id}>
                      <td className="px-4 py-3 text-sm text-gray-100">
                        <span className="font-semibold">#{issue.issue_number}</span>
                        {issue.title && <span className="ml-2 text-gray-400">{issue.title}</span>}
                        <span className="block text-xs text-gray-500 sm:hidden">{formatDate(issue.date)}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-300 sm:table-cell">{formatDate(issue.date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <IssueStatusBadge status={issue.library?.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {issues.length > 12 && (
                <button
                  type="button"
                  onClick={() => setShowAllIssues((s) => !s)}
                  className="w-full bg-gray-800 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  {showAllIssues ? 'Show fewer' : `Show all ${issues.length} issues`}
                </button>
              )}
            </div>
          ) : (
            <p>No issues known yet.</p>
          )}

          {data.requests.length > 0 && (
            <>
              <h2 className="mt-8">Requests</h2>
              <ul className="mt-4 space-y-4">
                {data.requests.map((r) => (
                  <li key={r.id}>
                    <RequestItem request={r} onChange={() => void mutate()} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="media-overview-right">
          <div className="media-facts">
            {ratings && (ratings.critic || ratings.user) && (
              <div className="media-ratings">
                {ratings.critic && (
                  <a
                    href={ratings.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="media-rating"
                    title={`Critics: ${ratings.critic.rating} out of 10 from ${ratings.critic.count} reviews on Comic Book Roundup`}
                  >
                    <NewspaperIcon className="h-5 w-5 text-amber-400" />
                    <span>{ratings.critic.rating.toFixed(1)}</span>
                    <span className="text-xs font-normal text-gray-400">Critics</span>
                  </a>
                )}
                {ratings.user && (
                  <a
                    href={ratings.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="media-rating"
                    title={`Fans: ${ratings.user.rating} out of 10 from ${ratings.user.count} ratings on Comic Book Roundup`}
                  >
                    <UserGroupIcon className="h-5 w-5 text-sky-400" />
                    <span>{ratings.user.rating.toFixed(1)}</span>
                    <span className="text-xs font-normal text-gray-400">Fans</span>
                  </a>
                )}
              </div>
            )}
            <div className="media-fact">
              <span>Status</span>
              <span className="media-fact-value">
                <StatusBadge status={status} />
                {status === 'none' && 'Not Requested'}
              </span>
            </div>
            {volume.publisher && (
              <div className="media-fact">
                <span>Publisher</span>
                <span className="media-fact-value">{volume.publisher}</span>
              </div>
            )}
            {volume.year && (
              <div className="media-fact">
                <span>Started</span>
                <span className="media-fact-value">{volume.year}</span>
              </div>
            )}
            <div className="media-fact">
              <span>Volume</span>
              <span className="media-fact-value">{volume.volume_number}</span>
            </div>
            <div className="media-fact">
              <span>Issues</span>
              <span className="media-fact-value">{volume.issue_count}</span>
            </div>
            {counts && (
              <div className="media-fact">
                <span>Available</span>
                <span className="media-fact-value">
                  {counts.downloaded} of {counts.total}
                </span>
              </div>
            )}
            {issues.length > 0 && issues[0].date && (
              <div className="media-fact">
                <span>Latest Issue</span>
                <span className="media-fact-value">
                  #{issues[0].issue_number} · {formatDate(issues[0].date)}
                </span>
              </div>
            )}
            <div className="media-fact">
              <span>More Info</span>
              <span className="media-fact-value">
                <a href={volume.site_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                  ComicVine <ArrowTopRightOnSquareIcon className="ml-1 h-4 w-4" />
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="extra-bottom-space relative" />
    </div>
  );
}
