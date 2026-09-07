import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkOS } from "$lib/server/workos";

export const GET: RequestHandler = async ({ url, cookies }) => {
  const { client, clientId } = getWorkOS();
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

  const authorizationUrl = client.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId,
    redirectUri: `${url.origin}/auth/callback`,
  });

  throw redirect(302, authorizationUrl);
};
