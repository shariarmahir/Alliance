import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readBlobJson, writeBlobJson } from "./blob-store";

// Persists the Gmail OAuth refresh token for info@auto-bd.com. This token is
// a standing credential — anyone holding it can read (and, once send scope
// is granted, send as) that mailbox indefinitely, so it is encrypted at rest
// with AES-256-GCM regardless of the Blob store's own public/private setting
// (see blob-store.ts — the store may still be public until the SEC-02
// migration in SECURITY.md is done). SESSION_SECRET doubles as the
// encryption key via scrypt; a second secret isn't introduced for one value.

type StoredToken = {
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
  savedAt: string; // ISO, for the "connected since" note in the UI
};

const TOKEN_PATH = "gmail-refresh-token.json";

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is required to store the Gmail token (see SECURITY.md).");
  }
  // Fixed salt is acceptable here: this derives a single at-rest key from an
  // already-secret, already-random 32+ byte value, not a user password.
  return scryptSync(secret, "gmail-token-v1", 32);
}

export async function saveGmailRefreshToken(refreshToken: string): Promise<void> {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const stored: StoredToken = {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    savedAt: new Date().toISOString(),
  };
  await writeBlobJson(TOKEN_PATH, stored);
}

export async function readGmailRefreshToken(): Promise<{ token: string; savedAt: string } | null> {
  let stored: StoredToken;
  try {
    stored = await readBlobJson<StoredToken>(TOKEN_PATH);
  } catch {
    return null; // not connected yet — not an error
  }

  try {
    const key = encryptionKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(stored.iv, "base64"));
    decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(stored.ciphertext, "base64")),
      decipher.final(),
    ]);
    return { token: plain.toString("utf8"), savedAt: stored.savedAt };
  } catch {
    // SESSION_SECRET changed since this was saved, or the record is corrupt —
    // either way the token can't be recovered; the connect flow must be redone.
    return null;
  }
}

export async function clearGmailRefreshToken(): Promise<void> {
  await writeBlobJson(TOKEN_PATH, null);
}
