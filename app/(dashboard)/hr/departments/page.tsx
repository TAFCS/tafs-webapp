"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layers,
  Tag,
  Loader2,
  AlertCircle,
  Info,
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  X,
import Link from "next/link";
import { hrService, Department, StaffCategory, EmployeeProfile } from "@/lib/hr.service";

type DeptForm = { name: string; description: string };
type CatForm = { code: string; name: string; description: string };

const emptyDept: DeptForm = { name: "", description: "" };
const emptyCat: CatForm = { code: "", name: "", description: "" };

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return msg || fallback;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [expandedDeptEmps, setExpandedDeptEmps] = useState<Set<number>>(new Set());

  const [deptModal, setDeptModal] = useState<"create" | { edit: Department } | null>(null);
  const [deptForm, setDeptForm] = useState<DeptForm>(emptyDept);

  const [catModal, setCatModal] = useState<
    | { create: Department }
    | { edit: StaffCategory; department: Department }
    | null
  >(null);
  const [catForm, setCatForm] = useState<CatForm>(emptyCat);

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "department"; department: Department }
    | { type: "category"; department: Department; category: StaffCategory }
    | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptData, empData] = await Promise.all([
        hrService.listDepartments(),
        hrService.listEmployees(),
      ]);
      setDepartments(deptData);
      setEmployees(empData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch departments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const employeesByCat = useMemo(() => {
    const map = new Map<number, EmployeeProfile[]>();
    for (const emp of employees) {
      if (emp.staff_category_id) {
        const list = map.get(emp.staff_category_id) || [];
        list.push(emp);
        map.set(emp.staff_category_id, list);
      }
    }
    return map;
  }, [employees]);

  const employeesByDept = useMemo(() => {
    const map = new Map<number, EmployeeProfile[]>();
    for (const emp of employees) {
      if (emp.department_id) {
        const list = map.get(emp.department_id) || [];
        list.push(emp);
        map.set(emp.department_id, list);
      }
    }
    return map;
  }, [employees]);

  function toggleExpandedCat(catId: number) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function toggleExpandedDeptEmps(deptId: number) {
    setExpandedDeptEmps((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  }

  const totalCategories = useMemo(
    () => departments.reduce((sum, d) => sum + (d.staff_categories?.length ?? 0), 0),
    [departments],
  );

  function openCreateDept() {
    setDeptForm(emptyDept);
    setDeptModal("create");
  }

  function openEditDept(dept: Department) {
    setDeptForm({ name: dept.name, description: dept.description ?? "" });
    setDeptModal({ edit: dept });
  }

  function openCreateCat(dept: Department) {
    setCatForm(emptyCat);
    setCatModal({ create: dept });
  }

  function openEditCat(dept: Department, cat: StaffCategory) {
    setCatForm({ code: cat.code, name: cat.name, description: cat.description ?? "" });
    setCatModal({ edit: cat, department: dept });
  }

  async function saveDepartment() {
    if (!deptForm.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (deptModal === "create") {
        await hrService.createDepartment({
          name: deptForm.name.trim(),
          description: deptForm.description.trim() || undefined,
        });
      } else if (deptModal && "edit" in deptModal) {
        await hrService.updateDepartment(deptModal.edit.id, {
          name: deptForm.name.trim(),
          description: deptForm.description.trim() || undefined,
        });
      }
      setDeptModal(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save department."));
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory() {
    if (!catModal || !catForm.name.trim() || !catForm.code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if ("create" in catModal) {
        await hrService.createStaffCategory(catModal.create.id, {
          code: catForm.code.trim(),
          name: catForm.name.trim(),
          description: catForm.description.trim() || undefined,
        });
        setExpanded((prev) => new Set(prev).add(catModal.create.id));
      } else {
        await hrService.updateStaffCategory(catModal.department.id, catModal.edit.id, {
          code: catForm.code.trim(),
          name: catForm.name.trim(),
          description: catForm.description.trim() || undefined,
        });
      }
      setCatModal(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save staff category."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      if (deleteTarget.type === "department") {
        await hrService.deleteDepartment(deleteTarget.department.id);
      } else {
        await hrService.deleteStaffCategory(deleteTarget.department.id, deleteTarget.category.id);
      }
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete."));
    } finally {
      setBusy(false);
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const deleteBlockedCount =
    deleteTarget?.type === "department"
      ? deleteTarget.department._count?.employee_profiles ?? 0
      : deleteTarget?.type === "category"
        ? deleteTarget.category._count?.employee_profiles ?? 0
        : 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Org Structure</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Departments and their subcategories used on employee profiles
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateDept}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add department
        </button>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-2xl p-4 text-sm dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-200">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p>
          Employees are assigned a <strong>Department</strong>, then a <strong>subcategory</strong> belonging to that department.
          Delete is blocked while employees are still assigned — reassign them in the Employee Directory first.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading…</p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Departments</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {departments.length}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600">
              {totalCategories} subcategories
            </span>
          </div>

          {departments.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
              No departments yet. Add one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {departments.map((dept) => {
                const isOpen = expanded.has(dept.id);
                const isDeptEmpsOpen = expandedDeptEmps.has(dept.id);
                const deptEmployees = employeesByDept.get(dept.id) ?? [];
                const empCount = Math.max(dept._count?.employee_profiles ?? 0, deptEmployees.length);
                const cats = dept.staff_categories ?? [];
                return (
                  <div
                    key={dept.id}
                    className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div className="flex items-start gap-3 p-5">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(dept.id)}
                        className="mt-0.5 p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-zinc-900 dark:text-white text-base tracking-wide">
                            {dept.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => toggleExpandedDeptEmps(dept.id)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                              isDeptEmpsOpen
                                ? "bg-primary/10 text-primary"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            <Users className="h-3 w-3" />
                            {empCount} employee{empCount === 1 ? "" : "s"}
                            {isDeptEmpsOpen ? <ChevronDown className="h-3 w-3 ml-0.5" /> : <ChevronRight className="h-3 w-3 ml-0.5" />}
                          </button>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600">
                            {cats.length} subcategor{cats.length === 1 ? "y" : "ies"}
                          </span>
                        </div>
                        {dept.description && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                            {dept.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openCreateCat(dept)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Category
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditDept(dept)}
                          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          aria-label="Edit department"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: "department", department: dept })}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          aria-label="Delete department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isDeptEmpsOpen && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 bg-violet-50/30 dark:bg-violet-950/20 px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            All Department Employees ({deptEmployees.length})
                          </div>
                        </div>
                        {deptEmployees.length === 0 ? (
                          <p className="text-xs text-zinc-400 italic">No employees found in this department.</p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {deptEmployees.map((emp) => (
                              <Link
                                key={emp.id}
                                href={`/hr/employees?id=${emp.id}`}
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-primary/50 hover:shadow transition-all group cursor-pointer"
                              >
                                {emp.photo_url ? (
                                  <img
                                    src={emp.photo_url}
                                    alt={emp.full_name || "Employee"}
                                    className="h-8 w-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0">
                                    {(emp.full_name || "E").charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-zinc-900 dark:text-white text-xs group-hover:text-primary transition-colors truncate">
                                    {emp.full_name || emp.users?.full_name || "Unnamed Employee"}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                                    {emp.employee_code && (
                                      <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded text-[10px]">
                                        {emp.employee_code}
                                      </span>
                                    )}
                                    {emp.job_title && <span className="truncate">{emp.job_title}</span>}
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isOpen && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/30 px-5 py-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <Tag className="h-3.5 w-3.5 text-violet-600" />
                          Subcategories
                        </div>
                        {cats.length === 0 ? (
                          <p className="text-sm text-zinc-500 py-2">No subcategories yet for this department.</p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {cats.map((cat) => {
                              const catEmployees = employeesByCat.get(cat.id) ?? [];
                              const catCount = Math.max(cat._count?.employee_profiles ?? 0, catEmployees.length);
                              const isCatOpen = expandedCats.has(cat.id);
                              return (
                                <div
                                  key={cat.id}
                                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-3.5 space-y-3"
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="flex-1 min-w-0 cursor-pointer"
                                      onClick={() => toggleExpandedCat(cat.id)}
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold text-violet-700 dark:text-violet-300 text-sm tracking-wide">
                                          {cat.name}
                                        </h4>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpandedCat(cat.id);
                                          }}
                                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                                            isCatOpen
                                              ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300"
                                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                          }`}
                                        >
                                          <Users className="h-3 w-3" />
                                          {catCount}
                                          {isCatOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </button>
                                      </div>
                                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">{cat.code}</p>
                                      {cat.description && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                          {cat.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openEditCat(dept, cat)}
                                        className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        aria-label="Edit category"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDeleteTarget({ type: "category", department: dept, category: cat })
                                        }
                                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                        aria-label="Delete category"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {isCatOpen && (
                                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                                        Assigned Employees ({catEmployees.length})
                                      </div>
                                      {catEmployees.length === 0 ? (
                                        <p className="text-xs text-zinc-400 italic py-1">No employees assigned to this subcategory.</p>
                                      ) : (
                                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                          {catEmployees.map((emp) => (
                                            <Link
                                              key={emp.id}
                                              href={`/hr/employees?id=${emp.id}`}
                                              className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs hover:bg-violet-50/60 dark:hover:bg-violet-950/40 hover:border-violet-200 dark:hover:border-violet-800/60 transition-all group cursor-pointer"
                                            >
                                              {emp.photo_url ? (
                                                <img
                                                  src={emp.photo_url}
                                                  alt={emp.full_name || "Employee"}
                                                  className="h-7 w-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
                                                />
                                              ) : (
                                                <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                                                  {(emp.full_name || "E").charAt(0).toUpperCase()}
                                                </div>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-zinc-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors truncate">
                                                  {emp.full_name || emp.users?.full_name || "Unnamed Employee"}
                                                </div>
                                                <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
                                                  {emp.employee_code && (
                                                    <span className="font-mono bg-zinc-200/60 dark:bg-zinc-700/60 px-1 py-0.2 rounded text-[10px]">
                                                      {emp.employee_code}
                                                    </span>
                                                  )}
                                                  {emp.job_title && <span className="truncate">{emp.job_title}</span>}
                                                </div>
                                              </div>
                                            </Link>
                                          ))}
                                        </div>
                                      )}
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Department modal */}
      {deptModal && (
        <Modal
          title={deptModal === "create" ? "Add department" : "Edit department"}
          onClose={() => setDeptModal(null)}
          onSubmit={saveDepartment}
          busy={busy}
          submitLabel={deptModal === "create" ? "Create" : "Save"}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Name</span>
            <input
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={deptForm.name}
              onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. ACADEMICS"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Description</span>
            <textarea
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm min-h-[80px]"
              value={deptForm.description}
              onChange={(e) => setDeptForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
            />
          </label>
        </Modal>
      )}

      {/* Category modal */}
      {catModal && (
        <Modal
          title={"create" in catModal ? `Add subcategory — ${catModal.create.name}` : `Edit subcategory — ${catModal.department.name}`}
          onClose={() => setCatModal(null)}
          onSubmit={saveCategory}
          busy={busy}
          submitLabel={"create" in catModal ? "Create" : "Save"}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Code</span>
            <input
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
              value={catForm.code}
              onChange={(e) => setCatForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
              placeholder="e.g. TEACHER"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Name</span>
            <input
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={catForm.name}
              onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. TEACHER"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Description</span>
            <textarea
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm min-h-[80px]"
              value={catForm.description}
              onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
            />
          </label>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal
          title={deleteTarget.type === "department" ? "Delete department?" : "Delete subcategory?"}
          onClose={() => setDeleteTarget(null)}
          onSubmit={confirmDelete}
          busy={busy}
          submitLabel="Delete"
          submitDanger
          submitDisabled={deleteBlockedCount > 0}
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {deleteTarget.type === "department" ? (
              <>
                Delete <strong>{deleteTarget.department.name}</strong>
                {(deleteTarget.department.staff_categories?.length ?? 0) > 0
                  ? ` and its ${deleteTarget.department.staff_categories!.length} subcategor${deleteTarget.department.staff_categories!.length === 1 ? "y" : "ies"}`
                  : ""}
                ?
              </>
            ) : (
              <>
                Delete <strong>{deleteTarget.category.name}</strong> from{" "}
                <strong>{deleteTarget.department.name}</strong>?
              </>
            )}
          </p>
          {deleteBlockedCount > 0 ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {deleteBlockedCount} employee{deleteBlockedCount === 1 ? "" : "s"} still assigned. Reassign them in the
              Employee Directory before deleting.
            </p>
          ) : (
            <p className="text-sm text-zinc-500">This cannot be undone.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  onSubmit,
  busy,
  submitLabel,
  submitDanger,
  submitDisabled,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  submitDanger?: boolean;
  submitDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || submitDisabled}
            onClick={onSubmit}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              submitDanger ? "bg-rose-600 hover:bg-rose-700" : "bg-primary hover:bg-primary/90"
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
