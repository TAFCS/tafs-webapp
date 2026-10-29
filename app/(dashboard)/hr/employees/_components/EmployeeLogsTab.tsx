"use client";

import { useEffect, useState } from "react";
import { auditLogsService, AuditLog } from "@/lib/audit-logs.service";
import { formatAuditActor } from "@/lib/audit-actor";
import {
  User,
  Clock,
  Wallet,
  Shield,
  Fingerprint,
  Search,
  Calendar,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CalendarCheck,
  FileText,
  KeyRound,
  Coins,
  History,
} from "lucide-react";

type CategoryKey = "all" | "Profile" | "Attendance" | "Payroll" | "Access" | "Device";

const CATEGORIES: Array<{ key: CategoryKey; label: string; icon: any; color: string; badge: string }> = [
  {
    key: "all",
    label: "All Logs",
    icon: History,
    color: "text-zinc-700 dark:text-zinc-300",
    badge: "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200",
  },
  {
    key: "Profile",
    label: "Profile",
    icon: User,
    color: "text-sky-700 dark:text-sky-300",
    badge: "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  },
  {
    key: "Attendance",
    label: "Attendance",
    icon: Clock,
    color: "text-amber-700 dark:text-amber-300",
    badge: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  },
  {
    key: "Payroll",
    label: "Payroll",
    icon: Wallet,
    color: "text-emerald-700 dark:text-emerald-300",
    badge: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "Access",
    label: "Access",
    icon: Shield,
    color: "text-purple-700 dark:text-purple-300",
    badge: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  },
  {
    key: "Device",
    label: "Device",
    icon: Fingerprint,
    color: "text-indigo-700 dark:text-indigo-300",
    badge: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  },
];

function getCategoryConfig(category?: string | null) {
  const match = CATEGORIES.find(
    (c) => c.key !== "all" && c.key.toLowerCase() === category?.toLowerCase(),
  );
  return (
    match || {
      key: "Profile" as const,
      label: category || "Profile",
      icon: User,
      color: "text-zinc-700 dark:text-zinc-300",
      badge: "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
    }
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function friendlyFieldName(field?: string | null) {
  if (!field) return "";
  const map: Record<string, string> = {
    monthly_pay: "Monthly Pay",
    reporting_time: "Reporting Time",
    leaving_time: "Leaving Time",
    late_relaxation_minutes: "Late Relaxation (mins)",
    check_in_source: "Check-in Source",
    working_days: "Working Days",
    campus_id: "Campus",
    department_id: "Department",
    job_title: "Job Title",
    employment_status: "Employment Status",
    employment_type: "Employment Type",
    join_date: "Joining Date",
    date_of_leaving: "Leaving Date",
    account_number: "Bank Account Number",
    bank_name: "Bank Name",
    payroll_enabled: "Payroll Enabled",
    eobi_exempt: "EOBI Exemption",
    sessi_exempt: "SESSI Exemption",
    password: "Password",
    password_hash: "Password",
    tiles: "System Tiles",
    scope: "Data Scope",
    is_active: "Active Status",
    shift_id: "Assigned Shift",
  };
  if (map[field]) return map[field];
  return field
    .replace(/^employee\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLogAction(log: AuditLog): string {
  if (log.action === "STATUS_CHANGED") {
    return `Status changed to ${log.new_value ?? ""}`;
  }
  if (log.action === "LOAN_CREATED") return "Loan Created";
  if (log.action === "LOAN_ADJUSTED") return "Loan Schedule Adjusted";
  if (log.action === "LOAN_DELETED") return "Loan Deleted";
  if (log.action === "SECURITY_DEPOSIT_COLLECTED") return "Security Deposit Collected";
  if (log.action === "SECURITY_DEPOSIT_RETURNED") return "Security Deposit Returned";
  if (log.action === "SALARY_INCREMENT") return "Salary Increment Applied";
  if (log.action === "LINE_UNFINALIZED") return "Payroll Line Un-finalized";
  if (log.action === "LINE_STATUTORY_WAIVERS") return "Statutory Waivers Adjusted";
  if (log.action === "OVERRIDE") return "Attendance Overridden";
  if (log.action === "PASSWORD_RESET") return "Password Reset";
  if (log.field) return `Updated ${friendlyFieldName(log.field)}`;
  return `${log.action.replace(/_/g, " ")} ${log.entity_type.replace(/_/g, " ")}`;
}

function LogDiff({ log }: { log: AuditLog }) {
  if (
    (!log.old_value && !log.new_value) ||
    log.action === "STATUS_CHANGED" ||
    log.field === "password" ||
    log.field === "password_hash"
  ) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-zinc-500">
      {log.old_value !== null && log.old_value !== "" ? (
        <span className="line-through text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-900/50">
          {log.old_value}
        </span>
      ) : (
        <span className="text-zinc-400 italic">None</span>
      )}
      <span className="text-zinc-300 dark:text-zinc-600">→</span>
      {log.new_value !== null && log.new_value !== "" ? (
        <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-semibold border border-emerald-100 dark:border-emerald-900/50">
          {log.new_value}
        </span>
      ) : (
        <span className="text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded font-semibold border border-rose-100 dark:border-rose-900/50">
          Removed
        </span>
      )}
    </div>
  );
}

function LogItem({ log, dense }: { log: AuditLog; dense?: boolean }) {
  const [open, setOpen] = useState(false);
  const cat = getCategoryConfig(log.category);
  const Icon = cat.icon;
  const childCount = log.child_count ?? log.children?.length ?? 0;

  return (
    <div
      className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700 ${
        dense ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${cat.badge}`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${cat.badge}`}
              >
                {cat.label}
              </span>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {formatLogAction(log)}
              </h4>
            </div>
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 shrink-0">
              {formatDate(log.changed_at)}
            </span>
          </div>

          <LogDiff log={log} />

          {log.note ? (
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
              “{log.note}”
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              by <span className="font-semibold text-zinc-600 dark:text-zinc-300">{formatAuditActor(log)}</span>
            </p>

            {childCount > 0 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {childCount} detail{childCount === 1 ? "" : "s"}
              </button>
            )}
          </div>

          {open && log.children && log.children.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
              {log.children.map((child) => (
                <LogItem key={child.id} log={child} dense />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmployeeLogsTab({ employeeId }: { employeeId: number }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [searchText, setSearchText] = useState("");
  const [queryText, setQueryText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setQueryText(searchText);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const query: Record<string, any> = {
      employee_id: employeeId,
      limit: LIMIT,
      offset,
    };

    if (category !== "all") {
      query.category = category;
    }
    if (queryText.trim()) {
      query.q = queryText.trim();
    }
    if (fromDate) {
      query.from = fromDate;
    }
    if (toDate) {
      query.to = toDate;
    }

    auditLogsService
      .list(query)
      .then((res) => {
        if (!active) return;
        setLogs(res.data || []);
        setTotal(res.total || 0);
      })
      .catch((err) => {
        console.error("Failed to load employee audit logs", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employeeId, category, queryText, fromDate, toDate, offset]);

  const hasFilters = category !== "all" || !!queryText.trim() || !!fromDate || !!toDate;

  const clearFilters = () => {
    setCategory("all");
    setSearchText("");
    setQueryText("");
    setFromDate("");
    setToDate("");
    setOffset(0);
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {CATEGORIES.map((cat) => {
          const isSelected = category === cat.key;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setCategory(cat.key);
                setOffset(0);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search and Date Range Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search logs (e.g. timings, pay, loan, check-in)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setOffset(0);
            }}
            className="px-2 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setOffset(0);
            }}
            className="px-2 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-zinc-400">Loading audit history…</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-3">
            <History className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No logs found</h4>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {hasFilters
              ? "No events match your current category or search filters. Try clearing filters."
              : "No logged events recorded for this employee yet. Timeline entries will appear after changes are made."}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-3.5 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Timeline ({total} {total === 1 ? "event" : "events"})
            </span>
          </div>

          <div className="space-y-2.5">
            {logs.map((log) => (
              <LogItem key={log.id} log={log} />
            ))}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between pt-3 px-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                className="px-3 py-1.5 text-xs font-bold text-primary rounded-xl hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Newer
              </button>
              <span className="text-xs font-medium text-zinc-400">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                type="button"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset((o) => o + LIMIT)}
                className="px-3 py-1.5 text-xs font-bold text-primary rounded-xl hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Older →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
