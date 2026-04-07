import { redirect } from "@sveltejs/kit";
import { WorkOS } from "@workos-inc/node";
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, ORIGIN } from "$env/static/private";
import type { RequestHandler } from "./$types";

const workos = new WorkOS(WORKOS_API_KEY);

export const GET: RequestHandler = async () => {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: WORKOS_CLIENT_ID,
    redirectUri: `${ORIGIN}/auth/callback`,
  });

  throw redirect(302, authorizationUrl);
};
