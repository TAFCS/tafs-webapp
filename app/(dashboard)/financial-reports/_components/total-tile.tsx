/** Shared stat tile for every financial report. */
export function TotalTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border p-4 ${
        accent
          ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit tabular-nums">
        {value}
      </p>
      {sub && <p className="text-[11px] font-medium text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
