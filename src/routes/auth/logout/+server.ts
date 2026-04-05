// Generated with AI
// Logout needs to do TWO things:
// 1. Clear our app's cookies
// 2. Redirect to WorkOS's logout URL so the WorkOS session is also cleared
//    (otherwise WorkOS auto-logs you back in next time)

import { redirect } from "@sveltejs/kit";
import { WorkOS } from "@workos-inc/node";
import { WORKOS_API_KEY, WORKOS_CLIENT_ID } from "$env/static/private";
import type { RequestHandler } from "./$types";

const workos = new WorkOS(WORKOS_API_KEY);

export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get("workos_access_token");

  // Clear our cookies regardless
  cookies.delete("workos_access_token", { path: "/" });
  cookies.delete("workos_refresh_token", { path: "/" });

  // Try to get the session ID from the JWT so we can log out from WorkOS too
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // The JWT "sid" claim is the WorkOS session ID
      if (payload.sid) {
        const logoutUrl = workos.userManagement.getLogoutUrl({
          sessionId: payload.sid,
          returnTo: "http://localhost:5173",
        });
        throw redirect(302, logoutUrl);
      }
    } catch (e) {
      // If it's a redirect, re-throw it (SvelteKit uses throw for redirects)
      if (e && typeof e === "object" && "status" in e) throw e;
      // Otherwise token was malformed — just redirect home
    }
  }

  throw redirect(302, "/");
};
