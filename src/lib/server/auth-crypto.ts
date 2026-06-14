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

function getEncryptionPublicKey(): crypto.KeyLike {
  const configuredPublicKey = env.JWT_ENCRYPTION_PUBLIC_KEY;
  if (configuredPublicKey) {
    return normalizePem(configuredPublicKey);
  }

  return crypto.createPublicKey(readPrivateKeyPem());
}

export function encryptAuthUser(user: AuthUser): string {
  const encrypted = crypto.publicEncrypt(
    {
      key: getEncryptionPublicKey(),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(JSON.stringify(user), "utf8"),
  );

  return encrypted.toString("base64url");
}
