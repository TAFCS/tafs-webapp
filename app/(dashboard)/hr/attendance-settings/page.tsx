"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Building,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Settings2,
  User,
  Users2,
} from "lucide-react";
import { campusesService, Campus, CampusClassInfo } from "@/lib/campuses.service";
import { attendanceService, ClassCheckInSchedule } from "@/lib/attendance.service";
import { hrService, PolicySet, PolicyRule } from "@/lib/hr.service";

export default function AttendanceSettingsPage() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [classes, setClasses] = useState<CampusClassInfo[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "staff" | "recompute">("students");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Student Schedules Tab State
  const [schedules, setSchedules] = useState<ClassCheckInSchedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    class_id: "",
    expected_check_in: "08:00",
    late_grace_minutes: 10,
    effective_from: new Date().toISOString().split("T")[0],
  });

  // Staff Defaults Tab State
  const [activePolicySet, setActivePolicySet] = useState<PolicySet | null>(null);
  const [policyRules, setPolicyRules] = useState<{
    studentTimeId?: number;
    studentTimeVal: string;
    studentGraceId?: number;
    studentGraceVal: number;
    staffTimeId?: number;
    staffTimeVal: string;
    staffGraceId?: number;
    staffGraceVal: number;
  }>({
    studentTimeVal: "08:00",
    studentGraceVal: 10,
    staffTimeVal: "08:30",
    staffGraceVal: 15,
  });

  // Recompute State
  const [recomputeForm, setRecomputeForm] = useState({
    date_from: new Date().toISOString().split("T")[0],
    date_to: new Date().toISOString().split("T")[0],
    class_id: "",
  });

  // Fetch Campuses & Classes
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [campusList, classList] = await Promise.all([
          campusesService.list(),
          campusesService.listAllClasses(),
        ]);
        setCampuses(campusList);
        setClasses(classList);
        if (campusList.length > 0) {
          setSelectedCampusId(campusList[0].id);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load settings configuration.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Fetch data depending on campus & tab
  useEffect(() => {
    if (selectedCampusId === null) return;
    setError(null);
    setSuccess(null);

    if (activeTab === "students") {
      fetchStudentSchedules(selectedCampusId);
    } else if (activeTab === "staff") {
      fetchCampusDefaults(selectedCampusId);
    }
  }, [selectedCampusId, activeTab]);

  const fetchStudentSchedules = async (campusId: number) => {
    setLoading(true);
    try {
      const data = await attendanceService.getClassCheckInSchedules(campusId);
      setSchedules(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch class check-in schedules.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCampusDefaults = async (campusId: number) => {
    setLoading(true);
    try {
      const policySets = await hrService.listPolicies(campusId);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const activeSets = policySets
        .filter((s) => new Date(s.effective_from) <= today)
        .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());

      const hasStudentTimeRule = (set: PolicySet) =>
        (set.hr_policy_rules || []).some(
          (r) =>
            r.rule_type === "EXPECTED_CHECK_IN_TIME_STUDENT" ||
            r.rule_type === "EXPECTED_CHECK_IN_TIME",
        );

      const activeSet =
        activeSets.find(hasStudentTimeRule) ?? activeSets[0] ?? policySets[0] ?? null;

      if (activeSet) {
        setActivePolicySet(activeSet);

        const rules = activeSet.hr_policy_rules || [];
        const studentTimeRule = rules.find((r) => r.rule_type === "EXPECTED_CHECK_IN_TIME_STUDENT");
        const studentGraceRule = rules.find((r) => r.rule_type === "LATE_GRACE_PERIOD_MINS_STUDENT");
        const staffTimeRule = rules.find((r) => r.rule_type === "EXPECTED_CHECK_IN_TIME_STAFF");
        const staffGraceRule = rules.find((r) => r.rule_type === "LATE_GRACE_PERIOD_MINS_STAFF");

        const parseTimeRuleVal = (rule: PolicyRule | undefined) => {
          if (!rule?.value_json) return "";
          return rule.value_json.time || "";
        };

        const parseGraceRuleVal = (rule: PolicyRule | undefined) => {
          if (!rule?.value_json) return 0;
          const m = rule.value_json.minutes;
          if (typeof m === "number") return m;
          if (typeof m === "string") {
            const n = parseInt(m, 10);
            return Number.isNaN(n) ? 0 : n;
          }
          return 0;
        };

        setPolicyRules({
          studentTimeId: studentTimeRule?.id,
          studentTimeVal: parseTimeRuleVal(studentTimeRule) || "08:00",
          studentGraceId: studentGraceRule?.id,
          studentGraceVal: parseGraceRuleVal(studentGraceRule) ?? 10,
          staffTimeId: staffTimeRule?.id,
          staffTimeVal: parseTimeRuleVal(staffTimeRule) || "08:30",
          staffGraceId: staffGraceRule?.id,
          staffGraceVal: parseGraceRuleVal(staffGraceRule) ?? 15,
        });
      } else {
        setActivePolicySet(null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch campus policies.");
    } finally {
      setLoading(false);
    }
  };

  // Schedule Actions
  const handleOpenAddSchedule = () => {
    setEditingScheduleId(null);
    setScheduleForm({
      class_id: classes[0]?.id ? String(classes[0].id) : "",
      expected_check_in: "08:00",
      late_grace_minutes: 10,
      effective_from: new Date().toISOString().split("T")[0],
    });
    setShowScheduleModal(true);
  };

  const handleOpenEditSchedule = (schedule: ClassCheckInSchedule) => {
    setEditingScheduleId(schedule.id);
    
    // Parse Date UTC to simple local YYYY-MM-DD
    const dateStr = new Date(schedule.effective_from).toISOString().split("T")[0];
    
    // Parse UTC expected_check_in representation to local time representation "HH:MM"
    const checkInDate = new Date(schedule.expected_check_in);
    const h = String(checkInDate.getUTCHours()).padStart(2, "0");
    const m = String(checkInDate.getUTCMinutes()).padStart(2, "0");

    setScheduleForm({
      class_id: String(schedule.class_id),
      expected_check_in: `${h}:${m}`,
      late_grace_minutes: schedule.late_grace_minutes,
      effective_from: dateStr,
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCampusId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      class_id: Number(scheduleForm.class_id),
      campus_id: selectedCampusId,
      expected_check_in: scheduleForm.expected_check_in,
      late_grace_minutes: Number(scheduleForm.late_grace_minutes),
      effective_from: scheduleForm.effective_from,
    };

    try {
      if (editingScheduleId) {
        await attendanceService.updateClassCheckInSchedule(editingScheduleId, {
          expected_check_in: payload.expected_check_in,
          late_grace_minutes: payload.late_grace_minutes,
          effective_from: payload.effective_from,
        });
        setSuccess("Class schedule updated successfully.");
      } else {
        await attendanceService.createClassCheckInSchedule(payload);
        setSuccess("Class schedule created successfully.");
      }
      setShowScheduleModal(false);
      fetchStudentSchedules(selectedCampusId);

      const today = new Date().toISOString().split("T")[0];
      try {
        await attendanceService.recomputeLateStatus({
          campus_id: selectedCampusId,
          date_from: today,
          date_to: today,
          class_id: Number(scheduleForm.class_id),
        });
      } catch {
        // non-fatal
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    setError(null);
    setSuccess(null);
    try {
      await attendanceService.deleteClassCheckInSchedule(id);
      setSuccess("Class schedule deleted successfully.");
      if (selectedCampusId !== null) fetchStudentSchedules(selectedCampusId);
    } catch (err) {
      console.error(err);
      setError("Failed to delete class schedule.");
    }
  };

  // Staff/Campus Defaults Actions
  const handleSaveDefaults = async () => {
    if (!activePolicySet || selectedCampusId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const setId = activePolicySet.id;

      // 1. Student Expected Time
      const timeStudPayload = { rule_type: "EXPECTED_CHECK_IN_TIME_STUDENT", value_json: { time: policyRules.studentTimeVal }, applies_to: "STUDENT" };
      if (policyRules.studentTimeId) {
        await hrService.updatePolicyRule(setId, policyRules.studentTimeId, timeStudPayload);
      } else {
        await hrService.createPolicyRule(setId, timeStudPayload);
      }

      // 2. Student Grace Minutes
      const graceStudPayload = { rule_type: "LATE_GRACE_PERIOD_MINS_STUDENT", value_json: { minutes: Number(policyRules.studentGraceVal) }, applies_to: "STUDENT" };
      if (policyRules.studentGraceId) {
        await hrService.updatePolicyRule(setId, policyRules.studentGraceId, graceStudPayload);
      } else {
        await hrService.createPolicyRule(setId, graceStudPayload);
      }

      // 3. Staff Expected Time
      const timeStaffPayload = { rule_type: "EXPECTED_CHECK_IN_TIME_STAFF", value_json: { time: policyRules.staffTimeVal }, applies_to: "STAFF" };
      if (policyRules.staffTimeId) {
        await hrService.updatePolicyRule(setId, policyRules.staffTimeId, timeStaffPayload);
      } else {
        await hrService.createPolicyRule(setId, timeStaffPayload);
      }

      // 4. Staff Grace Minutes
      const graceStaffPayload = { rule_type: "LATE_GRACE_PERIOD_MINS_STAFF", value_json: { minutes: Number(policyRules.staffGraceVal) }, applies_to: "STAFF" };
      if (policyRules.staffGraceId) {
        await hrService.updatePolicyRule(setId, policyRules.staffGraceId, graceStaffPayload);
      } else {
        await hrService.createPolicyRule(setId, graceStaffPayload);
      }

      setSuccess("Campus defaults saved successfully.");
      fetchCampusDefaults(selectedCampusId);

      // Re-apply late status for today so existing check-ins reflect new rules
      const today = new Date().toISOString().split("T")[0];
      try {
        await attendanceService.recomputeLateStatus({
          campus_id: selectedCampusId,
          date_from: today,
          date_to: today,
        });
        setSuccess("Campus defaults saved and today's attendance re-evaluated.");
      } catch {
        setSuccess(
          "Campus defaults saved. Use the Recompute tab if today's statuses still look wrong.",
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save campus defaults.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePolicySetInline = async () => {
    if (selectedCampusId === null) return;
    setSaving(true);
    setError(null);
    try {
      await hrService.createPolicySet({
        campus_id: selectedCampusId,
        academic_year: "2025-2026",
        effective_from: new Date().toISOString().split("T")[0],
        description: "Auto-generated default policy set for late settings",
      });
      setSuccess("Created policy set successfully. You can now configure settings.");
      fetchCampusDefaults(selectedCampusId);
    } catch (err) {
      console.error(err);
      setError("Failed to create policy set.");
    } finally {
      setSaving(false);
    }
  };

  // Recompute Action
  const handleRecompute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCampusId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await attendanceService.recomputeLateStatus({
        campus_id: selectedCampusId,
        date_from: recomputeForm.date_from,
        date_to: recomputeForm.date_to,
        class_id: recomputeForm.class_id ? Number(recomputeForm.class_id) : undefined,
      });

      setSuccess(
        `Late status recomputation complete! Students recomputed: ${res.studentsRecomputed}. Staff recomputed: ${res.staffRecomputed}.`
      );
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to recompute status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white font-outfit">Attendance settings</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage expected check-in schedules, grace periods and recompute statuses</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Campus Selector */}
          <div className="flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Building className="h-4 w-4 text-zinc-400" />
            <select
              className="bg-transparent border-none text-sm font-semibold outline-none focus:ring-0 text-zinc-800 dark:text-zinc-200"
              value={selectedCampusId || ""}
              onChange={(e) => setSelectedCampusId(parseInt(e.target.value, 10))}
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.campus_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "students"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Users2 className="h-4 w-4" />
          Student Schedules
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "staff"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Settings2 className="h-4 w-4" />
          Campus Defaults
        </button>
        <button
          onClick={() => setActiveTab("recompute")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "recompute"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Recompute Status
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="flex-1 font-semibold">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="flex-1 font-semibold">{success}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && !showScheduleModal && (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading attendance settings...</p>
        </div>
      )}

      {/* Tab Contents */}
      {!loading && (
        <>
          {/* TAB: Student Schedules */}
          {activeTab === "students" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Class-Specific check-in times</h2>
                <button
                  onClick={handleOpenAddSchedule}
                  className="inline-flex items-center justify-center h-10 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Class Schedule
                </button>
              </div>

              {schedules.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
                  <Clock className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No custom class schedules</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
                    All classes fallback to campus-wide settings. Create a custom schedule to override for specific classes.
                  </p>
                  <button
                    onClick={handleOpenAddSchedule}
                    className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
                  >
                    Add Class Schedule
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Class</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Expected Check-In</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Grace minutes</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Effective From</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {schedules.map((s) => {
                        const checkInDate = new Date(s.expected_check_in);
                        const h = String(checkInDate.getUTCHours()).padStart(2, "0");
                        const m = String(checkInDate.getUTCMinutes()).padStart(2, "0");

                        return (
                          <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-zinc-900 dark:text-white">
                                {s.classes?.description ?? `Class ID ${s.class_id}`}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5">
                                {s.classes?.class_code}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              {h}:{m}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {s.late_grace_minutes} mins
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                              {new Date(s.effective_from).toLocaleDateString("en-US", { timeZone: "UTC" })}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => handleOpenEditSchedule(s)}
                                className="p-2 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSchedule(s.id)}
                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: Campus Defaults */}
          {activeTab === "staff" && (
            <div className="max-w-xl">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Campus Fallbacks</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                Define the default expected times and late relaxed limits used when no class schedule or employee profile overrides apply.
              </p>

              {!activePolicySet ? (
                <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3 animate-pulse" />
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">No policy set configured</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
                    A campus policy set is required to configure late defaults. Create one to continue.
                  </p>
                  <button
                    onClick={handleCreatePolicySetInline}
                    className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
                  >
                    Create Policy Set
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6 shadow-sm">
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      Active Policy Set
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                      Year {activePolicySet.academic_year}
                    </span>
                  </div>

                  {/* Student Fallback fields */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Users2 className="h-4 w-4 text-primary" /> Student Fallbacks
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Expected Check-In</label>
                        <input
                          type="time"
                          required
                          className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                          value={policyRules.studentTimeVal}
                          onChange={(e) => setPolicyRules({ ...policyRules, studentTimeVal: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Grace minutes</label>
                        <input
                          type="number"
                          required
                          min={0}
                          className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                          value={policyRules.studentGraceVal}
                          onChange={(e) => setPolicyRules({ ...policyRules, studentGraceVal: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Staff Fallback fields */}
                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-primary" /> Staff Fallbacks
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Expected Check-In</label>
                        <input
                          type="time"
                          required
                          className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                          value={policyRules.staffTimeVal}
                          onChange={(e) => setPolicyRules({ ...policyRules, staffTimeVal: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Grace minutes</label>
                        <input
                          type="number"
                          required
                          min={0}
                          className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                          value={policyRules.staffGraceVal}
                          onChange={(e) => setPolicyRules({ ...policyRules, staffGraceVal: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                    <button
                      onClick={handleSaveDefaults}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-6 h-11 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-bold rounded-xl text-sm"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Recompute Status */}
          {activeTab === "recompute" && (
            <div className="max-w-xl">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Recompute late statuses</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                Recalculate the attendance status (`PRESENT` or `LATE`) for biometric check-in entries in the selected date range. Note: This will not modify manual or system-marked entries.
              </p>

              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                <form onSubmit={handleRecompute} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Date From
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                        value={recomputeForm.date_from}
                        onChange={(e) => setRecomputeForm({ ...recomputeForm, date_from: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Date To
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                        value={recomputeForm.date_to}
                        onChange={(e) => setRecomputeForm({ ...recomputeForm, date_to: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Class (Optional)</label>
                    <select
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={recomputeForm.class_id}
                      onChange={(e) => setRecomputeForm({ ...recomputeForm, class_id: e.target.value })}
                    >
                      <option value="">All Classes (Recomputes Students & Staff)</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.description} ({cls.class_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-6 h-11 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-sm transition-all"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Recompute
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveSchedule}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingScheduleId ? "Edit Class Schedule" : "Add Class Check-In Time"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Class</label>
                  <select
                    required
                    disabled={editingScheduleId !== null}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-900"
                    value={scheduleForm.class_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, class_id: e.target.value })}
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.description} ({cls.class_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Expected Check-In</label>
                    <input
                      type="time"
                      required
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={scheduleForm.expected_check_in}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, expected_check_in: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Grace minutes</label>
                    <input
                      type="number"
                      required
                      min={0}
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={scheduleForm.late_grace_minutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, late_grace_minutes: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Effective From</label>
                  <input
                    type="date"
                    required
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                    value={scheduleForm.effective_from}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, effective_from: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 h-11 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl text-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
