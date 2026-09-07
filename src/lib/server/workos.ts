import { env } from "$env/dynamic/private";
import { WorkOS } from "@workos-inc/node";

function requirePrivateEnv(name: "WORKOS_API_KEY" | "WORKOS_CLIENT_ID"): string {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function getWorkOS() {
  return {
    client: new WorkOS(requirePrivateEnv("WORKOS_API_KEY")),
    clientId: requirePrivateEnv("WORKOS_CLIENT_ID"),
  };
}
