import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { WorkOS } from "@workos-inc/node";
import { env } from "$env/dynamic/private";

const workos = new WorkOS(env.WORKOS_API_KEY);

export const GET: RequestHandler = async ({ url, cookies }) => {
  const isProduction = url.protocol === "https:";
  const code = url.searchParams.get("code");

  if (!code) {
    throw redirect(302, "/auth/login");
  }

  const { accessToken, refreshToken } =
    await workos.userManagement.authenticateWithCode({
      clientId: env.WORKOS_CLIENT_ID,
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
