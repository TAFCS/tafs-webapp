"use client";

import type { StrengthColumn, StrengthGrid, StrengthRow } from "@/lib/student-reports.service";

/**
 * TAFSD-451: the Student Strength grid. Campus, class and section rows nest
 * (each a subtotal of the rows under it); crossed splits get a second header
 * row. Every number opens the students behind it.
 */
export function StrengthTable({
    grid,
    onCell,
    totalLabel = "Total",
}: {
    grid: StrengthGrid;
    /** TAFSD-453: "Net" on Admissions and Withdrawals. */
    totalLabel?: string;
    onCell: (cell: { row?: StrengthRow; column?: StrengthColumn }) => void;
}) {
    const crossed = grid.columns.some((c) => c.group);
    // Runs of columns sharing a group, for the top header row.
    const groups: { label: string; span: number }[] = [];
    for (const c of grid.columns) {
        const last = groups[groups.length - 1];
        if (last && last.label === c.group) last.span++;
        else groups.push({ label: c.group ?? "", span: 1 });
    }

    const num = (n: number | undefined, onClick: () => void, strong = false) =>
        n ? (
            <button
                type="button"
                onClick={onClick}
                className={`tabular-nums hover:text-primary hover:underline underline-offset-2 ${strong ? "font-black" : "font-semibold"}`}
            >
                {n.toLocaleString()}
            </button>
        ) : (
            <span className="text-zinc-300 dark:text-zinc-700 tabular-nums">0</span>
        );

    const rowTone = (r: StrengthRow) =>
        r.level === "campus"
            ? "bg-zinc-100/80 dark:bg-zinc-800/60 font-black text-zinc-900 dark:text-zinc-50"
            : r.level === "class"
              ? "bg-white dark:bg-zinc-950 font-bold text-zinc-800 dark:text-zinc-200"
              : "bg-white dark:bg-zinc-950 font-medium text-zinc-600 dark:text-zinc-400";
    const indent = { campus: "pl-3", class: "pl-7", section: "pl-12" } as const;
    const th = "px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 whitespace-nowrap";
    const td = "px-3 py-2 text-[13px] text-right border-l border-zinc-100 dark:border-zinc-800";

    return (
        <div className="overflow-auto max-h-[70vh] rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
                    {crossed && (
                        <tr>
                            <th className={`${th} text-left sticky left-0 bg-zinc-50 dark:bg-zinc-900`} rowSpan={2} />
                            {groups.map((g, i) => (
                                <th key={i} colSpan={g.span} className={`${th} text-center border-l border-b border-zinc-200 dark:border-zinc-800`}>
                                    {g.label}
                                </th>
                            ))}
                            <th className={`${th} text-right border-l border-zinc-200 dark:border-zinc-800`} rowSpan={2}>
                                {totalLabel}
                            </th>
                        </tr>
                    )}
                    <tr>
                        {!crossed && <th className={`${th} text-left sticky left-0 bg-zinc-50 dark:bg-zinc-900`} />}
                        {grid.columns.map((c) => (
                            <th
                                key={c.key}
                                className={`${th} text-right border-l border-b border-zinc-200 dark:border-zinc-800 ${c.subtotal ? "text-zinc-700 dark:text-zinc-200" : ""}`}
                            >
                                {c.label}
                            </th>
                        ))}
                        {!crossed && (
                            <th className={`${th} text-right border-l border-b border-zinc-200 dark:border-zinc-800`}>
                                {grid.columns.length ? totalLabel : "Students"}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {grid.rows.map((r) => (
                        <tr key={r.key} className={rowTone(r)}>
                            <td className={`${indent[r.level]} pr-4 py-2 text-[13px] whitespace-nowrap sticky left-0 ${rowTone(r)} border-t border-zinc-100 dark:border-zinc-800`}>
                                {r.label}
                            </td>
                            {grid.columns.map((c) => (
                                <td key={c.key} className={`${td} border-t ${c.subtotal ? "bg-zinc-50/60 dark:bg-zinc-900/40" : ""}`}>
                                    {num(r.counts[c.key], () => onCell({ row: r, column: c }), c.subtotal)}
                                </td>
                            ))}
                            <td className={`${td} border-t bg-zinc-50/60 dark:bg-zinc-900/40`}>{num(r.total, () => onCell({ row: r }), true)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                    <tr>
                        <td className="pl-3 pr-4 py-2.5 text-[12px] font-black uppercase tracking-widest sticky left-0 bg-inherit">Total</td>
                        {grid.columns.map((c) => (
                            <td key={c.key} className="px-3 py-2.5 text-[13px] text-right font-black tabular-nums">
                                {num(grid.totals.counts[c.key], () => onCell({ column: c }), true)}
                            </td>
                        ))}
                        <td className="px-3 py-2.5 text-[13px] text-right font-black tabular-nums">
                            {num(grid.totals.total, () => onCell({}), true)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
