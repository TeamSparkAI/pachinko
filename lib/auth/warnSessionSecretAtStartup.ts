import { logger } from '@/lib/logging/server';

/**
 * Plain Node only — do not import `session.ts` here (it pulls `next/headers` and breaks the
 * custom server / tsx bootstrap).
 */
export function warnIfUnsetSessionSecretAtStartup(): void {
  if (process.env.PACHINKO_SESSION_JWT_SECRET?.trim()) {
    return;
  }
  if (process.env.NODE_ENV === 'development') {
    logger.warn(
      'PACHINKO_SESSION_JWT_SECRET is unset; using a fixed dev default (set the env for non-local use).'
    );
  } else {
    logger.error(
      'PACHINKO_SESSION_JWT_SECRET is unset; using an insecure built-in default. Set PACHINKO_SESSION_JWT_SECRET (e.g. openssl rand -base64 48) before production or any shared host.'
    );
  }
}
