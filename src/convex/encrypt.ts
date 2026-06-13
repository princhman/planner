import crypto from "crypto";

export type User = {
  email: string;
  name: string;
  company: string;
};

export function encryptUser(user: User): string {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  const userJson = JSON.stringify(user);

  // Create cipher using AES-256-CBC with private key as seed
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    crypto.createHash("sha256").update(privateKey).digest(),
    iv
  );

  let encrypted = cipher.update(userJson, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Combine IV and encrypted data, return as base64
  const combined = Buffer.concat([iv, Buffer.from(encrypted, "hex")]);
  return combined.toString("base64");
}

export function decryptUser(encryptedData: string): User {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  const combined = Buffer.from(encryptedData, "base64");
  const iv = combined.slice(0, 16);
  const encrypted = combined.slice(16).toString("hex");

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    crypto.createHash("sha256").update(privateKey).digest(),
    iv
  );

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}
