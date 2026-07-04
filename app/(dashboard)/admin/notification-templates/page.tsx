"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Save,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Banknote,
  Fingerprint,
  CalendarDays,
  Briefcase,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Template registry — single source of truth for keys, labels, defaults & vars
// ---------------------------------------------------------------------------

interface TemplateDef {
  key: string;
  label: string;
  audience: "Parent" | "Staff";
  field: "title" | "body";
  defaultValue: string;
  variables: string[];
}

interface TemplateGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  templates: TemplateDef[];
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    id: "fees",
    label: "Fee Notifications",
    icon: Banknote,
    templates: [
      { key: "notif_fee_issued_title", label: "Fee Issued", audience: "Parent", field: "title", defaultValue: "School Fees: {month}", variables: ["month"] },
      { key: "notif_fee_issued_body", label: "Fee Issued", audience: "Parent", field: "body", defaultValue: "Please pay {student_name}'s {month} school fees by {due_date}.", variables: ["student_name", "month", "due_date"] },

      { key: "notif_fee_due_3d_title", label: "Due Reminder (3 days)", audience: "Parent", field: "title", defaultValue: "Fee Reminder: {month}", variables: ["month"] },
      { key: "notif_fee_due_3d_body", label: "Due Reminder (3 days)", audience: "Parent", field: "body", defaultValue: "{student_name}'s {month} school fees are due on {due_date}. Please pay on time to avoid late charges.", variables: ["student_name", "month", "due_date"] },
      { key: "notif_fee_due_2d_title", label: "Due Reminder (2 days)", audience: "Parent", field: "title", defaultValue: "Fee Reminder: {month}", variables: ["month"] },
      { key: "notif_fee_due_2d_body", label: "Due Reminder (2 days)", audience: "Parent", field: "body", defaultValue: "{student_name}'s {month} school fees are due on {due_date}. Please pay on time to avoid late charges.", variables: ["student_name", "month", "due_date"] },
      { key: "notif_fee_due_1d_title", label: "Due Reminder (1 day)", audience: "Parent", field: "title", defaultValue: "Fee Reminder: {month}", variables: ["month"] },
      { key: "notif_fee_due_1d_body", label: "Due Reminder (1 day)", audience: "Parent", field: "body", defaultValue: "{student_name}'s {month} school fees are due on {due_date}. Please pay on time to avoid late charges.", variables: ["student_name", "month", "due_date"] },

      { key: "notif_fee_overdue_title", label: "Fee Overdue", audience: "Parent", field: "title", defaultValue: "Fee Overdue: {month}", variables: ["month"] },
      { key: "notif_fee_overdue_body", label: "Fee Overdue", audience: "Parent", field: "body", defaultValue: "{student_name}'s {month} school fees were due on {due_date} and are now overdue. Please pay as soon as possible.", variables: ["student_name", "month", "due_date"] },

      { key: "notif_fee_expiry_3d_title", label: "Expiry Reminder (3 days)", audience: "Parent", field: "title", defaultValue: "Payment Deadline Approaching", variables: [] },
      { key: "notif_fee_expiry_3d_body", label: "Expiry Reminder (3 days)", audience: "Parent", field: "body", defaultValue: "{student_name}'s outstanding school fees must be paid by {expiry_date}. Please settle the balance soon.", variables: ["student_name", "expiry_date"] },
      { key: "notif_fee_expiry_2d_title", label: "Expiry Reminder (2 days)", audience: "Parent", field: "title", defaultValue: "Payment Deadline Approaching", variables: [] },
      { key: "notif_fee_expiry_2d_body", label: "Expiry Reminder (2 days)", audience: "Parent", field: "body", defaultValue: "{student_name}'s outstanding school fees must be paid by {expiry_date}. Please settle the balance soon.", variables: ["student_name", "expiry_date"] },
      { key: "notif_fee_expiry_1d_title", label: "Expiry Reminder (1 day)", audience: "Parent", field: "title", defaultValue: "Payment Deadline Approaching", variables: [] },
      { key: "notif_fee_expiry_1d_body", label: "Expiry Reminder (1 day)", audience: "Parent", field: "body", defaultValue: "{student_name}'s outstanding school fees must be paid by {expiry_date}. Please settle the balance soon.", variables: ["student_name", "expiry_date"] },
    ],
  },
  {
    id: "attendance",
    label: "Attendance Notifications",
    icon: Fingerprint,
    templates: [
      { key: "notif_attend_arrived_title", label: "Arrived at School", audience: "Parent", field: "title", defaultValue: "Arrived at School", variables: [] },
      { key: "notif_attend_arrived_body", label: "Arrived at School", audience: "Parent", field: "body", defaultValue: "{student_name} has arrived at TAFS at {time}", variables: ["student_name", "time"] },
      { key: "notif_attend_late_title", label: "Arrived Late", audience: "Parent", field: "title", defaultValue: "Arrived Late", variables: [] },
      { key: "notif_attend_late_body", label: "Arrived Late", audience: "Parent", field: "body", defaultValue: "{student_name} has arrived late at TAFS at {time}", variables: ["student_name", "time"] },
      { key: "notif_attend_left_title", label: "Left School", audience: "Parent", field: "title", defaultValue: "Left School", variables: [] },
      { key: "notif_attend_left_body", label: "Left School", audience: "Parent", field: "body", defaultValue: "{student_name} has left TAFS at {time}", variables: ["student_name", "time"] },
    ],
  },
  {
    id: "calendar",
    label: "Calendar Notifications",
    icon: CalendarDays,
    templates: [
      { key: "notif_holiday_title", label: "Holiday", audience: "Parent", field: "title", defaultValue: "School Closed", variables: [] },
      { key: "notif_holiday_body", label: "Holiday", audience: "Parent", field: "body", defaultValue: "{student_name} — TAFS is closed on {date} for {description}.", variables: ["student_name", "date", "description"] },
      { key: "notif_day_off_title", label: "Scheduled Day Off", audience: "Parent", field: "title", defaultValue: "Scheduled Day Off", variables: [] },
      { key: "notif_day_off_body", label: "Scheduled Day Off", audience: "Parent", field: "body", defaultValue: "{student_name} — TAFS is closed on {date} (weekend).", variables: ["student_name", "date"] },
      { key: "notif_school_open_title", label: "School Open", audience: "Parent", field: "title", defaultValue: "School Open", variables: [] },
      { key: "notif_school_open_body", label: "School Open", audience: "Parent", field: "body", defaultValue: "{student_name} — TAFS will be open on {date}.", variables: ["student_name", "date"] },
    ],
  },
  {
    id: "staff",
    label: "Staff Notifications",
    icon: Briefcase,
    templates: [
      { key: "notif_staff_saturday_title", label: "Saturday Schedule", audience: "Staff", field: "title", defaultValue: "Working Saturday Notice", variables: ["month"] },
      { key: "notif_staff_saturday_body", label: "Saturday Schedule", audience: "Staff", field: "body", defaultValue: "You are required to attend school on the following Saturday(s) in {month}: {date_list}. {attendance_note}", variables: ["month", "date_list", "attendance_note"] },
    ],
  },
];

const ALL_TEMPLATE_KEYS = TEMPLATE_GROUPS.flatMap((g) =>
  g.templates.map((t) => t.key),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const g of TEMPLATE_GROUPS) {
    for (const t of g.templates) {
      map[t.key] = t.defaultValue;
    }
  }
  return map;
}

function findUnknownVars(value: string, knownVars: string[]): string[] {
  const found = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return found.filter((v) => !knownVars.includes(v));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function NotificationTemplatesPage() {
  const { user } = useAuthState();
  const defaults = getDefaultMap();

  const [values, setValues] = useState<Record<string, string>>({ ...defaults });
  const [saved, setSaved] = useState<Record<string, string>>({ ...defaults });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(),
  );

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/v1/app-config");
      const configList: { key: string; value: string }[] = data?.data || [];
      const configMap: Record<string, string> = {};
      for (const cfg of configList) {
        if (ALL_TEMPLATE_KEYS.includes(cfg.key)) {
          configMap[cfg.key] = cfg.value;
        }
      }
      const merged = { ...defaults, ...configMap };
      setValues(merged);
      setSaved(merged);
    } catch {
      toast.error("Failed to load notification templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const dirtyKeys = new Set(
    Object.keys(values).filter((k) => values[k] !== saved[k]),
  );
  const dirtyCount = dirtyKeys.size;

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = (key: string) => {
    setValues((prev) => ({ ...prev, [key]: defaults[key] }));
  };

  const handleSave = async () => {
    if (dirtyCount === 0) return;
    setIsSaving(true);
    const loadingToast = toast.loading(`Saving ${dirtyCount} template(s)...`);
    try {
      for (const key of dirtyKeys) {
        await api.patch(`/v1/app-config/${key}`, { value: values[key] });
      }
      setSaved({ ...values });
      toast.success(`${dirtyCount} template(s) saved`, { id: loadingToast });
    } catch {
      toast.error("Failed to save templates", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  if (user && user.role !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 bg-red-50 text-red-500 rounded-full">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h2 className="text-xl font-black text-zinc-800">Access Denied</h2>
        <p className="text-zinc-500 max-w-xs text-center text-sm font-medium">
          Only Super Administrator accounts can edit notification templates.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-950 text-white rounded-2xl">
              <Bell className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">
              Notification Templates
            </h1>
          </div>
          <p className="text-zinc-500 text-sm font-medium pl-1">
            Edit push notification text sent to parents and staff.
          </p>
        </div>

        {!isLoading && (
          <button
            onClick={handleSave}
            disabled={isSaving || dirtyCount === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-40 shrink-0 self-start"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {dirtyCount > 0
              ? `Save ${dirtyCount} Change${dirtyCount > 1 ? "s" : ""}`
              : "All Saved"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4 bg-white rounded-[32px] border border-zinc-100 shadow-sm">
          <Loader2 className="h-10 w-10 text-zinc-900 animate-spin" />
          <p className="text-zinc-500 text-sm font-black uppercase tracking-wider animate-pulse">
            Loading templates...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {TEMPLATE_GROUPS.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const GroupIcon = group.icon;
            const groupDirtyCount = group.templates.filter((t) =>
              dirtyKeys.has(t.key),
            ).length;

            // Pair title+body templates for side-by-side display
            const pairs: { label: string; audience: string; titleDef: TemplateDef; bodyDef: TemplateDef }[] = [];
            const used = new Set<string>();
            for (const t of group.templates) {
              if (used.has(t.key)) continue;
              if (t.field === "title") {
                const bodyKey = t.key.replace(/_title$/, "_body");
                const bodyDef = group.templates.find((b) => b.key === bodyKey);
                if (bodyDef) {
                  pairs.push({
                    label: t.label,
                    audience: t.audience,
                    titleDef: t,
                    bodyDef,
                  });
                  used.add(t.key);
                  used.add(bodyDef.key);
                }
              }
            }

            return (
              <div
                key={group.id}
                className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden"
              >
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-8 py-5 hover:bg-zinc-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 rounded-xl text-zinc-600">
                      <GroupIcon className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <h2 className="font-black text-zinc-800 text-base">
                        {group.label}
                      </h2>
                      <p className="text-xs text-zinc-400 font-medium">
                        {group.templates.length / 2} notification type
                        {group.templates.length / 2 > 1 ? "s" : ""}
                        {groupDirtyCount > 0 && (
                          <span className="ml-2 text-amber-600 font-bold">
                            {groupDirtyCount} unsaved
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-zinc-400" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-8 pb-6 space-y-5">
                        {pairs.map(({ label, audience, titleDef, bodyDef }) => {
                          const titleDirty = dirtyKeys.has(titleDef.key);
                          const bodyDirty = dirtyKeys.has(bodyDef.key);
                          const isDirty = titleDirty || bodyDirty;
                          const allVars = [
                            ...new Set([
                              ...titleDef.variables,
                              ...bodyDef.variables,
                            ]),
                          ];
                          const unknownTitleVars = findUnknownVars(
                            values[titleDef.key] ?? "",
                            titleDef.variables,
                          );
                          const unknownBodyVars = findUnknownVars(
                            values[bodyDef.key] ?? "",
                            bodyDef.variables,
                          );

                          return (
                            <div
                              key={titleDef.key}
                              className={`p-5 rounded-2xl border transition-colors ${
                                isDirty
                                  ? "border-amber-200 bg-amber-50/30"
                                  : "border-zinc-100 bg-zinc-50/40"
                              }`}
                            >
                              {/* Row header */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-zinc-800">
                                    {label}
                                  </span>
                                  <span
                                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                      audience === "Staff"
                                        ? "bg-violet-100 text-violet-700"
                                        : "bg-blue-100 text-blue-700"
                                    }`}
                                  >
                                    {audience}
                                  </span>
                                  {isDirty && (
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleReset(titleDef.key);
                                    handleReset(bodyDef.key);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Reset
                                </button>
                              </div>

                              {/* Title input */}
                              <div className="space-y-1.5 mb-3">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                  Title
                                </label>
                                <input
                                  type="text"
                                  value={values[titleDef.key] ?? ""}
                                  onChange={(e) =>
                                    handleChange(titleDef.key, e.target.value)
                                  }
                                  className={`w-full h-10 px-4 border rounded-xl outline-none text-zinc-800 text-sm font-bold transition-colors ${
                                    titleDirty
                                      ? "bg-white border-amber-300 focus:border-amber-400"
                                      : "bg-white border-zinc-200 focus:border-zinc-300"
                                  }`}
                                />
                                {unknownTitleVars.length > 0 && (
                                  <p className="text-[10px] text-amber-600 font-medium">
                                    Unknown variable
                                    {unknownTitleVars.length > 1 ? "s" : ""}:{" "}
                                    {unknownTitleVars
                                      .map((v) => `{${v}}`)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>

                              {/* Body textarea */}
                              <div className="space-y-1.5 mb-3">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                  Body
                                </label>
                                <textarea
                                  rows={2}
                                  value={values[bodyDef.key] ?? ""}
                                  onChange={(e) =>
                                    handleChange(bodyDef.key, e.target.value)
                                  }
                                  className={`w-full p-3 border rounded-xl outline-none text-zinc-800 text-sm font-medium resize-none transition-colors ${
                                    bodyDirty
                                      ? "bg-white border-amber-300 focus:border-amber-400"
                                      : "bg-white border-zinc-200 focus:border-zinc-300"
                                  }`}
                                />
                                {unknownBodyVars.length > 0 && (
                                  <p className="text-[10px] text-amber-600 font-medium">
                                    Unknown variable
                                    {unknownBodyVars.length > 1 ? "s" : ""}:{" "}
                                    {unknownBodyVars
                                      .map((v) => `{${v}}`)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>

                              {/* Variable chips */}
                              {allVars.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="text-[10px] font-bold text-zinc-400 self-center mr-1">
                                    Variables:
                                  </span>
                                  {allVars.map((v) => (
                                    <span
                                      key={v}
                                      className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md"
                                    >
                                      {`{${v}}`}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
