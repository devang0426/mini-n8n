/**
 * AI Agent Workflow Builder — Secret Sanitizer (Phase 4A)
 * Redacts secrets, API keys, passwords, and sensitive headers from errors and logs.
 */

const SECRET_PATTERNS = [
  /authorization:\s*bearer\s+[a-zA-Z0-9\._\-]+/gi,
  /bearer\s+[a-zA-Z0-9\._\-]+/gi,
  /api[_\-]?key\s*[:=]\s*["']?[a-zA-Z0-9\._\-]+["']?/gi,
  /password\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  /secret\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  /AQ\.[a-zA-Z0-9\._\-]+/g,
];

export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  let sanitized = text;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized;
}

export function sanitizeObject<T = unknown>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('authorization')
    ) {
      result[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
