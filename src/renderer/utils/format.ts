export const formatMilliseconds = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '-';
  }
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  const milliseconds = (value % 1000).toString().padStart(3, '0');
  return `${minutes}:${seconds}.${milliseconds}`;
};

export const normalizePath = (input: string): string => {
  return input.replace(/\\/g, '/');
};

export const fileNameFromPath = (input: string): string => {
  const normalized = normalizePath(input);
  const parts = normalized.split('/');
  return parts[parts.length - 1] ?? normalized;
};
