import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkOS } from "$lib/server/workos";

export const GET: RequestHandler = async ({ url, cookies }) => {
  const { client, clientId } = getWorkOS();
  const isProduction = url.protocol === "https:";
  const code = url.searchParams.get("code");

  if (!code) {
    throw redirect(302, "/auth/login");
  }

  const { accessToken, refreshToken } =
    await client.userManagement.authenticateWithCode({
      clientId,
      code,
    });

  cookies.set("workos_access_token", accessToken, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60,
  });

  cookies.set("workos_refresh_token", refreshToken, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  const callbackUrl = cookies.get("auth_callback_url");
  if (callbackUrl) {
    cookies.delete("auth_callback_url", { path: "/" });
    throw redirect(
      302,
      `/auth?callback_url=${encodeURIComponent(callbackUrl)}`,
    );
  }

  throw redirect(302, "/");
};
