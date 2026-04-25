/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getDb } from '@/lib/models/sqlite/database';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

jest.mock('@/lib/models/sqlite/database', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/auth/password', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/password')>('@/lib/auth/password');
  return {
    ...actual,
    hashPassword: jest.fn().mockResolvedValue('hashed-for-test'),
  };
});

jest.mock('@/lib/auth/session', () => ({
  signSessionToken: jest.fn().mockReturnValue('test-jwt'),
  SESSION_MAX_AGE_SEC: 60,
}));

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when a user already exists', async () => {
    const tx = {
      queryOne: jest.fn().mockResolvedValue({ c: 1 }),
      execute: jest.fn(),
    };
    mockedGetDb.mockResolvedValue({
      transactionImmediate: jest.fn(async (cb: (db: typeof tx) => Promise<unknown>) => cb(tx)),
    } as never);

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.co', password: 'longenough' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it('creates the first user and returns session cookie', async () => {
    const tx = {
      queryOne: jest.fn().mockResolvedValue({ c: 0 }),
      execute: jest.fn().mockResolvedValue({ changes: 1, lastID: 42 }),
    };
    mockedGetDb.mockResolvedValue({
      transactionImmediate: jest.fn(async (cb: (db: typeof tx) => Promise<unknown>) => cb(tx)),
    } as never);

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.com', password: 'longenough' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, tenantId: 1, userId: 42 });
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('test-jwt');
  });

  it('returns 400 for short password', async () => {
    mockedGetDb.mockResolvedValue({} as never);
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.co', password: 'short' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });
});
