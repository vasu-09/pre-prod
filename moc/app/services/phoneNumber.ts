export const normalizeIndianPhoneNumber = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  let sanitized = trimmed.replace(/[^\d+]/g, '');

  if (!sanitized) {
    return null;
  }

  if (sanitized.startsWith('00')) {
    sanitized = sanitized.slice(2);
  }

  if (sanitized.startsWith('+')) {
    sanitized = sanitized.slice(1);
  }

  const digitsOnly = sanitized.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `+91${digitsOnly.slice(1)}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }

  return null;
};