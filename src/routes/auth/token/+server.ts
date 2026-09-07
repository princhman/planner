// Generated with AI
// This endpoint returns a fresh access token for the Convex client.
// The Convex client calls this repeatedly to keep auth alive.
// If the current access token is expired, it uses the refresh token
// to get a new one from WorkOS.

import { json } from "@sveltejs/kit";
import { getWorkOS } from "$lib/server/workos";
import type { RequestHandler } from "./$types";

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Consider expired if less than 30 seconds remaining
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  const isProduction = url.protocol === "https:";
  const accessToken = cookies.get("workos_access_token");
  const refreshToken = cookies.get("workos_refresh_token");

  // If access token exists and is still valid, return it
  if (accessToken && !isTokenExpired(accessToken)) {
    return json({ token: accessToken });
  }

  // If we have a refresh token, use it to get a new access token
  if (refreshToken) {
    try {
      const { client, clientId } = getWorkOS();
      const result = await client.userManagement.authenticateWithRefreshToken({
        clientId,
        refreshToken,
      });

      cookies.set("workos_access_token", result.accessToken, {
        path: "/",
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60,
      });

      cookies.set("workos_refresh_token", result.refreshToken, {
        path: "/",
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });

      return json({ token: result.accessToken });
    } catch {
      // Refresh token is invalid/expired — clear everything
      cookies.delete("workos_access_token", { path: "/" });
      cookies.delete("workos_refresh_token", { path: "/" });
    }
  }

  return json({ token: null });
};
