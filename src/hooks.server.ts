// Generated with AI
// This file runs before EVERY request to our SvelteKit app.
// Its job: read the WorkOS JWT from the cookie, decode it,
// and put the user info on `event.locals` so all pages can access it.
//
// If the access token is expired but a refresh token exists,
// it silently refreshes the token so the user stays logged in.
//
// Note: We decode (not verify) the JWT here. Signature verification
// happens on the Convex side via auth.config.ts + JWKS. This hook
// only extracts claims for UI convenience — a forged token would
// show the UI but all Convex queries/mutations would reject it.

import type { Handle } from "@sveltejs/kit";
import { WorkOS } from "@workos-inc/node";
import { env } from "$env/dynamic/private";

const workos = new WorkOS(env.WORKOS_API_KEY);

function decodeAndCheck(token: string): { payload: Record<string, string>; expired: boolean } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expired = payload.exp * 1000 < Date.now() + 30_000;
    return { payload, expired };
  } catch {
    return null;
  }
}

function extractUser(payload: Record<string, string>) {
  return {
    id: payload.sub,
    email: payload.email,
    name:
      payload.first_name && payload.last_name
        ? `${payload.first_name} ${payload.last_name}`
        : payload.first_name || null,
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  const isProduction = event.url.protocol === "https:";
  let token = event.cookies.get("workos_access_token") ?? null;
  const refreshToken = event.cookies.get("workos_refresh_token") ?? null;

  // Try to refresh if the access token is missing or expired
  if ((!token || decodeAndCheck(token)?.expired) && refreshToken) {
    try {
      const result = await workos.userManagement.authenticateWithRefreshToken({
        clientId: env.WORKOS_CLIENT_ID,
        refreshToken,
      });

      token = result.accessToken;

      event.cookies.set("workos_access_token", result.accessToken, {
        path: "/",
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60,
      });

      event.cookies.set("workos_refresh_token", result.refreshToken, {
        path: "/",
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    } catch {
      // Refresh failed — clear everything
      event.cookies.delete("workos_access_token", { path: "/" });
      event.cookies.delete("workos_refresh_token", { path: "/" });
      token = null;
    }
  }

  if (token) {
    const decoded = decodeAndCheck(token);
    if (decoded && !decoded.expired) {
      event.locals.user = extractUser(decoded.payload);
      event.locals.token = token;
    } else {
      event.locals.user = null;
      event.locals.token = null;
    }
  } else {
    event.locals.user = null;
    event.locals.token = null;
  }

  return resolve(event);
};
