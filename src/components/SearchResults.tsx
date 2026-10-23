"use client";
// Adapted from Seerr's Search and ListView (MIT, https://github.com/seerr-team/seerr)
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { usePublishers } from "@app/components/AppContext";
import Alert from "@app/components/Common/Alert";
import Header from "@app/components/Common/Header";
import PageTitle from "@app/components/Common/PageTitle";
import TitleCard, { TitleCardPlaceholder } from "@app/components/TitleCard";
import { errorMessage, fetcher } from "@app/lib/api";
import { describePublishers, wantsPublisher } from "@app/lib/publishers";
import type { CardData } from "@app/server/cards";

type Sort = "newest" | "oldest" | "relevance" | "issues";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "relevance", label: "Best Match" },
  { value: "issues", label: "Most Issues" },
];

function sortCards(cards: CardData[], sort: Sort): CardData[] {
  if (sort === "relevance") {
    return cards;
  }
  return [...cards].sort((a, b) => {
    if (sort === "issues") {
      return (b.issueCount ?? 0) - (a.issueCount ?? 0);
    }
    // Unknown years last
    const ay = a.year ?? (sort === "newest" ? -Infinity : Infinity);
    const by = b.year ?? (sort === "newest" ? -Infinity : Infinity);
    return (
      (sort === "newest" ? by - ay : ay - by) ||
      (b.issueCount ?? 0) - (a.issueCount ?? 0)
    );
  });
}

/** "mine" = the user's publishers, "all", or one publisher name */
const MINE = "mine";
const ALL = "all";

export default function SearchResults() {
  const query = (useSearchParams().get("query") ?? "").trim();
  const myPublishers = usePublishers();
  const { data, error, mutate } = useSWR<{
    query: string;
    results: CardData[];
  }>(
    query.length >= 2
      ? `/api/v1/search?query=${encodeURIComponent(query)}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [showForeign, setShowForeign] = useState(false);
  const [showCollected, setShowCollected] = useState(false);
  const [publisher, setPublisher] = useState(MINE);
  const [sort, setSort] = useState<Sort>("newest");

  const all = useMemo(() => data?.results ?? [], [data]);
  const publishers = useMemo(
    () =>
      [
        ...new Set(all.map((r) => r.publisher).filter((p): p is string => !!p)),
      ].sort(),
    [all],
  );
  const publisherMatches = (r: CardData) =>
    publisher === ALL ||
    (publisher === MINE
      ? wantsPublisher(myPublishers, r.publisher)
      : r.publisher === publisher);
  // The counts on the toggles are of what the other filters leave
  const afterPublisher = all.filter(publisherMatches);
  const hiddenForeign = afterPublisher.filter(
    (r) => r.translated && (showCollected || !r.collected),
  ).length;
  const hiddenCollected = afterPublisher.filter(
    (r) => r.collected && (showForeign || !r.translated),
  ).length;
  const results = sortCards(
    afterPublisher.filter(
      (r) => (showForeign || !r.translated) && (showCollected || !r.collected),
    ),
    sort,
  );
  const otherPublishers =
    publisher === MINE
      ? all.filter(
          (r) => !wantsPublisher(myPublishers, r.publisher) && !r.translated,
        ).length
      : 0;
  const selectClass =
    "min-w-0 flex-1 rounded-md border-gray-600 bg-gray-800 text-sm sm:w-auto sm:flex-none";
  const toggleClass =
    "!mb-0 flex cursor-pointer items-center gap-2 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm !font-medium !text-gray-200";

  return (
    <>
      <PageTitle title={query ? `Search: ${query}` : "Search"} />
      <Header
        subtext={
          data ? `${results.length} comics found for "${query}"` : undefined
        }
        extra={
          data && all.length > 0 ? (
            <>
              <div className="flex w-full gap-2 sm:w-auto">
                <select
                  aria-label="Publisher"
                  title={`My publishers: ${describePublishers(myPublishers)}`}
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className={selectClass}
                >
                  <option value={MINE}>My Publishers</option>
                  <option value={ALL}>All Publishers</option>
                  {publishers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className={selectClass}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {(hiddenCollected > 0 || showCollected) && (
                <label
                  className={toggleClass}
                  title="Trade paperbacks, hardcovers, omnibuses and compendiums"
                >
                  <input
                    type="checkbox"
                    checked={showCollected}
                    onChange={(e) => setShowCollected(e.target.checked)}
                    className="!h-4 !w-4"
                  />
                  Collected editions ({hiddenCollected})
                </label>
              )}
              {(hiddenForeign > 0 || showForeign) && (
                <label className={toggleClass}>
                  <input
                    type="checkbox"
                    checked={showForeign}
                    onChange={(e) => setShowForeign(e.target.checked)}
                    className="!h-4 !w-4"
                  />
                  Foreign editions ({hiddenForeign})
                </label>
              )}
            </>
          ) : undefined
        }
      >
        Search Results
      </Header>
      {otherPublishers > 0 && (
        <p className="mt-2 text-sm text-gray-400">
          Showing {describePublishers(myPublishers)}. {otherPublishers} more
          from other publishers.{" "}
          <button
            type="button"
            className="text-indigo-400 hover:underline"
            onClick={() => setPublisher(ALL)}
          >
            Show all publishers
          </button>
        </p>
      )}

      {query.length < 2 && (
        <p className="mt-8 text-gray-400">
          Type the name of a comic in the search bar.
        </p>
      )}
      {error && (
        <div className="mt-6">
          <Alert type="error" title="Searching failed">
            {errorMessage(error)}
          </Alert>
        </div>
      )}
      {!error && query.length >= 2 && (
        <ul className="cards-vertical mt-6">
          {data
            ? results.map((card) => (
                <li key={card.comicvineId}>
                  <TitleCard
                    card={card}
                    canExpand
                    onRequested={() => void mutate()}
                  />
                </li>
              ))
            : [...Array(12)].map((_, i) => (
                <li key={i}>
                  <TitleCardPlaceholder canExpand />
                </li>
              ))}
        </ul>
      )}
      {data && results.length === 0 && (
        <div className="mt-16 text-center text-gray-400">
          {all.length > 0 ? (
            <>
              <p className="text-lg font-medium text-gray-300">
                Nothing matches the filters
              </p>
              <p className="mt-2 text-sm">
                {all.length} comics were found, but the filters above hide them.{" "}
                <button
                  type="button"
                  className="text-indigo-400 hover:underline"
                  onClick={() => {
                    setPublisher(ALL);
                    setShowCollected(true);
                    setShowForeign(true);
                  }}
                >
                  Show everything
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-300">
                No comics found
              </p>
              <p className="mt-2 text-sm">
                Try a shorter name, e.g. &quot;Batman&quot; instead of
                &quot;Batman Year One #1&quot;.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
