import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { WorkOS } from "@workos-inc/node";
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, ORIGIN } from "$env/static/private";

const workos = new WorkOS(WORKOS_API_KEY);
const isProduction = ORIGIN.startsWith("https://");

export const GET: RequestHandler = async ({ url, cookies }) => {
  const callbackUrl = url.searchParams.get("callback_url");

  if (callbackUrl) {
    cookies.set("auth_callback_url", callbackUrl, {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 10 * 60,
    });
  }

  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: WORKOS_CLIENT_ID,
    redirectUri: `${ORIGIN}/auth/callback`,
  });

  throw redirect(302, authorizationUrl);
};
