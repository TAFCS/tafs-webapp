"use client";

import { useEffect, useState, useCallback } from "react";
import { auditLogsService, AuditLog } from "@/lib/audit-logs.service";
import { getSectionColor, SECTION_LABELS, SECTION_COLORS } from "@/lib/log-colors";
import { ScrollText, Search, Calendar, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(date);
}

function friendlyField(field?: string | null) {
  if (!field) return "";
  return field.replace(/\w+\./g, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function ActionBadge({ action }: { action: string }) {
  const act = action.toUpperCase();
  let cls = "bg-zinc-50 text-zinc-600 border-zinc-200";
  if (act === "CREATED")       cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (act === "DELETED")       cls = "bg-rose-50 text-rose-700 border-rose-200";
  if (act === "UPDATED")       cls = "bg-amber-50 text-amber-700 border-amber-200";
  if (act === "STATUS_CHANGED") cls = "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (act === "REQUESTED")     cls = "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200";
  if (act === "APPROVED")      cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (act === "REJECTED")      cls = "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border tracking-wider ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

const BASE_SECTIONS = ["", "student", "finance", "communication", "hr", "attendance", "school-setup", "system"] as const;

export default function SystemLogsPage() {
  const { user } = useAuthState();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const SECTIONS = isSuperAdmin ? [...BASE_SECTIONS, "parent-requests"] : BASE_SECTIONS;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("");
  const [actorSearch, setActorSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditLogsService.list({
        section: activeSection || undefined,
        changed_by: actorSearch || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: LIMIT,
        offset,
      });
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [activeSection, actorSearch, dateFrom, dateTo, offset]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSectionChange = (s: string) => {
    setActiveSection(s);
    setOffset(0);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs();
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-600 border border-zinc-200 dark:border-zinc-700">
              <ScrollText className="h-7 w-7" />
            </div>
            Activity Logs
          </h1>
          <p className="text-zinc-500 mt-1 font-medium">Full audit trail across all modules.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="h-10 px-5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl font-bold text-sm flex items-center gap-2 transition-all bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map(s => {
          const isActive = activeSection === s;
          if (s === "") {
            return (
              <button
                key="all"
                onClick={() => handleSectionChange("")}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${isActive ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100" : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"}`}
              >
                All
              </button>
            );
          }
          const color = SECTION_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => handleSectionChange(s)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${isActive ? `${color.bg} ${color.text} ${color.border}` : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"}`}
            >
              {SECTION_LABELS[s] ?? s}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <form onSubmit={handleFilterSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Actor</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            <input
              type="text"
              placeholder="username"
              value={actorSearch}
              onChange={e => setActorSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-zinc-400 transition-all"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">From</label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 pl-7 pr-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-zinc-400 transition-all" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">To</label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 pl-7 pr-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-zinc-400 transition-all" />
          </div>
        </div>
        <button type="submit" className="h-9 px-4 bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all hover:bg-zinc-700">
          Apply
        </button>
        <button type="button" onClick={() => { setActorSearch(""); setDateFrom(""); setDateTo(""); setOffset(0); }} className="h-9 px-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 rounded-lg text-[11px] font-bold transition-all hover:bg-zinc-50">
          Clear
        </button>
      </form>

      {/* Log Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-4 border-zinc-100 border-t-zinc-600 rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading logs…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center">
            <ScrollText className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-500">No logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest w-4" />
                  <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Date & Time</th>
                  <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Actor</th>
                  <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Entity</th>
                  <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Action</th>
                  <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {logs.map(log => {
                  const sColor = getSectionColor(log.section);
                  return (
                    <tr key={log.id} className="group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="pl-1 py-3">
                        <div className={`w-1 h-6 rounded-full ${sColor.dot}`} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        {formatDate(log.changed_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">@{log.changed_by}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sColor.bg} ${sColor.text}`}>
                            {log.entity_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">#{log.entity_id}</span>
                          {log.student_id && (
                            <span className="text-[10px] font-mono text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1 rounded">CC {log.student_id}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 min-w-[320px]">
                        {log.note ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{log.note}</p>
                        ) : log.field ? (
                          <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <span className="font-semibold text-zinc-600 dark:text-zinc-400">{friendlyField(log.field)}:</span>
                            {log.old_value && <span className="line-through text-rose-400">{log.old_value}</span>}
                            <ArrowRight className="h-3 w-3 text-zinc-300 shrink-0" />
                            {log.new_value && <span className="text-emerald-600 dark:text-emerald-400">{log.new_value}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > LIMIT && (
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
            className="h-9 px-4 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Newer
          </button>
          <span className="text-xs font-semibold text-zinc-500">
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset(o => o + LIMIT)}
            className="h-9 px-4 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
