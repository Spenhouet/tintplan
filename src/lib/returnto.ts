import { page } from '$app/state';
import { resolve } from '$app/paths';

/**
 * Screens opened from the editor carry `?return=<path>` so their back button leads back there.
 * Only paths inside the app are accepted.
 */
export function returnTo(fallback: string): string {
  const r = page.url.searchParams.get('return');
  return r && r.startsWith(resolve('/')) && !r.startsWith('//') ? r : fallback;
}

/** `?return=...` for links that should keep the way back. */
export function returnQuery(): string {
  const r = page.url.searchParams.get('return');
  return r ? `?return=${encodeURIComponent(r)}` : '';
}
