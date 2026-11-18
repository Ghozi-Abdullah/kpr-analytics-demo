const read = (key, fallback) => {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--fs-${key}`));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
};

export const FS = {
  nano: read('nano', 8),
  micro: read('micro', 9.5),
  caption: read('caption', 11),
  body: read('body', 13),
  lead: read('lead', 15),
};
