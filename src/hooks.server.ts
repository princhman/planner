// Generated with AI
// This file runs before EVERY request to our SvelteKit app.
// Its job: read the WorkOS JWT from the cookie, verify its signature,
// and put the user info on `event.locals` so all pages can access it.

import type { Handle } from "@sveltejs/kit";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { WORKOS_CLIENT_ID } from "$env/static/private";

// JWKS is cached by jose — safe to create once at module level.
// It fetches the public keys from WorkOS and caches them in memory.
const jwks = createRemoteJWKSet(
  new URL(`https://api.workos.com/sso/jwks/${WORKOS_CLIENT_ID}`),
);

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("workos_access_token");

  if (token) {
    try {
      // Verify the JWT signature against WorkOS's public keys.
      // This ensures the token wasn't forged or tampered with.
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `https://api.workos.com/user_management/${WORKOS_CLIENT_ID}`,
      });

      event.locals.user = {
        id: payload.sub!,
        email: payload.email as string,
        name:
          payload.first_name && payload.last_name
            ? `${payload.first_name} ${payload.last_name}`
            : (payload.first_name as string) || null,
      };

      event.locals.token = token;
    } catch {
      // Signature invalid, token expired, or malformed — clear the cookie
      event.locals.user = null;
      event.locals.token = null;
    }
  } else {
    event.locals.user = null;
    event.locals.token = null;
  }

  return resolve(event);
};
