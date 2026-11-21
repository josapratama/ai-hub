export interface GuardrailResult {
  flagged: boolean;
  reason?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+(instructions|directions)/i,
  /\bDAN\s+mode\b/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
  /print\s+(your\s+)?initial\s+(prompt|instructions)/i,
  /bypass\s+all\s+(filters|safeguards)/i,
];

export function checkSafetyGuardrails(messages: any[]): GuardrailResult {
  if (!Array.isArray(messages)) return { flagged: false };

  for (const m of messages) {
    if (m.role === "system") continue; // system prompts configured by developer are safe
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          flagged: true,
          reason: `Request flagged by AI Hub Safety Guardrails: Potential jailbreak or prompt injection detected.`,
        };
      }
    }
  }

  return { flagged: false };
}

// Regex patterns for sensitive PII data
const SENSITIVE_PATTERNS = [
  // Credit Card Numbers (13-16 digits with dashes or spaces)
  { regex: /\b(?:\d{4}[-\s]){3}\d{4}\b/g, replacement: "[REDACTED_CREDIT_CARD]" },
  // API Keys (OpenAI sk-..., Google AIzaSy..., Groq gsk_...)
  { regex: /\b(?:sk-[a-zA-Z0-9_-]{20,}|AIzaSy[a-zA-Z0-9_-]{33}|gsk_[a-zA-Z0-9_-]{20,})\b/g, replacement: "[REDACTED_API_KEY]" },
  // Email Addresses
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[REDACTED_EMAIL]" },
  // National ID / NIK (16-digit continuous number)
  { regex: /\b\d{16}\b/g, replacement: "[REDACTED_ID_NUMBER]" },
  // US SSN format
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED_SSN]" },
];

export function redactSensitiveData(messages: any[]): { messages: any[]; redactedCount: number } {
  if (!Array.isArray(messages)) return { messages, redactedCount: 0 };
  let count = 0;

  const sanitizeString = (str: string): string => {
    let result = str;
    for (const p of SENSITIVE_PATTERNS) {
      const matches = result.match(p.regex);
      if (matches) {
        count += matches.length;
        result = result.replace(p.regex, p.replacement);
      }
    }
    return result;
  };

  const sanitized = messages.map(m => {
    if (typeof m.content === "string") {
      return { ...m, content: sanitizeString(m.content) };
    }
    if (Array.isArray(m.content)) {
      const parts = m.content.map((part: any) => {
        if (part.type === "text" && typeof part.text === "string") {
          return { ...part, text: sanitizeString(part.text) };
        }
        return part;
      });
      return { ...m, content: parts };
    }
    return m;
  });

  return { messages: sanitized, redactedCount: count };
}
