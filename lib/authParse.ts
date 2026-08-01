// Pure parsing helpers for the auth REST responses. Kept free of native deps
// (fetch/SecureStore/Crypto) so they can be unit-tested in isolation.

export type Session = { accessToken: string; refreshToken: string; email: string; userId: string };

/** Map a GoTrue token/session payload to our Session shape, or null if invalid. */
export function toSession(data: any): Session | null {
  if (!data?.access_token || !data?.user?.id) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    email: data.user.email ?? '',
    userId: data.user.id,
  };
}

/** Pick the most useful error string out of a GoTrue error body. */
export function errMsg(data: any, fallback: string): string {
  return data?.error_description || data?.msg || data?.message || data?.error || fallback;
}
