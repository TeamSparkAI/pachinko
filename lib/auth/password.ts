import * as argon2 from 'argon2';
import { MIN_PASSWORD_LENGTH } from './constants';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Returns an error message or `null` if the password is acceptable. */
export function validateNewPassword(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}
