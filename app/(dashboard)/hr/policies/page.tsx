"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Edit2, Trash2, Loader2, Building, HelpCircle, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { hrService, PolicySet, PolicyRule } from "@/lib/hr.service";
import { campusesService, Campus } from "@/lib/campuses.service";

export default function PoliciesPage() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [policySets, setPolicySets] = useState<PolicySet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State - Policy Set
  const [showSetModal, setShowSetModal] = useState(false);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [setForm, setSetForm] = useState({
    academic_year: "2025-2026",
    effective_from: new Date().toISOString().split("T")[0],
    description: "",
  });

  // Form State - Policy Rule
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [targetSetId, setTargetSetId] = useState<number | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleForm, setRuleForm] = useState({
    rule_type: "MIN_ATTENDANCE_PCT",
    value_key: "percentage",
    value_val: "80",
    applies_to: "STUDENT", // or 'STAFF', 'ALL'
    description: "",
  });

  // Predefined rule types for easy editing
  const RULE_TYPES = [
    { type: "MIN_ATTENDANCE_PCT", key: "percentage", label: "Minimum Attendance %", defaultVal: "80" },
    { type: "LATE_GRACE_PERIOD_MINS", key: "minutes", label: "Late Arrival Grace Period (mins)", defaultVal: "15" },
    { type: "HALF_DAY_LATE_COUNT", key: "count", label: "Late count for Half-Day", defaultVal: "3" },
    { type: "ABSENT_FINE_AMOUNT", key: "amount", label: "Absent Fine Amount", defaultVal: "500" },
  ];

  // Fetch campuses first
  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const list = await campusesService.list();
        setCampuses(list);
        if (list.length > 0) {
          setSelectedCampusId(list[0].id);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch campuses.");
      }
    };
    fetchCampuses();
  }, []);

  // Fetch policies when campus selection changes
  useEffect(() => {
    if (selectedCampusId !== null) {
      fetchPolicies(selectedCampusId);
    }
  }, [selectedCampusId]);

  const fetchPolicies = async (campusId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrService.listPolicies(campusId);
      setPolicySets(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch policies for the selected campus.");
    } finally {
      setLoading(false);
    }
  };

  // Policy Set Actions
  const handleOpenCreateSet = () => {
    setEditingSetId(null);
    setSetForm({
      academic_year: "2025-2026",
      effective_from: new Date().toISOString().split("T")[0],
      description: "",
    });
    setShowSetModal(true);
  };

  const handleOpenEditSet = (set: PolicySet) => {
    setEditingSetId(set.id);
    setSetForm({
      academic_year: set.academic_year,
      effective_from: new Date(set.effective_from).toISOString().split("T")[0],
      description: set.description || "",
    });
    setShowSetModal(true);
  };

  const handleSaveSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCampusId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingSetId) {
        await hrService.updatePolicySet(editingSetId, setForm);
        setSuccess("Policy set updated successfully.");
      } else {
        await hrService.createPolicySet({ ...setForm, campus_id: selectedCampusId });
        setSuccess("Policy set created successfully.");
      }
      setShowSetModal(false);
      fetchPolicies(selectedCampusId);
    } catch (err) {
      console.error(err);
      setError("Failed to save policy set.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSet = async (id: number) => {
    if (!confirm("Are you sure you want to delete this policy set? All rules inside will be permanently deleted.")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deletePolicySet(id);
      setSuccess("Policy set deleted successfully.");
      if (selectedCampusId !== null) fetchPolicies(selectedCampusId);
    } catch (err) {
      console.error(err);
      setError("Failed to delete policy set.");
    }
  };

  // Policy Rule Actions
  const handleOpenCreateRule = (setId: number) => {
    setTargetSetId(setId);
    setEditingRuleId(null);
    const defType = RULE_TYPES[0];
    setRuleForm({
      rule_type: defType.type,
      value_key: defType.key,
      value_val: defType.defaultVal,
      applies_to: "STUDENT",
      description: "",
    });
    setShowRuleModal(true);
  };

  const handleOpenEditRule = (setId: number, rule: PolicyRule) => {
    setTargetSetId(setId);
    setEditingRuleId(rule.id);
    
    // Parse value_json key and value
    const key = Object.keys(rule.value_json)[0] || "value";
    const val = String(rule.value_json[key] || "");

    setRuleForm({
      rule_type: rule.rule_type,
      value_key: key,
      value_val: val,
      applies_to: rule.applies_to || "STUDENT",
      description: rule.description || "",
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetSetId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Build the value_json object
    // Try to save numbers as numbers
    const parsedVal = isNaN(Number(ruleForm.value_val)) ? ruleForm.value_val : Number(ruleForm.value_val);
    const valueJson = { [ruleForm.value_key]: parsedVal };

    const payload = {
      rule_type: ruleForm.rule_type,
      value_json: valueJson,
      applies_to: ruleForm.applies_to || undefined,
      description: ruleForm.description || undefined,
    };

    try {
      if (editingRuleId) {
        await hrService.updatePolicyRule(targetSetId, editingRuleId, payload);
        setSuccess("Rule updated successfully.");
      } else {
        await hrService.createPolicyRule(targetSetId, payload);
        setSuccess("Rule created successfully.");
      }
      setShowRuleModal(false);
      if (selectedCampusId !== null) fetchPolicies(selectedCampusId);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save rule. Ensure rule type is unique per policy set.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (setId: number, id: number) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deletePolicyRule(setId, id);
      setSuccess("Rule deleted successfully.");
      if (selectedCampusId !== null) fetchPolicies(selectedCampusId);
    } catch (err) {
      console.error(err);
      setError("Failed to delete rule.");
    }
  };

  // Adjust default values and keys when rule type selection changes
  const handleRuleTypeChange = (typeStr: string) => {
    const predefined = RULE_TYPES.find((r) => r.type === typeStr);
    if (predefined) {
      setRuleForm((prev) => ({
        ...prev,
        rule_type: typeStr,
        value_key: predefined.key,
        value_val: predefined.defaultVal,
      }));
    } else {
      setRuleForm((prev) => ({
        ...prev,
        rule_type: typeStr,
      }));
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">HR & Attendance Policies</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure attendance rules, grace periods, and thresholds</p>
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

          <button
            onClick={handleOpenCreateSet}
            disabled={selectedCampusId === null}
            className="inline-flex items-center justify-center h-10 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Policy Set
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="flex-1">{success}</p>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading policies...</p>
        </div>
      ) : policySets.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <FileText className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Policy Sets</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            There are no policy sets configured for this campus. Create a set to begin adding rules.
          </p>
          <button
            onClick={handleOpenCreateSet}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
          >
            Create Policy Set
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {policySets.map((set) => (
            <div
              key={set.id}
              className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm"
            >
              {/* Policy Set Header */}
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-lg flex items-center gap-2">
                    Academic Year {set.academic_year}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                      Effective: {new Date(set.effective_from).toLocaleDateString()}
                    </span>
                  </h3>
                  {set.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {set.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenCreateRule(set.id)}
                    className="inline-flex items-center justify-center px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Rule
                  </button>
                  <button
                    onClick={() => handleOpenEditSet(set)}
                    className="p-2 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSet(set.id)}
                    className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Rules List */}
              <div className="p-6">
                {!set.hr_policy_rules || set.hr_policy_rules.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm">
                    No rules defined for this policy set yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {set.hr_policy_rules.map((rule) => {
                      const ruleValKey = Object.keys(rule.value_json)[0];
                      const ruleVal = rule.value_json[ruleValKey];
                      return (
                        <div
                          key={rule.id}
                          className="p-4 bg-zinc-50 dark:bg-zinc-900/25 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono font-bold tracking-wider text-primary/80 uppercase">
                                {rule.rule_type}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 uppercase">
                                For: {rule.applies_to || "ALL"}
                              </span>
                            </div>

                            <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                              {ruleVal}
                              <span className="text-xs font-medium text-zinc-500 ml-1">
                                {ruleValKey}
                              </span>
                            </p>
                            
                            {rule.description && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                {rule.description}
                              </p>
                            )}
                          </div>

                          <div className="flex justify-end items-center mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50 space-x-2">
                            <button
                              onClick={() => handleOpenEditRule(set.id, rule)}
                              className="p-1.5 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(set.id, rule.id)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Policy Set Modal */}
      {showSetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveSet}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingSetId ? "Edit Policy Set" : "Add Policy Set"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Academic Year</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2025-2026"
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={setForm.academic_year}
                      onChange={(e) => setSetForm({ ...setForm, academic_year: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Effective From</label>
                    <input
                      type="date"
                      required
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      value={setForm.effective_from}
                      onChange={(e) => setSetForm({ ...setForm, effective_from: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={3}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={setForm.description}
                    onChange={(e) => setSetForm({ ...setForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSetModal(false)}
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

      {/* Policy Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveRule}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingRuleId ? "Edit Rule" : "Add Policy Rule"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Rule Type</label>
                  <select
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={ruleForm.rule_type}
                    onChange={(e) => handleRuleTypeChange(e.target.value)}
                  >
                    {RULE_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.type} ({t.label})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Value Key</label>
                    <input
                      type="text"
                      required
                      readOnly
                      className="w-full h-11 px-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-sm text-zinc-500 cursor-not-allowed"
                      value={ruleForm.value_key}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Value</label>
                    <input
                      type="text"
                      required
                      placeholder="Value"
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={ruleForm.value_val}
                      onChange={(e) => setRuleForm({ ...ruleForm, value_val: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Applies To</label>
                  <select
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={ruleForm.applies_to}
                    onChange={(e) => setRuleForm({ ...ruleForm, applies_to: e.target.value })}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="STAFF">STAFF</option>
                    <option value="ALL">ALL</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={ruleForm.description}
                    onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
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
