/// <reference types="node" />

import crypto from "node:crypto";
import { env } from "$env/dynamic/private";

export type AuthUser = {
  email: string;
  name: string;
  company: string;
};

function getKey(): Buffer {
  const privateKey = env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  return crypto.createHash("sha256").update(privateKey).digest();
}

export function encryptAuthUser(user: AuthUser): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(user), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}
