// Generated with AI
// Logout needs to do TWO things:
// 1. Clear our app's cookies
// 2. Redirect to WorkOS's logout URL so the WorkOS session is also cleared
//    (otherwise WorkOS auto-logs you back in next time)

import { redirect } from "@sveltejs/kit";
import { WorkOS } from "@workos-inc/node";
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, ORIGIN } from "$env/static/private";
import type { RequestHandler } from "./$types";

const workos = new WorkOS(WORKOS_API_KEY);

export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get("workos_access_token");

  cookies.delete("workos_access_token", { path: "/" });
  cookies.delete("workos_refresh_token", { path: "/" });

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.sid) {
        const logoutUrl = workos.userManagement.getLogoutUrl({
          sessionId: payload.sid,
          returnTo: ORIGIN,
        });
        throw redirect(302, logoutUrl);
      }
    } catch (e) {
      if (e && typeof e === "object" && "status" in e) throw e;
    }
  }

  throw redirect(302, "/");
};
