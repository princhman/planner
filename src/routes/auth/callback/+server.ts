import { redirect } from "@sveltejs/kit";
import { WorkOS } from "@workos-inc/node";
import { WORKOS_API_KEY, WORKOS_CLIENT_ID } from "$env/static/private";
import type { RequestHandler } from "./$types";

const workos = new WorkOS(WORKOS_API_KEY);

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get("code");

  if (!code) {
    throw redirect(302, "/auth/login");
  }

  const { accessToken, refreshToken } =
    await workos.userManagement.authenticateWithCode({
      clientId: WORKOS_CLIENT_ID,
      code,
    });

  cookies.set("workos_access_token", accessToken, {
    path: "/",
    httpOnly: true,
    secure: false, // set to true in production
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
  });

  cookies.set("workos_refresh_token", refreshToken, {
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  throw redirect(302, "/");
};
