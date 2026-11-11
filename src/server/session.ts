import type { ResponseControl } from '@loozo/angular-launch/server';

/** A browser profile's identity: random, and mapped to a seat in each room it joined. */
export type SessionId = string;

const cookieName = 'sr_session';

/** 12 hours, so a phone that drops session cookies keeps its seat for a whole team session. */
const maxAgeSeconds = 12 * 60 * 60;

/** 128 random bits in base64url without padding. */
const sessionIdPattern = /^[A-Za-z0-9_-]{22}$/;

export function newSessionId(): SessionId {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** The session id from the request's `Cookie` header, or null when it has none or a malformed one. */
export function readSessionId(request: Request): SessionId | null {
  const header = request.headers.get('cookie');
  if (header === null) {
    return null;
  }

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const name = pair.slice(0, separator).trim();
    if (name !== cookieName) {
      continue;
    }

    const value = pair.slice(separator + 1).trim();
    if (sessionIdPattern.test(value)) {
      return value;
    }
  }

  return null;
}

/**
 * Sends the session cookie with Launch's defaults (`HttpOnly; Secure; SameSite=Lax; Path=/`).
 * Call it only after the room accepted the seat: Launch sends cookies with failures too.
 */
export function setSessionCookie(response: ResponseControl, sessionId: SessionId): void {
  response.setCookie(cookieName, sessionId, { maxAge: maxAgeSeconds });
}
