"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, Loader2, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

export type LastNotified = { sent_at: string; sent_by_name: string | null; count: number };

type Preview = {
  cc: number;
  student_name: string | null;
  as_of_date: string;
  title: string;
  body: string;
  disabled: boolean;
  previous: { sent_at: string; sent_by_name: string | null; arrears_outstanding: number }[];
};

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * TAFSD-384: shows the exact notice "Notify through app" will post to this
 * student's family (filled from the Notification Templates copy and the
 * report's own figures), then sends it.
 */
export function NotifyDefaulterDialog({
  cc,
  studentName,
  asOfDate,
  onClose,
  onSent,
}: {
  cc: number;
  studentName: string;
  asOfDate: string;
  onClose: () => void;
  onSent: (last: LastNotified) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/v1/financial-reports/defaulters/${cc}/notice-preview`, { params: { as_of_date: asOfDate } })
      .then(({ data }) => { if (!cancelled) setPreview(data.data); })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err, "Could not load the notice preview.")); });
    return () => { cancelled = true; };
  }, [cc, asOfDate]);

  const send = async () => {
    setSending(true);
    try {
      const { data } = await api.post(`/v1/financial-reports/defaulters/${cc}/notify`, { as_of_date: asOfDate });
      toast.success(`Notice sent to ${studentName}'s family.`);
      onSent({ sent_at: data.data.sent_at, sent_by_name: data.data.sent_by_name, count: (preview?.previous.length ?? 0) + 1 });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to send the notice."));
      setSending(false);
    }
  };

  const alreadySent = (preview?.previous.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm" onClick={() => !sending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notify-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <BellRing className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 id="notify-title" className="text-lg font-bold text-zinc-900 dark:text-white">Notify {studentName}&apos;s family</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Posts this notice on their notice board in the parent app, with a push notification. Figures as of {asOfDate}.
            </p>
          </div>
          <button onClick={onClose} disabled={sending} aria-label="Close" className="text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loadError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {loadError}
            </p>
          ) : !preview ? (
            <div className="py-10 flex items-center justify-center text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparing the notice…
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">What the family will see</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{preview.title}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-line">{preview.body}</p>
              </div>
              <Link
                href="/admin/notification-templates"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Pencil className="h-3 w-3" /> Change this wording on Notification Templates (Fee Defaulter Notice)
              </Link>

              {preview.disabled && (
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">
                  Fee defaulter notices are switched off on Notification Templates. Turn them on there to send.
                </p>
              )}

              {alreadySent && (
                <div className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Already notified {preview.previous.length === 5 ? "5+" : preview.previous.length} time(s)
                  </p>
                  {preview.previous.slice(0, 3).map((p) => (
                    <p key={p.sent_at} className="text-xs">
                      {formatWhen(p.sent_at)}{p.sent_by_name ? ` by ${p.sent_by_name}` : ""} · {`Rs. ${Math.round(p.arrears_outstanding).toLocaleString()}`} owed then
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !preview || preview.disabled}
            className="px-6 h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            {alreadySent ? "Send again" : "Send notice"}
          </button>
        </div>
      </div>
    </div>
  );
}
