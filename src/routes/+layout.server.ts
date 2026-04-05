// Generated with AI
// This runs on the server for EVERY page (because it's in the root layout).
// Its job: take the user info from event.locals (set by our hook)
// and pass it to the client-side layout as "data".
//
// Why do we need this? hooks.server.ts puts user on event.locals,
// but Svelte components can't read event.locals directly — they live
// in the browser. This file bridges the gap: server → browser.

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
    token: locals.token,
  };
};
