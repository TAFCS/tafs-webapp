"use client";

import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    CalendarCheck,
    CalendarX,
    Link2,
    Link2Off,
    Loader2,
    Lock,
    RotateCcw,
    ShieldAlert,
    Undo2,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
    zkPushService,
    DevicePersonType,
    MappingImpact,
    MappingMutationResult,
    PinCollision,
} from "@/lib/zk-push.service";
import { getDeviceName } from "@/lib/zk-devices";

/**
 * What the operator is about to do. A link needs the target person so the
 * preview can be computed against a mapping that doesn't exist yet; an unlink
 * only needs the PIN, because the mapping already says who owns it.
 */
export type MappingIntent =
    | {
          kind: "link";
          deviceSn: string;
          devicePin: string;
          personType: DevicePersonType;
          employeeId?: number;
          studentCc?: number;
          personName: string;
          /** "GR 5140 · Class JR-IV · Sec B" — who exactly, not just a name. */
          personDetail?: string;
          /** Reviving a deactivated mapping rather than creating a new one. */
          reactivating?: boolean;
      }
    | {
          kind: "unlink";
          deviceSn: string;
          devicePin: string;
          personName: string;
          /** "GR 5140 · Class JR-IV · Sec B" — who exactly, not just a name. */
          personDetail?: string;
          /** delete removes the mapping row; deactivate keeps it, disabled. */
          mode: "deactivate" | "delete";
      };

interface Props {
    intent: MappingIntent;
    onCancel: () => void;
    /** Runs the actual mutation. Throwing here surfaces the message in the dialog. */
    onConfirm: (opts: { acknowledgeCollisions: boolean }) => Promise<void>;
    /**
     * Context the backend collision check doesn't cover — e.g. "this student is
     * already mapped to two other PINs". Shown as advisory warnings.
     */
    extraNotes?: string[];
}

function StatLine({
    icon,
    children,
    tone = "neutral",
}: {
    icon: React.ReactNode;
    children: React.ReactNode;
    tone?: "neutral" | "positive" | "negative" | "muted";
}) {
    const toneCls =
        tone === "positive"
            ? "text-emerald-700 dark:text-emerald-400"
            : tone === "negative"
              ? "text-amber-700 dark:text-amber-400"
              : tone === "muted"
                ? "text-zinc-500 dark:text-zinc-400"
                : "text-zinc-700 dark:text-zinc-200";
    return (
        <li className={`flex items-start gap-2.5 text-sm ${toneCls}`}>
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{children}</span>
        </li>
    );
}

function n(value: number, singular: string, plural = `${singular}s`) {
    return `${value} ${value === 1 ? singular : plural}`;
}

export function MappingImpactDialog({ intent, onCancel, onConfirm, extraNotes = [] }: Props) {
    const [impact, setImpact] = useState<MappingImpact | null>(null);
    const [collisions, setCollisions] = useState<PinCollision[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isLink = intent.kind === "link";
    const blocking = collisions.filter((c) => c.severity === "BLOCK");
    const warnings = collisions.filter((c) => c.severity === "WARN");

    const loadPreview = useCallback(async () => {
        setLoading(true);
        setPreviewError(null);
        try {
            if (intent.kind === "link") {
                const [preview, found] = await Promise.all([
                    zkPushService.previewLink({
                        device_sn: intent.deviceSn,
                        device_pin: intent.devicePin,
                        person_type: intent.personType,
                        employee_id: intent.employeeId,
                        student_cc: intent.studentCc,
                    }),
                    zkPushService
                        .checkCollisions({
                            device_sn: intent.deviceSn,
                            device_pin: intent.devicePin,
                            person_type: intent.personType,
                            employee_id: intent.employeeId,
                            student_cc: intent.studentCc,
                        })
                        .catch(() => [] as PinCollision[]),
                ]);
                setImpact(preview);
                setCollisions(found);
            } else {
                setImpact(await zkPushService.previewUnlink(intent.deviceSn, intent.devicePin));
                setCollisions([]);
            }
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Could not work out what this change would do.";
            setPreviewError(message);
        } finally {
            setLoading(false);
        }
    }, [intent]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    async function handleConfirm() {
        setApplying(true);
        setError(null);
        try {
            await onConfirm({ acknowledgeCollisions: acknowledged });
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "The change could not be saved.";
            setError(message);
            setApplying(false);
        }
    }

    const nothingChanges =
        impact != null &&
        impact.scans_linked === 0 &&
        impact.scans_moved === 0 &&
        impact.scans_unlinked === 0 &&
        impact.days_appearing === 0 &&
        impact.days_recalculated === 0 &&
        impact.days_removed === 0;

    const confirmDisabled = applying || loading || (blocking.length > 0 && !acknowledged);

    const title = isLink
        ? `${intent.reactivating ? "Re-link" : "Link"} PIN ${intent.devicePin} to ${intent.personName}?`
        : intent.mode === "delete"
          ? `Delete the mapping for PIN ${intent.devicePin}?`
          : `Unlink PIN ${intent.devicePin} from ${intent.personName}?`;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-start gap-3">
                        <span
                            className={`mt-0.5 shrink-0 p-2 rounded-xl ${
                                isLink
                                    ? "bg-primary/10 text-primary"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                        >
                            {isLink ? <Link2 className="w-4 h-4" /> : <Link2Off className="w-4 h-4" />}
                        </span>
                        <div>
                            <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                                {title}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                                    {getDeviceName(intent.deviceSn)}
                                </span>{" "}
                                · PIN <span className="font-mono">{intent.devicePin}</span>
                            </p>
                            {intent.personDetail && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {/* The delete title is the only one that doesn't name the person. */}
                                    {intent.kind === "unlink" && intent.mode === "delete"
                                        ? `${intent.personName} — ${intent.personDetail}`
                                        : intent.personDetail}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={applying}
                        className="text-zinc-400 hover:text-zinc-600 p-1 disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Working out what this would change…
                        </div>
                    ) : previewError ? (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    {previewError} You can still continue, but the effect on existing
                                    attendance won&rsquo;t be shown first.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={loadPreview}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Try again
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                    What this changes
                                </p>
                                {nothingChanges ? (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        No stored attendance will change — this PIN has no scan history yet.
                                        {isLink ? " Future scans will be recorded against this person." : ""}
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {impact!.scans_linked > 0 && (
                                            <StatLine icon={<Link2 className="w-4 h-4" />} tone="positive">
                                                {n(impact!.scans_linked, "scan")} will be linked to{" "}
                                                <strong>{intent.personName}</strong>
                                            </StatLine>
                                        )}
                                        {impact!.scans_unlinked > 0 && (
                                            <StatLine icon={<Link2Off className="w-4 h-4" />} tone="negative">
                                                {n(impact!.scans_unlinked, "scan")} will be unlinked
                                            </StatLine>
                                        )}
                                        {impact!.scans_moved > 0 && (
                                            <StatLine icon={<ArrowRight className="w-4 h-4" />} tone="negative">
                                                {n(impact!.scans_moved, "scan")} will move away from someone else
                                            </StatLine>
                                        )}
                                        {impact!.days_appearing > 0 && (
                                            <StatLine icon={<CalendarCheck className="w-4 h-4" />} tone="positive">
                                                {n(impact!.days_appearing, "day")} of attendance will appear
                                            </StatLine>
                                        )}
                                        {impact!.days_recalculated > 0 && (
                                            <StatLine icon={<RotateCcw className="w-4 h-4" />}>
                                                {n(impact!.days_recalculated, "existing day")} will be recalculated
                                            </StatLine>
                                        )}
                                        {impact!.days_removed > 0 && (
                                            <StatLine icon={<CalendarX className="w-4 h-4" />} tone="negative">
                                                {n(impact!.days_removed, "day")} will stop showing
                                            </StatLine>
                                        )}
                                        {impact!.days_protected > 0 && (
                                            <StatLine icon={<Lock className="w-4 h-4" />} tone="muted">
                                                {n(impact!.days_protected, "day")} left untouched — marked manually
                                                or by the school calendar
                                            </StatLine>
                                        )}
                                    </ul>
                                )}
                            </div>

                            {impact!.affects_other_people.length > 0 && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>
                                        These scans currently belong to{" "}
                                        <strong>{impact!.affects_other_people.join(", ")}</strong>. Their attendance
                                        will change too — check that is what you intend.
                                    </span>
                                </div>
                            )}

                            {blocking.map((c, i) => (
                                <div
                                    key={`block-${i}`}
                                    className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm"
                                >
                                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{c.message}</span>
                                </div>
                            ))}

                            {[...warnings.map((c) => c.message), ...extraNotes].map((message, i) => (
                                <div
                                    key={`warn-${i}`}
                                    className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm"
                                >
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{message}</span>
                                </div>
                            ))}

                            {blocking.length > 0 && (
                                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={acknowledged}
                                        onChange={(e) => setAcknowledged(e.target.checked)}
                                        className="mt-0.5 rounded"
                                    />
                                    <span>
                                        I&rsquo;ve checked this PIN belongs to{" "}
                                        <strong>{intent.personName}</strong> and want to map it anyway.
                                    </span>
                                </label>
                            )}

                            {!nothingChanges && (
                                <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    <Undo2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        {isLink
                                            ? "Reversible — unlinking this PIN again releases these scans. The raw device logs are never deleted."
                                            : "Reversible — the scans are kept, and re-linking this PIN restores every day shown above."}
                                    </span>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                    <p className="text-[11px] text-zinc-400 leading-tight">
                        {applying ? "Rebuilding attendance — this can take a moment." : ""}
                    </p>
                    <div className="flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={applying}
                            className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={confirmDisabled}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-all active:scale-95 ${
                                isLink ? "bg-primary hover:opacity-90" : "bg-amber-600 hover:bg-amber-700"
                            }`}
                        >
                            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isLink
                                ? intent.reactivating
                                    ? "Re-link PIN"
                                    : "Link PIN"
                                : intent.mode === "delete"
                                  ? "Delete mapping"
                                  : "Unlink PIN"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * A PIN above the inline rebuild limit saves the mapping but leaves history
 * untouched — silent, and easy to miss in a toast that disappears. Surface it as
 * a sticky notice with the follow-up action attached.
 *
 * Returns true when a rebuild is still outstanding, so callers can skip their
 * own success toast.
 */
export function reportRebuildIfNeeded(result: MappingMutationResult, onDone: () => void): boolean {
    const res = result.resolution;
    if (!res?.needs_rebuild) return false;

    toast.custom(
        (t) => (
            <div className="max-w-md w-full bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-900/60 rounded-xl shadow-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Mapping saved — attendance not rebuilt yet
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        PIN {result.device_pin} has{" "}
                        {res.scan_count?.toLocaleString() ?? "too many"} scans, more than can be rebuilt
                        while you wait. Existing attendance still shows the old owner until you run this.
                    </p>
                    <div className="flex gap-3 pt-0.5">
                        <button
                            type="button"
                            onClick={async () => {
                                toast.dismiss(t.id);
                                const running = toast.loading("Rebuilding attendance…");
                                try {
                                    await zkPushService.rebuildPin(result.device_sn, result.device_pin);
                                    toast.success("Attendance rebuilt.", { id: running });
                                    onDone();
                                } catch {
                                    toast.error("Rebuild failed — try again from Scan Resolution.", {
                                        id: running,
                                    });
                                }
                            }}
                            className="text-xs font-bold text-primary hover:underline"
                        >
                            Rebuild now
                        </button>
                        <button
                            type="button"
                            onClick={() => toast.dismiss(t.id)}
                            className="text-xs font-semibold text-zinc-400 hover:text-zinc-600"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        ),
        { duration: Infinity },
    );
    return true;
}
