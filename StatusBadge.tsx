const styles: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-blue-50 text-blue-700",
  VIEWED: "bg-violet-50 text-violet-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-rose-50 text-rose-700",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-800",
  EXPIRED: "bg-amber-50 text-amber-700",
};
const labels: Record<string, string> = { DRAFT: "Draft", PUBLISHED: "Sent", VIEWED: "Viewed", ACCEPTED: "Accepted", DECLINED: "Declined", CHANGES_REQUESTED: "Changes requested", EXPIRED: "Expired" };

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.DRAFT}`}>{labels[status] ?? status}</span>;
}
