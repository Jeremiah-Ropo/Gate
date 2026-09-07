export function formatDateTime(startsAtIso: string): string {
  const starts = new Date(startsAtIso);
  const dateFmt: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${starts.toLocaleDateString(undefined, dateFmt)} · ${starts.toLocaleTimeString(undefined, timeFmt)}`;
}

export function formatMoney(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
