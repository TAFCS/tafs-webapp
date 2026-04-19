"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  GraduationCap,
  RefreshCw,
  Send,
  RotateCcw,
  X,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/src/lib/api";
import { AppDispatch, RootState } from "@/src/store/store";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchSections } from "@/src/store/slices/sectionsSlice";

// ─── Types ────────────────────────────────────────────────────────────────────

type PromotionStatus = "promoted" | "graduated" | "expelled" | "left" | "skipped" | "failed";

type PromotionResult = {
  student_id: number;
  status: PromotionStatus;
  reason_code?: string;
  message: string;
  from_class_id?: number | null;
  to_class_id?: number | null;
  from_academic_year?: string | null;
  to_academic_year?: string;
  graduated?: boolean;
  expelled?: boolean;
  left?: boolean;
  dry_run: boolean;
};

type PromotionSummary = {
  total_requested: number;
  total_promoted: number;
  total_promoted_only?: number;
  total_graduated?: number;
  total_expelled?: number;
  total_left?: number;
  total_skipped: number;
  total_failed: number;
  dry_run: boolean;
  mode?: "promotion" | "graduation" | "expulsion" | "leaving";
};

type PromotionResponse = {
  summary: PromotionSummary;
  results: PromotionResult[];
};

/** Resolved student info from search-simple */
type ResolvedStudent = {
  cc: number;
  full_name: string;
  gr_number?: string | null;
};

/** Student info from GET /v1/students for the preview panel */
type PreviewStudent = {
  cc: number;
  student_full_name: string;
  gr_number?: string | null;
  class_id?: number | null;
  campus?: string | null;
  core?: {
    class_description?: string;
    section_description?: string;
    campus_name?: string;
    enrollment_status?: string;
  };
};

const GRADUATE_SENTINEL = "__GRADUATE__";
const EXPEL_SENTINEL = "__EXPEL__";
const LEFT_SENTINEL = "__LEFT__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveClassOrder(code: string, description: string): number {
  // Concatenate code + description so "PN"+"Pre Nursery" → "pn pre nursery" → hits 'nursery'
  const label = (code + " " + description).toLowerCase().replace(/[^a-z0-9 ]/g, "");
  if (label.includes("playgroup")) return -3;
  if (label.includes("nursery") || label.includes("nur ")) return -2;
  if (label.includes("prep") || label.includes("kindergarten")) return -1;
  if (/\bkg\b/.test(label)) return -1;
  const numeric = (code + " " + description).match(/\d+/);
  if (numeric) return parseInt(numeric[0], 10);
  return 999;
}

function generateAcademicYears(): string[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => `${y - 2 + i}-${y - 1 + i}`);
}

function resolveClassName(id: number | null | undefined, map: Map<number, string>): string {
  if (id == null) return "—";
  return map.get(id) ?? `Class #${id}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkPromotePage() {
  const dispatch = useDispatch<AppDispatch>();

  const { items: classes, isLoading: classesLoading } = useSelector(
    (state: RootState) => state.classes
  );
  const { items: campuses } = useSelector((state: RootState) => state.campuses);
  const { items: sections } = useSelector((state: RootState) => state.sections);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [toSectionId, setToSectionId] = useState("");
  const [studentIdsRaw, setStudentIdsRaw] = useState("");
  const [reason, setReason] = useState("");
  const [sourceAcademicYear, setSourceAcademicYear] = useState(""); // filter: students currently in this year
  const [targetAcademicYear, setTargetAcademicYear] = useState(""); // override: destination year
  const [dryRun, setDryRun] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<PromotionResponse | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Student ID resolution state ─────────────────────────────────────────────
  const [resolvedIds, setResolvedIds] = useState<
    Map<number, ResolvedStudent | "not_found" | "loading">
  >(new Map());
  const [isResolvingIds, setIsResolvingIds] = useState(false);
  const resolveAbortRef = useRef<AbortController | null>(null);
  const resolveDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Preview panel state ─────────────────────────────────────────────────────
  const [previewStudents, setPreviewStudents] = useState<PreviewStudent[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!classes.length) dispatch(fetchClasses());
    if (!campuses.length) dispatch(fetchCampuses());
    if (!sections.length) dispatch(fetchSections());
  }, [dispatch, classes.length, campuses.length, sections.length]);

  // ── Sorted classes ──────────────────────────────────────────────────────────
  const sortedClasses = useMemo(() => {
    return [...classes]
      .map((cls) => ({
        ...cls,
        class_order:
          (cls as unknown as { class_order?: number }).class_order ??
          deriveClassOrder(cls.class_code, cls.description),
      }))
      .sort((a, b) => a.class_order - b.class_order);
  }, [classes]);


  const classMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const cls of classes) m.set(cls.id, `${cls.description} (${cls.class_code})`);
    return m;
  }, [classes]);

  // ── Parsed IDs ──────────────────────────────────────────────────────────────
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

  const isGraduating = toClassId === GRADUATE_SENTINEL;
  const isExpelling = toClassId === EXPEL_SENTINEL;
  const isLeaving = toClassId === LEFT_SENTINEL;
  const academicYears = useMemo(() => generateAcademicYears(), []);

  // ── Live student ID resolution via search-simple ────────────────────────────
  useEffect(() => {
    // Cancel previous debouncer
    if (resolveDebouncerRef.current) clearTimeout(resolveDebouncerRef.current);

    if (parsedStudentIds.length === 0) {
      setResolvedIds(new Map());
      setIsResolvingIds(false);
      return;
    }

    // Mark all as loading optimistically
    setIsResolvingIds(true);
    const loadingMap = new Map<number, "loading">(parsedStudentIds.map((id) => [id, "loading"]));
    setResolvedIds(loadingMap as Map<number, ResolvedStudent | "not_found" | "loading">);

    resolveDebouncerRef.current = setTimeout(async () => {
      // Cancel any in-flight abort controller
      if (resolveAbortRef.current) resolveAbortRef.current.abort();
      const ctrl = new AbortController();
      resolveAbortRef.current = ctrl;

      // Fetch all IDs in parallel
      const results = await Promise.allSettled(
        parsedStudentIds.map((id) =>
          api
            .get<{ data: { cc: number; full_name: string; gr_number?: string | null }[] }>(
              `/v1/students/search-simple`,
              { params: { q: String(id) }, signal: ctrl.signal }
            )
            .then((res) => {
              const match = res.data?.data?.find?.((s: { cc: number }) => s.cc === id);
              return { id, student: match ?? null };
            })
            .catch(() => ({ id, student: null }))
        )
      );

      if (ctrl.signal.aborted) return;

      const newMap = new Map<number, ResolvedStudent | "not_found" | "loading">();
      for (const res of results) {
        if (res.status === "fulfilled") {
          const { id, student } = res.value;
          newMap.set(id, student ? { cc: student.cc, full_name: student.full_name, gr_number: student.gr_number } : "not_found");
        }
      }
      setResolvedIds(newMap);
      setIsResolvingIds(false);
    }, 600);

    return () => {
      if (resolveDebouncerRef.current) clearTimeout(resolveDebouncerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIdsRaw]);

  // ── Preview: load students matching current filters ─────────────────────────
  const loadPreview = useCallback(async () => {
    if (!fromClassId) {
      toast.error("Select a From Class first.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewStudents(null);
    setPreviewExpanded(true);

    try {
      const params: Record<string, unknown> = {
        class_id: Number(fromClassId),
        limit: 500,
        fields: "core",
      };
      if (campusId) params.campus_id = Number(campusId);
      if (sectionId) params.section_id = Number(sectionId);

      const { data } = await api.get("/v1/students", { params });
      const items: PreviewStudent[] = data?.data?.items ?? [];

      // If specific IDs are given, filter to only those
      const filtered =
        parsedStudentIds.length > 0
          ? items.filter((s) => parsedStudentIds.includes(s.cc))
          : items;

      setPreviewStudents(filtered);
    } catch {
      setPreviewError("Failed to load student preview. Check filters and try again.");
    } finally {
      setPreviewLoading(false);
    }
  }, [fromClassId, campusId, sectionId, parsedStudentIds]);

  // Auto-clear preview when key filters change
  useEffect(() => {
    setPreviewStudents(null);
    setPreviewError(null);
  }, [fromClassId, campusId, sectionId]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFromClassChange = useCallback((val: string) => {
    setFromClassId(val);
    setToClassId("");
    setPreviewStudents(null);
  }, []);

  const handleReset = useCallback(() => {
    setFromClassId("");
    setToClassId("");
    setCampusId("");
    setSectionId("");
    setToSectionId("");
    setStudentIdsRaw("");
    setReason("");
    setTargetAcademicYear("");
    setDryRun(true);
    setResponse(null);
    setErrorLog(null);
    setResolvedIds(new Map());
    setPreviewStudents(null);
    setPreviewError(null);
    setSourceAcademicYear("");
  }, []);

  const validateForm = (): boolean => {
    if (!fromClassId) { toast.error("Select a From Class."); return false; }
    if (!toClassId) { toast.error("Select a To Class or choose Graduate."); return false; }
    if (!isGraduating && fromClassId === toClassId) { toast.error("From and To Class must differ."); return false; }
    if (invalidStudentIdTokens.length > 0) { toast.error(`Invalid tokens: ${invalidStudentIdTokens.join(", ")}`); return false; }
    // Warn if any entered IDs were not found but don't block
    const notFound = parsedStudentIds.filter((id) => resolvedIds.get(id) === "not_found");
    if (notFound.length > 0 && parsedStudentIds.length > 0) {
      toast(`Warning: ${notFound.length} CC(s) not found in system: ${notFound.slice(0, 5).join(", ")}`, { icon: "⚠️" });
    }
    return true;
  };

  const handleSubmitRequest = () => {
    if (!validateForm()) return;
    if (!dryRun) {
      setShowConfirm(true);
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorLog(null);

    const payload: Record<string, unknown> = {
      from: { class_id: Number(fromClassId) },
      dry_run: dryRun,
    };
    if (isGraduating) {
      payload.graduate = true;
    } else if (isExpelling) {
      payload.expel = true;
    } else if (isLeaving) {
      payload.left = true;
    } else {
      payload.to = { class_id: Number(toClassId) };
    }
    if (campusId) payload.campus_id = Number(campusId);
    if (sectionId) payload.section_id = Number(sectionId);
    if (!isGraduating && toSectionId) payload.to_section_id = Number(toSectionId);
    if (parsedStudentIds.length > 0) payload.student_ids = parsedStudentIds;
    if (reason.trim()) payload.reason = reason.trim();
    if (sourceAcademicYear) payload.academic_year = sourceAcademicYear;   // source filter
    if (targetAcademicYear) payload.target_academic_year = targetAcademicYear; // destination override

    try {
      const { data } = await api.post("/v1/students/promotion/bulk", payload);
      const responseData = data?.data as PromotionResponse;
      setResponse(responseData);
      const { total_failed, total_promoted, total_graduated = 0, total_expelled = 0, total_left = 0, dry_run: isDry } = responseData?.summary ?? {};
      if (total_failed > 0) toast.error(`Completed with ${total_failed} failed record(s).`);
      else if (isDry) toast.success("Dry-run complete. No changes saved.");
      else if (total_graduated > 0) toast.success(`${total_graduated} student(s) graduated.`);
      else if (total_expelled > 0) toast.success(`${total_expelled} student(s) expelled.`);
      else if (total_left > 0) toast.success(`${total_left} student(s) marked as left.`);
      else toast.success(`${total_promoted} student(s) promoted.`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string };
      const details = e?.response?.data || e?.message || "Unknown error";
      setErrorLog(typeof details === "string" ? details : JSON.stringify(details, null, 2));
      toast.error("Failed to process bulk promotion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (!response?.results) return [];
    const rank: Record<PromotionStatus, number> = { failed: 0, skipped: 1, promoted: 2, graduated: 3, expelled: 4, left: 5 };
    return [...response.results].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [response]);

  const fromClassName = sortedClasses.find((c) => String(c.id) === fromClassId)?.description ?? "";
  const toClassName = isGraduating ? "Graduate" : isExpelling ? "Expel" : isLeaving ? "Left" : (sortedClasses.find((c) => String(c.id) === toClassId)?.description ?? "");

  // How many students will be targeted (for confirmation modal)
  const targetCount = previewStudents?.length ?? parsedStudentIds.length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Academic Actions Hub
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Execute batch promotions, graduations, or student removals (expulsions) with a safety-first preview.
          </p>
        </div>
        {(response || errorLog) && (
          <button type="button" onClick={handleReset}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Configuration Panel ────────────────────────────────────────── */}
        <div className="xl:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Promotion Configuration</h2>

          {/* From / To row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="from-class" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                From Class <span className="text-rose-500">*</span>
              </label>
              <select id="from-class" value={fromClassId} onChange={(e) => handleFromClassChange(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">Select source class</option>
                {sortedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.description} ({cls.class_code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="to-class" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                To Class / Action <span className="text-rose-500">*</span>
              </label>
              <select id="to-class" value={toClassId} onChange={(e) => setToClassId(e.target.value)}
                disabled={!fromClassId}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">{fromClassId ? "Select target or action" : "Select From Class first"}</option>
                <option value={GRADUATE_SENTINEL}>🎓 Graduate Students</option>
                <option value={EXPEL_SENTINEL}>🚫 Expel Students</option>
                <option value={LEFT_SENTINEL}>🚪 Left Students</option>
                {sortedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.description} ({cls.class_code})</option>
                ))}
              </select>
              {isGraduating && (
                <div className="flex items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-2.5 py-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                  <p className="text-xs text-violet-700 dark:text-violet-300 font-medium">
                    Status → GRADUATED, class_id → null.
                  </p>
                </div>
              )}
              {isExpelling && (
                <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-2.5 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                    Status → EXPELLED. All data (class, section, records) is preserved.
                  </p>
                </div>
              )}
              {isLeaving && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
                  <LogOut className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Status → LEFT. All data (class, section, records) is preserved.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Filters row */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label htmlFor="source-academic-year" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Source Year
              </label>
              <select id="source-academic-year" value={sourceAcademicYear} onChange={(e) => setSourceAcademicYear(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">All years</option>
                {academicYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              <p className="text-[10px] text-zinc-400">Filter students by their current year.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="target-academic-year" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Target Year</label>
              <select id="target-academic-year" value={targetAcademicYear} onChange={(e) => setTargetAcademicYear(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">Auto-increment</option>
                {academicYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              <p className="text-[10px] text-zinc-400">Override destination year.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="campus-filter" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Campus Filter</label>
              <select id="campus-filter" value={campusId} onChange={(e) => setCampusId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">All campuses</option>
                {campuses.map((c) => <option key={c.id} value={c.id}>{c.campus_name} ({c.campus_code})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="section-filter" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Section Filter</label>
              <select id="section-filter" value={sectionId} onChange={(e) => setSectionId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">All sections</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.description}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="target-section" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Target Section</label>
              <select id="target-section" value={toSectionId} onChange={(e) => setToSectionId(e.target.value)}
                disabled={isGraduating}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed">
                <option value="">Keep existing section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.description}</option>)}
              </select>
            </div>
          </div>

          {/* CC field with live resolution */}
          <div className="space-y-3">
            <label htmlFor="student-ids" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Specific CC Numbers{" "}
              <span className="text-zinc-400 font-normal">(optional — leave blank to target ALL students in the From Class)</span>
            </label>
            <textarea
              id="student-ids"
              value={studentIdsRaw}
              onChange={(e) => setStudentIdsRaw(e.target.value)}
              placeholder="e.g. 1201, 1202 1203"
              rows={2}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-mono"
            />

            {/* Invalid token error */}
            {invalidStudentIdTokens.length > 0 && (
              <p className="text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />Invalid tokens: {invalidStudentIdTokens.join(", ")}
              </p>
            )}

            {/* Live resolution cards */}
            {parsedStudentIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {isResolvingIds ? (
                    <><RefreshCw className="h-3 w-3 animate-spin" /> Resolving students…</>
                  ) : (
                    <><Search className="h-3 w-3" /> {parsedStudentIds.length} CC(s) entered — results below:</>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {parsedStudentIds.map((id) => {
                    const state = resolvedIds.get(id);
                    return (
                      <StudentIdCard key={id} id={id} state={state} classMap={classMap} />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label htmlFor="promotion-reason" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Reason (optional)</label>
            <input id="promotion-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual academic year transition"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <label className="inline-flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input type="checkbox" id="dry-run" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-primary" />
              <span>Dry-run <span className="text-xs text-zinc-400">(validate only, no DB writes)</span></span>
            </label>
            <div className="flex items-center gap-2">
              {/* Preview button */}
              {fromClassId && (
                <button type="button" id="preview-students-btn" onClick={loadPreview} disabled={previewLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                  {previewLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Preview Students
                </button>
              )}
              {/* Submit button */}
              <button type="button" id="bulk-promote-submit" onClick={handleSubmitRequest}
                disabled={isSubmitting || classesLoading}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${
                  isGraduating ? "bg-violet-600 hover:bg-violet-700" : isExpelling ? "bg-orange-600 hover:bg-orange-700" : isLeaving ? "bg-amber-600 hover:bg-amber-700" : "bg-primary hover:bg-primary/90"
                }`}>
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : isGraduating ? <GraduationCap className="h-4 w-4" /> : isExpelling ? <X className="h-4 w-4" /> : isLeaving ? <LogOut className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {dryRun ? "Run Dry-Run" : isGraduating ? "Graduate Students" : isExpelling ? "Expel Students" : isLeaving ? "Mark as Left" : "Execute Promotion"}
              </button>
            </div>
          </div>

          {!dryRun && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Live mode.</strong> Changes will be permanently saved to the database. Use dry-run first to verify.
              </p>
            </div>
          )}
        </div>

        {/* ── Summary Panel ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Execution Summary</h2>
          {!response ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No execution yet. Run a dry-run or live promotion.</p>
          ) : (
            <SummaryPanel summary={response.summary} />
          )}
          {errorLog && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 p-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm font-semibold mb-2">
                <AlertCircle className="h-4 w-4" />API Error
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words text-rose-700 dark:text-rose-300 max-h-60 overflow-auto">{errorLog}</pre>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview Panel ──────────────────────────────────────────────────── */}
      {(previewStudents !== null || previewLoading || previewError) && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPreviewExpanded((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-zinc-500" />
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Students to be {isGraduating ? "Graduated" : "Promoted"}
              </span>
              {previewStudents !== null && (
                <span className="ml-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {previewStudents.length}
                </span>
              )}
            </div>
            {previewExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
          </button>

          {previewExpanded && (
            <div className="border-t border-zinc-100 dark:border-zinc-800">
              {previewLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading students…
                </div>
              )}
              {previewError && (
                <div className="px-6 py-4 text-sm text-rose-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />{previewError}
                </div>
              )}
              {previewStudents !== null && !previewLoading && (
                previewStudents.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-zinc-400">
                    No students found matching the current filters.
                  </div>
                ) : (
                  <div className="overflow-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-500 dark:text-zinc-400 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">CC / ID</th>
                          <th className="text-left px-4 py-3 font-medium">Full Name</th>
                          <th className="text-left px-4 py-3 font-medium">GR Number</th>
                          <th className="text-left px-4 py-3 font-medium">Current Class</th>
                          <th className="text-left px-4 py-3 font-medium">Section</th>
                          <th className="text-left px-4 py-3 font-medium">Campus</th>
                          <th className="text-left px-4 py-3 font-medium">→ Destination</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewStudents.map((s) => (
                          <tr key={s.cc} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-zinc-800 dark:text-zinc-200">{s.cc}</td>
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{s.student_full_name ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{s.gr_number ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              {s.core?.class_description ?? resolveClassName(s.class_id, classMap)}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.core?.section_description ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.core?.campus_name ?? s.campus ?? "—"}</td>
                            <td className="px-4 py-3">
                              {isGraduating ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                                  <GraduationCap className="h-3.5 w-3.5" />Graduate
                                </span>
                              ) : toClassId ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {resolveClassName(Number(toClassId), classMap)}
                                </span>
                              ) : (
                                <span className="text-zinc-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Results Table ──────────────────────────────────────────────────── */}
      {response && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Execution Logs</h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Failed records shown first</span>
          </div>
          {sortedResults.length === 0 ? (
            <div className="p-6 text-sm text-zinc-400">No results returned.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">CC</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Reason</th>
                    <th className="text-left px-4 py-3 font-medium">From Class</th>
                    <th className="text-left px-4 py-3 font-medium">To Class</th>
                    <th className="text-left px-4 py-3 font-medium">Academic Year</th>
                    <th className="text-left px-4 py-3 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((item) => (
                    <tr key={`${item.student_id}-${item.status}-${item.reason_code ?? "ok"}`}
                      className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900 dark:text-zinc-100">{item.student_id}</td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{item.reason_code ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{resolveClassName(item.from_class_id, classMap)}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {item.graduated
                          ? <span className="inline-flex items-center gap-1 text-violet-600"><GraduationCap className="h-3.5 w-3.5" />Graduated</span>
                          : item.status === "expelled"
                          ? <span className="inline-flex items-center gap-1 text-orange-600"><X className="h-3.5 w-3.5" />Expelled (data kept)</span>
                          : item.status === "left"
                          ? <span className="inline-flex items-center gap-1 text-amber-600"><LogOut className="h-3.5 w-3.5" />Left (data kept)</span>
                          : resolveClassName(item.to_class_id, classMap)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-500">
                        {item.from_academic_year ?? "—"}{item.to_academic_year ? ` → ${item.to_academic_year}` : ""}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs text-xs">{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      {showConfirm && (
        <ConfirmationModal
          isGraduating={isGraduating}
          isExpelling={isExpelling}
          isLeaving={isLeaving}
          fromClassName={fromClassName}
          toClassName={toClassName}
          previewStudents={previewStudents}
          specificIds={parsedStudentIds}
          targetCount={targetCount}
          onConfirm={executeSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── StudentIdCard ─────────────────────────────────────────────────────────────

function StudentIdCard({
  id,
  state,
  classMap,
}: {
  id: number;
  state: ResolvedStudent | "not_found" | "loading" | undefined;
  classMap: Map<number, string>;
}) {
  if (state === "loading" || state === undefined) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-400 animate-pulse">
        <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span className="font-mono font-semibold text-zinc-500">#{id}</span>
        <span>Looking up…</span>
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-xs">
        <UserX className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        <span className="font-mono font-semibold text-rose-700 dark:text-rose-300">#{id}</span>
        <span className="text-rose-600 dark:text-rose-400">Not found in system</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs">
      <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">#{state.cc}</span>
      <span className="text-zinc-700 dark:text-zinc-300 truncate font-medium">{state.full_name}</span>
      {state.gr_number && (
        <span className="text-zinc-400 shrink-0">{state.gr_number}</span>
      )}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PromotionStatus }) {
  const cfg: Record<PromotionStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    promoted: { label: "Promoted", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    graduated: { label: "Graduated", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", icon: <GraduationCap className="h-3.5 w-3.5" /> },
    expelled: { label: "Expelled", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: <X className="h-3.5 w-3.5" /> },
    left: { label: "Left", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <LogOut className="h-3.5 w-3.5" /> },
    skipped: { label: "Skipped", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400", icon: <Clock3 className="h-3.5 w-3.5" /> },
    failed: { label: "Failed", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  };
  const { label, cls, icon } = cfg[status] ?? cfg.failed;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {icon}{label}
    </span>
  );
}

// ─── SummaryPanel ─────────────────────────────────────────────────────────────

function SummaryPanel({ summary }: { summary: PromotionSummary }) {
  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between"><span className="text-zinc-500">Mode</span><span className="font-semibold capitalize">{summary.mode ?? "promotion"}</span></div>
      <div className="flex justify-between"><span className="text-zinc-500">Total</span><span className="font-semibold">{summary.total_requested}</span></div>
      {(summary.total_graduated ?? 0) > 0 && (
        <div className="flex justify-between text-violet-600"><span>Graduated</span><span className="font-semibold">{summary.total_graduated}</span></div>
      )}
      {(summary.total_expelled ?? 0) > 0 && (
        <div className="flex justify-between text-orange-600"><span>Expelled</span><span className="font-semibold">{summary.total_expelled}</span></div>
      )}
      {(summary.total_left ?? 0) > 0 && (
        <div className="flex justify-between text-amber-600"><span>Left</span><span className="font-semibold">{summary.total_left}</span></div>
      )}
      <div className="flex justify-between text-emerald-600">
        <span>Promoted</span>
        <span className="font-semibold">{summary.total_promoted_only ?? summary.total_promoted}</span>
      </div>
      <div className="flex justify-between text-amber-600"><span>Skipped</span><span className="font-semibold">{summary.total_skipped}</span></div>
      <div className="flex justify-between text-rose-600"><span>Failed</span><span className="font-semibold">{summary.total_failed}</span></div>
      <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2">
        <span className="text-zinc-500">Mode</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${summary.dry_run ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500" : "bg-emerald-100 text-emerald-700"}`}>
          {summary.dry_run ? "Dry-run" : "Live"}
        </span>
      </div>
    </div>
  );
}

// ─── ConfirmationModal ────────────────────────────────────────────────────────

function ConfirmationModal({
  isGraduating,
  isExpelling,
  isLeaving,
  fromClassName,
  toClassName,
  previewStudents,
  specificIds,
  targetCount,
  onConfirm,
  onCancel,
}: {
  isGraduating: boolean;
  isExpelling: boolean;
  isLeaving: boolean;
  fromClassName: string;
  toClassName: string;
  previewStudents: PreviewStudent[] | null;
  specificIds: number[];
  targetCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Show up to 5 preview names in the modal
  const previewNames = previewStudents?.slice(0, 5) ?? [];
  const overflow = (previewStudents?.length ?? 0) - previewNames.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 ${
          isGraduating ? "bg-violet-50 dark:bg-violet-900/20" :
          isExpelling  ? "bg-orange-50 dark:bg-orange-900/20" :
          isLeaving    ? "bg-amber-50 dark:bg-amber-900/20" :
                         "bg-primary/10"
        }`}>
          <div className="flex items-center gap-2">
            {isGraduating ? <GraduationCap className="h-5 w-5 text-violet-600" /> : isExpelling ? <AlertCircle className="h-5 w-5 text-orange-600" /> : isLeaving ? <LogOut className="h-5 w-5 text-amber-600" /> : <AlertCircle className="h-5 w-5 text-primary" />}
            <h3 className={`text-base font-semibold ${
              isGraduating ? "text-violet-900 dark:text-violet-100" :
              isExpelling  ? "text-orange-900 dark:text-orange-100" :
              isLeaving    ? "text-amber-900 dark:text-amber-100" :
                             "text-primary"
            }`}>
              Confirm {isGraduating ? "Graduation" : isExpelling ? "Expulsion" : isLeaving ? "Leaving" : "Bulk Promotion"}
            </h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close">
            <X className="h-4 w-4 text-zinc-400 hover:text-zinc-600" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            You are about to run a <strong>live {isGraduating ? "graduation" : isExpelling ? "expulsion" : isLeaving ? "leaving" : "promotion"}</strong>. This will permanently write changes to the database.
          </p>

          {/* Summary card */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">From</span><span className="font-medium">{fromClassName || "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Action</span><span className="font-medium">{toClassName || "—"}</span></div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Scope</span>
              <span className="font-medium">
                {specificIds.length > 0 ? `${specificIds.length} specific CC(s)` : `All in class (${targetCount || "unknown"} found)`}
              </span>
            </div>
          </div>

          {/* Preview names */}
          {previewNames.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 font-medium">Students affected:</p>
              {previewNames.map((s) => (
                <div key={s.cc} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="font-mono text-zinc-400">#{s.cc}</span>
                  <span className="font-medium">{s.student_full_name}</span>
                </div>
              ))}
              {overflow > 0 && (
                <p className="text-xs text-zinc-400">…and {overflow} more</p>
              )}
            </div>
          )}

          <p className="text-xs text-zinc-400">
            Tip: Use <strong>dry-run</strong> first to verify before committing.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
          <button type="button" id="confirm-cancel" onClick={onCancel}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button type="button" id="confirm-execute" onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${
              isGraduating ? "bg-violet-600 hover:bg-violet-700" :
              isExpelling  ? "bg-orange-600 hover:bg-orange-700" :
              isLeaving    ? "bg-amber-600 hover:bg-amber-700" :
                             "bg-primary hover:bg-primary/90"
            }`}>
            Yes, {isGraduating ? "Graduate" : isExpelling ? "Expel" : isLeaving ? "Mark as Left" : "Promote"} Now
          </button>
        </div>
      </div>
    </div>
  );
}
