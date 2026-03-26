"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/src/lib/api";
import { AppDispatch, RootState } from "@/src/store/store";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchSections } from "@/src/store/slices/sectionsSlice";

type PromotionResult = {
  student_id: number;
  status: "promoted" | "skipped" | "failed";
  reason_code?: string;
  message: string;
  from_class_id?: number | null;
  to_class_id?: number;
  from_academic_year?: string | null;
  to_academic_year?: string;
  dry_run: boolean;
};

type PromotionResponse = {
  summary: {
    total_requested: number;
    total_promoted: number;
    total_skipped: number;
    total_failed: number;
    dry_run: boolean;
  };
  results: PromotionResult[];
};

export default function BulkPromotePage() {
  const dispatch = useDispatch<AppDispatch>();

  const { items: classes, isLoading: classesLoading } = useSelector((state: RootState) => state.classes);
  const { items: campuses } = useSelector((state: RootState) => state.campuses);
  const { items: sections } = useSelector((state: RootState) => state.sections);

  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [toSectionId, setToSectionId] = useState("");
  const [studentIdsRaw, setStudentIdsRaw] = useState("");
  const [reason, setReason] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<PromotionResponse | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);

  useEffect(() => {
    if (!classes.length) {
      dispatch(fetchClasses());
    }
    if (!campuses.length) {
      dispatch(fetchCampuses());
    }
    if (!sections.length) {
      dispatch(fetchSections());
    }
  }, [dispatch, classes.length, campuses.length, sections.length]);

  const parsedStudentIds = useMemo(() => {
    return studentIdsRaw
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n > 0);
  }, [studentIdsRaw]);

  const invalidStudentIdTokens = useMemo(() => {
    return studentIdsRaw
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => !(Number.isInteger(Number(x)) && Number(x) > 0));
  }, [studentIdsRaw]);

  const handleSubmit = async () => {
    if (!fromClassId || !toClassId) {
      toast.error("Please select both From Class and To Class.");
      return;
    }

    if (fromClassId === toClassId) {
      toast.error("From Class and To Class must be different.");
      return;
    }

    if (invalidStudentIdTokens.length > 0) {
      toast.error("Student IDs contain invalid values.");
      return;
    }

    const payload: Record<string, unknown> = {
      from: { class_id: Number(fromClassId) },
      to: { class_id: Number(toClassId) },
      dry_run: dryRun,
    };

    if (campusId) payload.campus_id = Number(campusId);
    if (sectionId) payload.section_id = Number(sectionId);
    if (toSectionId) payload.to_section_id = Number(toSectionId);
    if (parsedStudentIds.length > 0) payload.student_ids = parsedStudentIds;
    if (reason.trim()) payload.reason = reason.trim();

    setIsSubmitting(true);
    setErrorLog(null);

    try {
      const { data } = await api.post("/v1/students/promotion/bulk", payload);
      const responseData = data?.data as PromotionResponse;
      setResponse(responseData);

      if (responseData?.summary?.total_failed > 0) {
        toast.error(`Completed with ${responseData.summary.total_failed} failed records.`);
      } else {
        toast.success(dryRun ? "Dry-run completed successfully." : "Bulk promotion completed successfully.");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown }; message?: string };
      const details = axiosErr?.response?.data || axiosErr?.message || "Unknown error";
      const printable = typeof details === "string" ? details : JSON.stringify(details, null, 2);
      setErrorLog(printable);
      toast.error("Failed to process bulk promotion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (!response?.results) return [];
    const rank: Record<PromotionResult["status"], number> = { failed: 0, skipped: 1, promoted: 2 };
    return [...response.results].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [response]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Bulk Promote</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Promote students in batch with filters, dry-run support, and full execution logs.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Promotion Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="from-class" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">From Class</label>
              <select
                id="from-class"
                title="From Class"
                value={fromClassId}
                onChange={(e) => setFromClassId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              >
                <option value="">Select from class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.description} ({cls.class_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="to-class" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">To Class</label>
              <select
                id="to-class"
                title="To Class"
                value={toClassId}
                onChange={(e) => setToClassId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              >
                <option value="">Select to class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.description} ({cls.class_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="campus-filter" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Campus Filter (optional)</label>
              <select
                id="campus-filter"
                title="Campus Filter"
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              >
                <option value="">All campuses</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.campus_name} ({campus.campus_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="current-section-filter" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Current Section Filter (optional)</label>
              <select
                id="current-section-filter"
                title="Current Section Filter"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              >
                <option value="">All current sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="target-section" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Target Section (optional)</label>
              <select
                id="target-section"
                title="Target Section"
                value={toSectionId}
                onChange={(e) => setToSectionId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              >
                <option value="">Keep existing section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="student-ids" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Student IDs (optional, comma or space separated)
            </label>
            <textarea
              id="student-ids"
              value={studentIdsRaw}
              onChange={(e) => setStudentIdsRaw(e.target.value)}
              placeholder="e.g. 1201, 1202 1203"
              rows={3}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
            />
            {invalidStudentIdTokens.length > 0 && (
              <p className="text-xs text-rose-500">
                Invalid tokens: {invalidStudentIdTokens.join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="promotion-reason" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Reason (optional)</label>
            <input
              id="promotion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Academic year transition"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Run as dry-run only (no DB updates)
            </label>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || classesLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {dryRun ? "Run Dry-Run" : "Execute Bulk Promotion"}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Execution Summary</h2>
          {!response ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No execution yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span>Total Requested</span><span className="font-semibold">{response.summary.total_requested}</span></div>
              <div className="flex items-center justify-between text-emerald-600"><span>Promoted</span><span className="font-semibold">{response.summary.total_promoted}</span></div>
              <div className="flex items-center justify-between text-amber-600"><span>Skipped</span><span className="font-semibold">{response.summary.total_skipped}</span></div>
              <div className="flex items-center justify-between text-rose-600"><span>Failed</span><span className="font-semibold">{response.summary.total_failed}</span></div>
              <div className="flex items-center justify-between"><span>Mode</span><span className="font-semibold">{response.summary.dry_run ? "Dry-run" : "Live"}</span></div>
            </div>
          )}

          {errorLog && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm font-semibold mb-2">
                <AlertCircle className="h-4 w-4" />
                API Error Log
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words text-rose-700 dark:text-rose-300 max-h-60 overflow-auto">{errorLog}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Detailed Logs</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Failed records are shown first</span>
        </div>

        {!response || sortedResults.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Run a promotion request to view per-student logs.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300">
                <tr>
                  <th className="text-left px-4 py-3">Student</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Reason Code</th>
                  <th className="text-left px-4 py-3">Message</th>
                  <th className="text-left px-4 py-3">Academic Year</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((item) => (
                  <tr key={`${item.student_id}-${item.status}-${item.reason_code || "ok"}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{item.student_id}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.status === "promoted"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "skipped"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.status === "promoted" && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {item.status === "skipped" && <Clock3 className="h-3.5 w-3.5" />}
                        {item.status === "failed" && <AlertCircle className="h-3.5 w-3.5" />}
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{item.reason_code || "-"}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{item.message}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {item.from_academic_year || "-"} {item.to_academic_year ? `-> ${item.to_academic_year}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
