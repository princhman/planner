// Generated with AI
// This file runs before EVERY request to our SvelteKit app.
// Its job: read the WorkOS JWT from the cookie, decode it,
// and put the user info on `event.locals` so all pages can access it.
//
// Note: We decode (not verify) the JWT here. Signature verification
// happens on the Convex side via auth.config.ts + JWKS. This hook
// only extracts claims for UI convenience — a forged token would
// show the UI but all Convex queries/mutations would reject it.

import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("workos_access_token");

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      event.locals.user = {
        id: payload.sub,
        email: payload.email,
        name:
          payload.first_name && payload.last_name
            ? `${payload.first_name} ${payload.last_name}`
            : payload.first_name || null,
      };

      event.locals.token = token;
    } catch {
      event.locals.user = null;
      event.locals.token = null;
    }
  } else {
    event.locals.user = null;
    event.locals.token = null;
  }

  return resolve(event);
};
