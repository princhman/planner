import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "$env/dynamic/private";

export type AuthUser = {
  email: string;
  name: string;
  company: string;
};

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function readPrivateKeyPem(): string {
  if (env.PRIVATE_KEY) {
    return normalizePem(env.PRIVATE_KEY);
  }

  const pemPath = path.resolve("private.pem");
  if (fs.existsSync(pemPath)) {
    return normalizePem(fs.readFileSync(pemPath, "utf8"));
  }

  throw new Error("Missing PRIVATE_KEY env var and private.pem file");
}

export function encryptAuthUser(user: AuthUser): string {
  const encrypted = crypto.privateEncrypt(
    {
      key: readPrivateKeyPem(),
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(JSON.stringify(user), "utf8"),
  );

  return encrypted.toString("base64url");
}
