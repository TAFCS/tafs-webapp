"use client";

import { useState } from "react";
import { AlertCircle, BellRing, CheckCircle2, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatRs } from "../../_components/report-utils";
import type { LastNotified } from "./notify-defaulter-dialog";

export interface BulkNotifyStudent {
  cc: number;
  student_name: string;
  arrears_outstanding?: number;
  months_behind?: number;
  class_name?: string;
  section?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
}

const CONCURRENCY = 5;

export function BulkNotifyDefaultersDialog({
  students,
  asOfDate,
  onClose,
  onComplete,
}: {
  students: BulkNotifyStudent[];
  asOfDate: string;
  onClose: () => void;
  onComplete: (results: Record<number, LastNotified>) => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "sending" | "done">("confirm");
  const [completedCount, setCompletedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState<Array<{ cc: number; name: string; error: string }>>([]);
  const [results, setResults] = useState<Record<number, LastNotified>>({});

  const total = students.length;
  const totalArrears = students.reduce((acc, s) => acc + (s.arrears_outstanding ?? 0), 0);

  const startSending = async () => {
    setPhase("sending");
    setCompletedCount(0);
    setSuccessCount(0);
    setFailures([]);

    const localResults: Record<number, LastNotified> = {};
    const localFailures: Array<{ cc: number; name: string; error: string }> = [];
    let localSuccess = 0;
    let localCompleted = 0;

    let queueIndex = 0;

    const worker = async () => {
      while (queueIndex < students.length) {
        const item = students[queueIndex++];
        try {
          const { data } = await api.post(`/v1/financial-reports/defaulters/${item.cc}/notify`, {
            as_of_date: asOfDate,
          });
          localResults[item.cc] = {
            sent_at: data.data.sent_at,
            sent_by_name: data.data.sent_by_name,
            count: 1,
          };
          localSuccess++;
          setSuccessCount(localSuccess);
        } catch (err) {
          localFailures.push({
            cc: item.cc,
            name: item.student_name,
            error: errorMessage(err, "Failed to send notice."),
          });
          setFailures([...localFailures]);
        } finally {
          localCompleted++;
          setCompletedCount(localCompleted);
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, students.length) }, () => worker());
    await Promise.all(workers);

    setResults(localResults);
    setPhase("done");

    if (localSuccess > 0) {
      toast.success(`Sent notices to ${localSuccess} student ${localSuccess === 1 ? "family" : "families"}.`);
    }
    if (localFailures.length > 0) {
      toast.error(`${localFailures.length} notice${localFailures.length === 1 ? "" : "s"} failed to send.`);
    }
  };

  const handleFinish = () => {
    onComplete(results);
    onClose();
  };

  const progressPercent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm"
      onClick={() => phase !== "sending" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-notify-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in duration-150"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="bulk-notify-title" className="text-lg font-bold text-zinc-900 dark:text-white truncate">
              {phase === "done"
                ? "Notification Results"
                : phase === "sending"
                  ? `Sending Notices (${completedCount}/${total})`
                  : `Notify ${total} Selected ${total === 1 ? "Family" : "Families"}`}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Posts outstanding fee notices on the parent app notice board. Figures as of {asOfDate}.
            </p>
          </div>
          {phase !== "sending" && (
            <button
              onClick={phase === "done" ? handleFinish : onClose}
              aria-label="Close"
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {phase === "confirm" && (
            <>
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Students Selected
                  </span>
                  <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {total.toLocaleString()}
                  </span>
                </div>
                {totalArrears > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Total Outstanding
                    </span>
                    <span className="text-lg font-extrabold text-red-600 dark:text-red-400 tabular-nums">
                      {formatRs(totalArrears)}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-xs text-sky-800 dark:text-sky-300 space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-200">
                  <Send className="h-3.5 w-3.5" /> What happens when you send?
                </p>
                <p>
                  Each family will receive an individual in-app notice and push notification populated with their child&apos;s specific arrears and late payment surcharge.
                </p>
                <p className="text-[11px] text-sky-700/80 dark:text-sky-400/80">
                  Notices skip the super-admin review queue and deliver immediately to the parent app.
                </p>
              </div>

              {/* Quick preview list of first few students */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Students ({total})
                </span>
                <div className="max-h-36 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 text-xs">
                  {students.slice(0, 15).map((s) => (
                    <div key={s.cc} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {s.student_name} <span className="text-zinc-400 font-normal text-[11px]">(CC {s.cc})</span>
                      </span>
                      {s.arrears_outstanding != null && (
                        <span className="font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                          {formatRs(s.arrears_outstanding)}
                        </span>
                      )}
                    </div>
                  ))}
                  {students.length > 15 && (
                    <div className="px-2.5 py-1.5 text-[11px] text-zinc-400 text-center font-semibold">
                      +{students.length - 15} more students
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {phase === "sending" && (
            <div className="py-6 space-y-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">
                  Sending notifications...
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {completedCount} of {total} completed ({progressPercent}%)
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {successCount} sent
                </span>
                {failures.length > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {failures.length} failed
                  </span>
                )}
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  {successCount} of {total} notices delivered
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Parent app notice boards have been updated with outstanding fee figures.
                </p>
              </div>

              {failures.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
                    Failures ({failures.length})
                  </span>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-2 space-y-1 text-xs">
                    {failures.map((f) => (
                      <div key={f.cc} className="flex items-start justify-between gap-2 text-rose-800 dark:text-rose-300">
                        <span className="font-semibold truncate">{f.name} (CC {f.cc})</span>
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 shrink-0">{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5 bg-zinc-50/50 dark:bg-zinc-900/50">
          {phase === "confirm" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-10 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startSending}
                className="flex items-center gap-2 px-5 h-10 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                Notify All Selected ({total})
              </button>
            </>
          )}

          {phase === "sending" && (
            <p className="text-xs font-medium text-zinc-400 animate-pulse">
              Please wait while notifications are being dispatched...
            </p>
          )}

          {phase === "done" && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 h-10 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
