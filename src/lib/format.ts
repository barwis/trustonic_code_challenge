export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '-';
}

export function pageCount(total: number | null | undefined, pageSize: number): number {
  return Math.max(1, Math.ceil((total ?? 0) / pageSize));
}
