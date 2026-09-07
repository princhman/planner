import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { WorkOS } from "@workos-inc/node";
import { env } from "$env/dynamic/private";

const workos = new WorkOS(env.WORKOS_API_KEY);

export const GET: RequestHandler = async ({ url, cookies }) => {
  const isProduction = url.protocol === "https:";
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
    clientId: env.WORKOS_CLIENT_ID,
    redirectUri: `${url.origin}/auth/callback`,
  });

  throw redirect(302, authorizationUrl);
};
