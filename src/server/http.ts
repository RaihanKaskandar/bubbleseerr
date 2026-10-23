import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

import { Permission } from '@app/lib/permissions';
import {
  getUserBySessionToken,
  SESSION_COOKIE,
  userHasPermission,
} from '@app/server/auth';
import type { User } from '@app/server/db/schema';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'error'
  ) {
    super(message);
  }
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Wrap a route handler so that thrown ApiErrors (and unexpected errors)
 * become JSON responses of the form `{ error, message }`.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: e.code, message: e.message }, e.status);
      }
      console.error(e);
      return json(
        { error: 'internal_error', message: 'Something went wrong' },
        500
      );
    }
  };
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser(): Promise<User | null> {
  return getUserBySessionToken(await getSessionToken());
}

/**
 * Get the logged in user, or fail with 401 (not logged in) or 403 (missing
 * permission).
 */
export async function requireUser(
  permission?: Permission | Permission[],
  type: 'and' | 'or' = 'and'
): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, 'You need to log in', 'unauthorized');
  }
  if (permission !== undefined && !userHasPermission(user, permission, type)) {
    throw new ApiError(
      403,
      "You don't have permission to do this",
      'forbidden'
    );
  }
  return user;
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    throw new ApiError(400, 'The request body is not valid JSON', 'bad_request');
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(
      400,
      issue
        ? `${issue.path.join('.') || 'body'}: ${issue.message}`
        : 'Invalid request',
      'validation_error'
    );
  }
  return result.data;
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

export const idParam = z.coerce.number().int().positive();
