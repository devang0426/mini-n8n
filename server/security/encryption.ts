/**
 * AI Agent Workflow Builder — Authenticated Encryption Service (Phase P3)
 * Server-only AES-256-GCM encryption module for connection credentials.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 16; // 128-bit random IV
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag
const FORMAT_PREFIX = 'v1';

/**
 * Validates and retrieves the 32-byte encryption key from environment variable CONNECTION_ENCRYPTION_KEY.
 * Fails fast with explicit errors if missing or invalid.
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.CONNECTION_ENCRYPTION_KEY;

  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    throw new Error(
      'CONNECTION_ENCRYPTION_KEY environment variable is not set. A 32-byte (64 hex characters) server-only key is required for credential operations.'
    );
  }

  const trimmed = rawKey.trim();

  // 1. Try decoding hex string (64 characters = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  // 2. Try raw 32-byte string
  const buf = Buffer.from(trimmed, 'utf8');
  if (buf.length === 32) {
    return buf;
  }

  throw new Error(
    `CONNECTION_ENCRYPTION_KEY must be exactly 32 bytes (or a 64-character hex string). Got ${buf.length} bytes / ${trimmed.length} characters.`
  );
}

/**
 * Encrypts a serializable object using AES-256-GCM with a unique, secure random IV.
 * Format: v1.<ivHex>.<authTagHex>.<ciphertextHex>
 */
export function encryptCredential(payload: Record<string, unknown>): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload to encrypt must be a non-null object.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${FORMAT_PREFIX}.${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
}

/**
 * Decrypts a serialized AES-256-GCM string into the original credential object.
 * Throws explicit errors if tampered, corrupted, or formatted incorrectly.
 */
export function decryptCredential(encryptedStr: string): Record<string, unknown> {
  if (!encryptedStr || typeof encryptedStr !== 'string') {
    throw new Error('Encrypted credential string is required for decryption.');
  }

  const parts = encryptedStr.split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT_PREFIX) {
    throw new Error('Invalid encrypted credential format. Expected format: v1.<iv>.<tag>.<ciphertext>');
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Corrupted IV or authentication tag length.');
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    throw new Error(`Credential decryption failed: Authentication tag mismatch or tampered data.`);
  }
}
