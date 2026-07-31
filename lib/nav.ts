// Safe modal dismissal. router.back() throws "GO_BACK was not handled by any
// navigator" when there's nothing beneath the current screen — which happens
// when a modal is reached directly (deep link, a tapped deadline notification,
// or cold-start into a route) rather than pushed from a parent. Fall back to the
// Vault root in that case.

import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

export function dismiss(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
