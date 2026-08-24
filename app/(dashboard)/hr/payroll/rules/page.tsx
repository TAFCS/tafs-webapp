"use client";

import { useEffect, useState } from "react";
import { Landmark, Plus, Edit2, Trash2, Loader2, AlertCircle, CheckCircle2, History } from "lucide-react";
import {
  hrService,
  PayrollStatutoryRule,
  PayrollStatutoryRuleType,
  IncomeTaxSlab,
} from "@/lib/hr.service";

const RULE_TYPE_META: Record<PayrollStatutoryRuleType, { label: string; blurb: string }> = {
  EOBI: { label: "EOBI", blurb: "Federal old-age pension contribution — employer & employee, on the minimum wage." },
  SESSI: { label: "SESSI", blurb: "Sindh social security contribution — employer only, on the minimum wage." },
  INCOME_TAX: { label: "Income Tax", blurb: "FBR salaried income tax slabs, applied to annual taxable income." },
};

const RULE_TYPES: PayrollStatutoryRuleType[] = ["EOBI", "SESSI", "INCOME_TAX"];

const emptySlab: IncomeTaxSlab = { min: 0, max: 0, fixed_amount: 0, rate_percent: 0 };

const currency = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

export default function PayrollRulesPage() {
  const [rules, setRules] = useState<PayrollStatutoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalRuleType, setModalRuleType] = useState<PayrollStatutoryRuleType>("EOBI");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [employerPercent, setEmployerPercent] = useState("");
  const [employeePercent, setEmployeePercent] = useState("");
  const [wageBaseAmount, setWageBaseAmount] = useState("");
  const [exemptionThreshold, setExemptionThreshold] = useState("");
  const [slabs, setSlabs] = useState<IncomeTaxSlab[]>([{ ...emptySlab }]);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrService.listPayrollStatutoryRules();
      setRules(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch payroll statutory rules.");
    } finally {
      setLoading(false);
    }
  };

  const rulesByType = (type: PayrollStatutoryRuleType) =>
    [...rules]
      .filter((r) => r.rule_type === type)
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));

  const handleOpenCreate = (type: PayrollStatutoryRuleType) => {
    setModalRuleType(type);
    setEditingId(null);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setDescription("");
    setEmployerPercent("");
    setEmployeePercent("");
    setWageBaseAmount("");
    setExemptionThreshold("600000");
    setSlabs([{ ...emptySlab }]);
    setShowModal(true);
  };

  const handleOpenEdit = (rule: PayrollStatutoryRule) => {
    setModalRuleType(rule.rule_type);
    setEditingId(rule.id);
    setEffectiveFrom(new Date(rule.effective_from).toISOString().split("T")[0]);
    setDescription(rule.description || "");
    if (rule.rule_type === "INCOME_TAX") {
      setExemptionThreshold(String(rule.value_json?.exemption_threshold ?? ""));
      setSlabs(rule.value_json?.slabs?.length ? rule.value_json.slabs : [{ ...emptySlab }]);
    } else {
      setEmployerPercent(String(rule.value_json?.employer_percent ?? ""));
      setEmployeePercent(String(rule.value_json?.employee_percent ?? ""));
      setWageBaseAmount(String(rule.value_json?.wage_base_amount ?? ""));
    }
    setShowModal(true);
  };

  const handleSlabChange = (index: number, field: keyof IncomeTaxSlab, value: string) => {
    setSlabs((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (field === "max") {
          return { ...s, max: value === "" ? null : Number(value) };
        }
        return { ...s, [field]: Number(value) };
      }),
    );
  };

  const addSlabRow = () => setSlabs((prev) => [...prev, { ...emptySlab }]);
  const removeSlabRow = (index: number) => setSlabs((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const value_json =
      modalRuleType === "INCOME_TAX"
        ? { exemption_threshold: Number(exemptionThreshold), slabs }
        : modalRuleType === "EOBI"
          ? {
              employer_percent: Number(employerPercent),
              employee_percent: Number(employeePercent),
              wage_base_amount: Number(wageBaseAmount),
            }
          : { employer_percent: Number(employerPercent), wage_base_amount: Number(wageBaseAmount) };

    try {
      if (editingId) {
        await hrService.updatePayrollStatutoryRule(editingId, {
          effective_from: effectiveFrom,
          value_json,
          description: description || undefined,
        });
        setSuccess("Rule updated successfully.");
      } else {
        await hrService.createPayrollStatutoryRule({
          rule_type: modalRuleType,
          effective_from: effectiveFrom,
          value_json,
          description: description || undefined,
        });
        setSuccess("Rule created successfully.");
      }
      setShowModal(false);
      fetchRules();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rule version?")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deletePayrollStatutoryRule(id);
      setSuccess("Rule deleted successfully.");
      fetchRules();
    } catch (err) {
      console.error(err);
      setError("Failed to delete rule.");
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-primary/10 rounded-2xl">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Payroll Statutory Rules</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            EOBI, SESSI & income tax rates. Editing here does not change existing payroll runs.
          </p>
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

      {loading ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading rules...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {RULE_TYPES.map((type) => {
            const versions = rulesByType(type);
            const current = versions.find((v) => v.effective_from <= today) || versions[0];
            const history = versions.filter((v) => v.id !== current?.id);
            const meta = RULE_TYPE_META[type];

            return (
              <div
                key={type}
                className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-zinc-950 dark:text-white text-lg">{meta.label}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{meta.blurb}</p>
                  </div>
                  <button
                    onClick={() => handleOpenCreate(type)}
                    className="inline-flex items-center justify-center px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white text-xs font-bold rounded-xl transition-all flex-shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Version
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {!current ? (
                    <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm">
                      No {meta.label} rule configured yet.
                    </div>
                  ) : (
                    <>
                      {/* Current version */}
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/25 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full uppercase">
                            {current.effective_from <= today ? "Current" : "Upcoming"} — Effective{" "}
                            {new Date(current.effective_from).toLocaleDateString()}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenEdit(current)}
                              className="p-1.5 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(current.id)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {type === "INCOME_TAX" ? (
                          <div className="space-y-3">
                            <p className="text-sm text-zinc-700 dark:text-zinc-300">
                              Tax-free up to{" "}
                              <span className="font-bold">{currency(current.value_json?.exemption_threshold ?? 0)}</span>
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                                    <th className="py-1.5 pr-3 font-bold">Range</th>
                                    <th className="py-1.5 pr-3 font-bold">Base</th>
                                    <th className="py-1.5 font-bold">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(current.value_json?.slabs || []).map((slab: IncomeTaxSlab, i: number) => (
                                    <tr key={i} className="border-t border-zinc-200/60 dark:border-zinc-800/60">
                                      <td className="py-1.5 pr-3 text-zinc-700 dark:text-zinc-300">
                                        {currency(slab.min)} – {slab.max === null ? "and above" : currency(slab.max)}
                                      </td>
                                      <td className="py-1.5 pr-3 text-zinc-700 dark:text-zinc-300">
                                        {currency(slab.fixed_amount)}
                                      </td>
                                      <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{slab.rate_percent}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employer</p>
                              <p className="text-xl font-black text-zinc-900 dark:text-white">
                                {current.value_json?.employer_percent}%
                              </p>
                            </div>
                            {type === "EOBI" && (
                              <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</p>
                                <p className="text-xl font-black text-zinc-900 dark:text-white">
                                  {current.value_json?.employee_percent}%
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Wage Base</p>
                              <p className="text-xl font-black text-zinc-900 dark:text-white">
                                {currency(current.value_json?.wage_base_amount ?? 0)}
                              </p>
                            </div>
                          </div>
                        )}
                        {current.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">{current.description}</p>
                        )}
                      </div>

                      {/* History */}
                      {history.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            <History className="h-3 w-3" />
                            Earlier versions
                          </div>
                          <div className="space-y-1.5">
                            {history.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center justify-between px-3 py-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500 dark:text-zinc-400"
                              >
                                <span>Effective {new Date(v.effective_from).toLocaleDateString()}</span>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleOpenEdit(v)}
                                    className="p-1 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(v.id)}
                                    className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <form onSubmit={handleSave}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingId ? "Edit" : "Add"} {RULE_TYPE_META[modalRuleType].label} Version
                </h3>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Effective From
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>

                {modalRuleType === "INCOME_TAX" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Exemption Threshold (Rs.)
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        value={exemptionThreshold}
                        onChange={(e) => setExemptionThreshold(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          Slabs
                        </label>
                        <button
                          type="button"
                          onClick={addSlabRow}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          + Add row
                        </button>
                      </div>
                      <div className="space-y-2">
                        {slabs.map((slab, i) => (
                          <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                            <input
                              type="number"
                              placeholder="Min"
                              required
                              className="col-span-3 h-9 px-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
                              value={slab.min}
                              onChange={(e) => handleSlabChange(i, "min", e.target.value)}
                            />
                            <input
                              type="number"
                              placeholder="Max (blank = ∞)"
                              className="col-span-3 h-9 px-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
                              value={slab.max ?? ""}
                              onChange={(e) => handleSlabChange(i, "max", e.target.value)}
                            />
                            <input
                              type="number"
                              placeholder="Fixed"
                              required
                              className="col-span-3 h-9 px-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
                              value={slab.fixed_amount}
                              onChange={(e) => handleSlabChange(i, "fixed_amount", e.target.value)}
                            />
                            <input
                              type="number"
                              placeholder="Rate %"
                              required
                              className="col-span-2 h-9 px-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
                              value={slab.rate_percent}
                              onChange={(e) => handleSlabChange(i, "rate_percent", e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeSlabRow(i)}
                              disabled={slabs.length === 1}
                              className="col-span-1 h-9 flex items-center justify-center text-zinc-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        Each slab's min must pick up right after the previous slab's max. Leave the last row's max blank for the top bracket.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Employer %
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min={0}
                        className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        value={employerPercent}
                        onChange={(e) => setEmployerPercent(e.target.value)}
                      />
                    </div>
                    {modalRuleType === "EOBI" && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          Employee %
                        </label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min={0}
                          className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                          value={employeePercent}
                          onChange={(e) => setEmployeePercent(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Wage Base (Rs.)
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        value={wageBaseAmount}
                        onChange={(e) => setWageBaseAmount(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
