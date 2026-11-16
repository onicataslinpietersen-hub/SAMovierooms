export function zar(cents: number, opts: { decimals?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100);
  const c = abs % 100;
  const body = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const showDec = opts.decimals ?? c !== 0;
  return `${neg ? "-" : ""}R${body}${showDec ? "." + c.toString().padStart(2, "0") : ""}`;
}

export const bpsToPct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;

export function parseRands(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(String(input).replace(/[R\s,]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
