const DEFAULT_COLORS = [
  '#1d4ed8',
  '#0f766e',
  '#b45309',
  '#9333ea',
  '#be185d',
  '#0ea5e9',
  '#16a34a',
  '#dc2626',
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const toBase64 = (value: string) => {
  return btoa(unescape(encodeURIComponent(value)));
};

export const buildAvatarDataUri = (name: string) => {
  const safeName = name || '';
  const initials = getInitials(safeName);
  const color = DEFAULT_COLORS[hashString(safeName) % DEFAULT_COLORS.length];
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="${color}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="56" fill="#ffffff" font-weight="600">
    ${initials}
  </text>
</svg>
`.trim();
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
};
