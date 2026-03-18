export const getSingleParam = (value, fallback = null) => {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
};

export const getStringParam = (value, fallback = '') => {
  const resolved = getSingleParam(value, fallback);
  return resolved == null ? fallback : String(resolved);
};

export const safeJsonParseParam = (value, fallback, label = 'navigation param') => {
  const resolved = getSingleParam(value, null);

  if (resolved == null || resolved === '') {
    return fallback;
  }

  try {
    return JSON.parse(String(resolved));
  } catch (error) {
    console.warn(`Unable to parse ${label}`, error);
    return fallback;
  }
};
