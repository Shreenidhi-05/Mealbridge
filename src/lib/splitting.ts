// src/lib/splitting.ts
export function splitIntoLots(total: number, lotSize?: number) {
  if (!lotSize || lotSize >= total) return [total];

  const lots: number[] = [];
  let remaining = total;

  while (remaining > 0) {
    const size = Math.min(lotSize, remaining);
    lots.push(size);
    remaining -= size;
  }
  return lots;
}
