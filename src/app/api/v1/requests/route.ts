import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { handler, json, parseBody, requireUser } from '@app/server/http';
import { createRequest, listRequests, type RequestFilter } from '@app/server/requests';

export const dynamic = 'force-dynamic';

const FILTERS: RequestFilter[] = [
  'all',
  'processing',
  'partially_available',
  'available',
  'failed',
];

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const filter = (params.get('filter') ?? 'all') as RequestFilter;
  const take = Math.min(Math.max(Number(params.get('take')) || 20, 1), 100);
  const page = Math.max(Number(params.get('page')) || 1, 1);

  const { results, total } = listRequests(user, {
    filter: FILTERS.includes(filter) ? filter : 'all',
    take,
    skip: (page - 1) * take,
    mine: params.get('mine') === '1',
  });
  return json({
    pageInfo: { page, pages: Math.max(Math.ceil(total / take), 1), pageSize: take, results: total },
    results,
  });
});

const schema = z.object({
  comicvineId: z.number().int().positive(),
  issues: z.union([
    z.literal('all'),
    z.literal('future'),
    z.array(z.number().int().positive()).min(1).max(1000),
  ]),
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser(Permission.REQUEST);
  const { comicvineId, issues } = await parseBody(request, schema);
  const result = await createRequest(user, comicvineId, issues);
  return json(result, result.created ? 201 : 200);
});
