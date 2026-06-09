"use client";

import { useEffect, useState, useMemo } from "react";
import { auditLogsService, AuditLog } from "@/lib/audit-logs.service";
import {
  History,
  Search,
  Filter,
  User,
  Users,
  Home,
  FileText,
  Coins,
  Clock3,
  Calendar,
  Activity,
  ArrowRight,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { toast } from "react-hot-toast";

// Date formatting helper
function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// Icons based on entity type
function EntityIcon({ type }: { type: string }) {
  const t = type.toUpperCase();
  if (t === "STUDENT") return <User className="h-4 w-4 text-indigo-500" />;
  if (t === "GUARDIAN") return <Users className="h-4 w-4 text-amber-500" />;
  if (t === "FAMILY") return <Home className="h-4 w-4 text-purple-500" />;
  if (t === "VOUCHER") return <FileText className="h-4 w-4 text-blue-500" />;
  if (t === "DEPOSIT") return <Coins className="h-4 w-4 text-emerald-500" />;
  return <Clock3 className="h-4 w-4 text-zinc-400" />;
}

// Action badge renderer
function ActionBadge({ action }: { action: string }) {
  const act = action.toUpperCase();
  let classes = "bg-zinc-50 text-zinc-600 border-zinc-200";
  if (act === "CREATED") classes = "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (act === "DELETED") classes = "bg-rose-50 text-rose-700 border-rose-200";
  if (act === "STATUS_CHANGED") classes = "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (act === "UPDATED") classes = "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border tracking-wider ${classes}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

function friendlyField(field?: string | null) {
  if (!field) return "";
  return field
    .replace("student.", "")
    .replace("guardian.", "")
    .replace("identity.", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedEntity, setSelectedEntity] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [studentId, setStudentId] = useState("");

  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditLogsService.list({
        entity_type: selectedEntity || undefined,
        changed_by: actorSearch || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        student_id: studentId ? Number(studentId) : undefined,
        limit: LIMIT,
        offset,
      });
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch (error) {
      toast.error("Failed to load audit logs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, selectedEntity, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs();
  };

  const resetFilters = () => {
    setSelectedEntity("");
    setActorSearch("");
    setDateFrom("");
    setDateTo("");
    setStudentId("");
    setOffset(0);
  };

  // Derive metrics summaries
  const entityCountMap = useMemo(() => {
    const counts: Record<string, number> = { STUDENT: 0, GUARDIAN: 0, FAMILY: 0, VOUCHER: 0, DEPOSIT: 0 };
    logs.forEach(l => {
      const t = l.entity_type.toUpperCase();
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [logs]);

  return (
    <div className="pb-20 max-w-full">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100">
              <History className="h-7 w-7" />
            </div>
            System Audit Trail
          </h1>
          <p className="text-zinc-500 mt-2 font-medium">Verify system updates, billing changes, and configuration mutations.</p>
        </div>
        
        <button 
          onClick={fetchLogs}
          className="h-12 px-6 border border-zinc-200 hover:bg-zinc-50 rounded-2xl font-bold flex items-center gap-2.5 transition-all shadow-sm active:scale-95 bg-white text-zinc-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Stream
        </button>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Student Logs", value: entityCountMap.STUDENT, icon: User, color: "indigo", bg: "bg-indigo-50 border-indigo-100 text-indigo-600" },
          { label: "Guardian Logs", value: entityCountMap.GUARDIAN, icon: Users, color: "amber", bg: "bg-amber-50 border-amber-100 text-amber-600" },
          { label: "Family Logs", value: entityCountMap.FAMILY, icon: Home, color: "purple", bg: "bg-purple-50 border-purple-100 text-purple-600" },
          { label: "Voucher Logs", value: entityCountMap.VOUCHER, icon: FileText, color: "blue", bg: "bg-blue-50 border-blue-100 text-blue-600" },
          { label: "Deposit Logs", value: entityCountMap.DEPOSIT, icon: Coins, color: "emerald", bg: "bg-emerald-50 border-emerald-100 text-emerald-600" },
        ].map((s, i) => (
          <div key={i} className="p-4 bg-white border border-zinc-200 rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">{s.label}</p>
              <h4 className="text-xl font-black text-zinc-800 mt-2 leading-none">{s.value} <span className="text-xs text-zinc-400 font-medium">shown</span></h4>
            </div>
            <div className={`p-2 rounded-xl border ${s.bg}`}>
              <s.icon className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-white border border-zinc-200 rounded-[2rem] p-6 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Entity Type</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full h-11 bg-zinc-50 border border-zinc-200 rounded-xl px-3 text-xs font-bold focus:border-indigo-500 outline-none transition-all appearance-none"
            >
              <option value="">All Entities</option>
              <option value="STUDENT">Student</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="FAMILY">Family</option>
              <option value="VOUCHER">Voucher</option>
              <option value="DEPOSIT">Deposit</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Actor (changed_by)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="e.g. system-backfill"
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                className="w-full h-11 pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Student CC</label>
            <input
              type="number"
              placeholder="e.g. 5040"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-11 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-11 pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-11 pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetFilters}
            className="h-10 px-5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 rounded-xl font-bold text-xs transition-all active:scale-95"
          >
            Clear Filters
          </button>
          <button
            type="submit"
            className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-indigo-600/10 active:scale-95"
          >
            Filter Logs
          </button>
        </div>
      </form>

      {/* Main Logs Table */}
      <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-200/20">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
             <div className="h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
             <p className="text-zinc-500 font-bold animate-pulse">Loading system log streams...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center gap-4">
            <div className="p-6 bg-zinc-50 rounded-[2rem]">
              <History className="h-12 w-12 text-zinc-300" />
            </div>
            <div>
              <p className="text-lg font-bold text-zinc-800">No logs found</p>
              <p className="text-zinc-500 mt-1 font-medium">Try broadening your search query or filters.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-200">
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date & Time</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Actor</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Target Entity</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Action</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Details</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-zinc-50/50 transition-colors">
                    <td className="px-8 py-4 whitespace-nowrap text-xs font-semibold text-zinc-500">
                      {formatDate(log.changed_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-extrabold text-zinc-800">@{log.changed_by}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <EntityIcon type={log.entity_type} />
                        <span className="text-xs font-bold text-zinc-700">{log.entity_type}</span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">ID: {log.entity_id}</span>
                        {log.student_id && (
                          <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">CC: {log.student_id}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-6 py-4">
                      {log.action === "STATUS_CHANGED" ? (
                        <span className="text-xs text-zinc-500">
                          Status changed to <strong className="text-zinc-700">{log.new_value}</strong>
                        </span>
                      ) : log.field ? (
                        <div className="text-xs text-zinc-500">
                          <span className="font-extrabold text-zinc-700 block mb-0.5">{friendlyField(log.field)}</span>
                          <div className="flex items-center gap-1">
                            {log.old_value !== null && log.old_value !== "" ? (
                              <span className="line-through text-rose-400 bg-rose-50/50 px-1 rounded">{log.old_value}</span>
                            ) : (
                              <span className="text-zinc-300 italic">None</span>
                            )}
                            <ArrowRight className="h-3 w-3 text-zinc-300" />
                            {log.new_value !== null && log.new_value !== "" ? (
                              <span className="text-emerald-600 bg-emerald-50/50 px-1 rounded font-semibold">{log.new_value}</span>
                            ) : (
                              <span className="text-rose-400 bg-rose-50/50 px-1 rounded font-semibold">Removed</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">No field details</span>
                      )}
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-xs text-zinc-600 font-medium max-w-xs truncate" title={log.note || ""}>
                        {log.note || <span className="text-zinc-300">—</span>}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && total > LIMIT && (
        <div className="flex items-center justify-between mt-6 px-4">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="h-10 px-5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Newer Logs
          </button>
          <span className="text-xs font-bold text-zinc-500">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total} events
          </span>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="h-10 px-5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Older Logs →
          </button>
        </div>
      )}
    </div>
  );
}
