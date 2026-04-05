// Generated with AI
// This file runs before EVERY request to our SvelteKit app.
// Its job: read the WorkOS JWT from the cookie, decode it,
// and put the user info on `event.locals` so all pages can access it.

import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Grab the access token cookie that was set during /auth/callback
  const token = event.cookies.get("workos_access_token");

  if (token) {
    try {
      // 2. A JWT has 3 parts separated by dots: header.payload.signature
      //    We only need the middle part (payload) which contains user info.
      //    atob() decodes base64 → plain text, then we parse the JSON.
      const payload = JSON.parse(atob(token.split(".")[1]));

      // 3. Attach user info to event.locals — this is SvelteKit's way of
      //    passing data through the request. Every +page.server.ts and
      //    +layout.server.ts can now read event.locals.user
      event.locals.user = {
        id: payload.sub, // "sub" = subject = the user's WorkOS ID
        email: payload.email,
        name:
          payload.first_name && payload.last_name
            ? `${payload.first_name} ${payload.last_name}`
            : payload.first_name || null,
      };

      // 4. Also store the raw token — we'll need this to send to Convex
      event.locals.token = token;
    } catch {
      // If the token is malformed/expired, treat user as not logged in
      event.locals.user = null;
      event.locals.token = null;
    }
  } else {
    // No cookie = not logged in
    event.locals.user = null;
    event.locals.token = null;
  }

  // 5. Continue processing the request (render the page, etc.)
  return resolve(event);
};
