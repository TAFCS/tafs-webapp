"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, BadgeCheck, Building2, CheckCircle2, ChevronDown, Layers, Search, X } from "lucide-react";
import {
  EmployeeProfile, EmployeeStatus, EmploymentSubtype, EMPLOYEE_STATUS_OPTIONS, EMPLOYMENT_SUBTYPE_OPTIONS,
} from "@/lib/hr.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";

/**
 * The Employee Directory's filters (search, campus, department, category,
 * segment, status, subtype, sort), shared so other pages that pick employees —
 * e.g. custom payroll (TAFSD-271) — filter and sort consistently.
 */

export type SubtypeFilter = EmploymentSubtype | "UNCLASSIFIED";

export type EmployeeSortOption =
  | "default"
  | "name_asc"
  | "name_desc"
  | "join_date_desc"
  | "join_date_asc"
  | "code_asc"
  | "recently_added";

export const EMPLOYEE_SORT_OPTIONS: { id: EmployeeSortOption; label: string; sub?: string }[] = [
  { id: "default", label: "Default", sub: "Standard order" },
  { id: "name_asc", label: "Name (A – Z)", sub: "Alphabetical" },
  { id: "name_desc", label: "Name (Z – A)", sub: "Reverse alphabetical" },
  { id: "join_date_desc", label: "Latest Joinee", sub: "Most recently joined" },
  { id: "join_date_asc", label: "Oldest Joinee", sub: "Earliest joined" },
  { id: "code_asc", label: "Employee Code", sub: "Ascending code" },
  { id: "recently_added", label: "Recently Added", sub: "Newest profile" },
];

function getJoinDateTime(emp: EmployeeProfile): number | null {
  if (!emp.join_date) return null;
  const t = new Date(emp.join_date).getTime();
  return isNaN(t) ? null : t;
}

const toggleId = <T extends string | number>(prev: T[], id: T): T[] =>
  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];

export const STATUS_OPTIONS: { id: EmployeeStatus; label: string }[] = EMPLOYEE_STATUS_OPTIONS.map((o) => ({ id: o.value, label: o.label }));
// TAFSD-275: sub-status under ACTIVE. "Unclassified" matches rows where the
// subtype column is null (ACTIVE employees who haven't been labelled yet).
export const SUBTYPE_OPTIONS: { id: SubtypeFilter; label: string }[] = [
  ...EMPLOYMENT_SUBTYPE_OPTIONS.map((o) => ({ id: o.value as SubtypeFilter, label: o.label })),
  { id: "UNCLASSIFIED", label: "UNCLASSIFIED" },
];

export function useEmployeeDirectoryFilters(
  employees: EmployeeProfile[],
  initial?: {
    statuses?: EmployeeStatus[];
    subtypes?: SubtypeFilter[];
    sortBy?: EmployeeSortOption;
  },
) {
  const [search, setSearch] = useState("");
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<EmployeeStatus[]>(() => initial?.statuses ?? ["ACTIVE"]);
  const [subtypes, setSubtypes] = useState<SubtypeFilter[]>(() => initial?.subtypes ?? []);
  const [sortBy, setSortBy] = useState<EmployeeSortOption>(() => initial?.sortBy ?? "default");

  const campusOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => { if (e.campuses) map.set(e.campuses.id, e.campuses.campus_name); });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => { if (e.departments) map.set(e.departments.id, e.departments.name); });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees]);

  // Categories cascade from the department filter: with departments picked,
  // only those departments' categories are offered (TAFSD-276).
  const categoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => {
      const cat = e.staff_categories;
      if (!cat) return;
      // A category belongs to one department; fall back to the employee's own
      // department for a list response that leaves it out (TAFSD-368).
      const deptId = cat.department_id ?? e.department_id;
      if (departmentIds.length > 0 && (deptId == null || !departmentIds.includes(deptId))) return;
      map.set(cat.id, cat.name || cat.code);
    });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees, departmentIds]);

  // Picked categories that no longer belong to the picked departments are
  // ignored. Waits for the list to load so a selection restored on page load
  // survives.
  const activeCategoryIds = useMemo(() => {
    if (employees.length === 0) return categoryIds;
    const allowed = new Set(categoryOptions.map((o) => o.id));
    return categoryIds.filter((id) => allowed.has(id));
  }, [categoryIds, categoryOptions, employees.length]);

  const segmentOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => { if (e.segments) map.set(e.segments.id, e.segments.name); });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = employees.filter((emp) => {
      const empCampusId = emp.campus_id ?? emp.campuses?.id;
      const empDeptId = emp.department_id ?? emp.departments?.id;
      const empCatId = emp.staff_category_id ?? emp.staff_categories?.id;
      const empSegId = emp.segment_id ?? emp.segments?.id;
      if (campusIds.length > 0 && (empCampusId == null || !campusIds.includes(empCampusId))) return false;
      if (departmentIds.length > 0 && (empDeptId == null || !departmentIds.includes(empDeptId))) return false;
      if (activeCategoryIds.length > 0 && (empCatId == null || !activeCategoryIds.includes(empCatId))) return false;
      if (segmentIds.length > 0 && (empSegId == null || !segmentIds.includes(empSegId))) return false;
      if (statuses.length > 0 && !statuses.includes(emp.employment_status ?? "ACTIVE")) return false;
      // TAFSD-275: subtype filter only applies when the row is ACTIVE.
      // UNCLASSIFIED matches ACTIVE rows whose subtype is null.
      if (subtypes.length > 0) {
        if ((emp.employment_status ?? "ACTIVE") !== "ACTIVE") return false;
        const key = (emp.employment_subtype ?? "UNCLASSIFIED") as SubtypeFilter;
        if (!subtypes.includes(key)) return false;
      }
      if (q) {
        const name = (emp.full_name || emp.users?.full_name || "").toLowerCase();
        const code = (emp.employee_code || "").toLowerCase();
        const cnic = (emp.cnic || "").toLowerCase();
        const title = (emp.job_title || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !cnic.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "default") return result;

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "name_asc": {
          const nameA = (a.full_name || a.users?.full_name || `Profile #${a.id}`).trim();
          const nameB = (b.full_name || b.users?.full_name || `Profile #${b.id}`).trim();
          const diff = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
          return diff !== 0 ? diff : a.id - b.id;
        }
        case "name_desc": {
          const nameA = (a.full_name || a.users?.full_name || `Profile #${a.id}`).trim();
          const nameB = (b.full_name || b.users?.full_name || `Profile #${b.id}`).trim();
          const diff = nameB.localeCompare(nameA, undefined, { sensitivity: "base" });
          return diff !== 0 ? diff : a.id - b.id;
        }
        case "join_date_desc": {
          const tA = getJoinDateTime(a);
          const tB = getJoinDateTime(b);
          if (tA === null && tB === null) return a.id - b.id;
          if (tA === null) return 1;
          if (tB === null) return -1;
          if (tB !== tA) return tB - tA;
          return a.id - b.id;
        }
        case "join_date_asc": {
          const tA = getJoinDateTime(a);
          const tB = getJoinDateTime(b);
          if (tA === null && tB === null) return a.id - b.id;
          if (tA === null) return 1;
          if (tB === null) return -1;
          if (tA !== tB) return tA - tB;
          return a.id - b.id;
        }
        case "code_asc": {
          const codeA = (a.employee_code || "").trim();
          const codeB = (b.employee_code || "").trim();
          if (!codeA && !codeB) return a.id - b.id;
          if (!codeA) return 1;
          if (!codeB) return -1;
          const diff = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
          return diff !== 0 ? diff : a.id - b.id;
        }
        case "recently_added": {
          return b.id - a.id;
        }
        default:
          return 0;
      }
    });
  }, [employees, search, campusIds, departmentIds, activeCategoryIds, segmentIds, statuses, subtypes, sortBy]);

  const isFiltered =
    !!search || campusIds.length > 0 || departmentIds.length > 0 || activeCategoryIds.length > 0 || segmentIds.length > 0 ||
    (statuses.length > 0 && (statuses.length !== 1 || statuses[0] !== "ACTIVE")) || subtypes.length > 0 || sortBy !== "default";

  const clear = () => {
    setSearch(""); setCampusIds([]); setDepartmentIds([]); setCategoryIds([]); setSegmentIds([]);
    setStatuses(["ACTIVE"]); setSubtypes([]); setSortBy("default");
  };

  return {
    search, setSearch, campusIds, setCampusIds, departmentIds, setDepartmentIds, categoryIds: activeCategoryIds, setCategoryIds,
    segmentIds, setSegmentIds, statuses, setStatuses, subtypes, setSubtypes, sortBy, setSortBy,
    campusOptions, departmentOptions, categoryOptions, segmentOptions,
    filtered, isFiltered, clear,
  };
}

export type EmployeeDirectoryFilters = ReturnType<typeof useEmployeeDirectoryFilters>;

export function SortDropdown({
  value,
  onChange,
}: {
  value: EmployeeSortOption;
  onChange: (sort: EmployeeSortOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeOption = EMPLOYEE_SORT_OPTIONS.find((o) => o.id === value);
  const isSelected = value !== "default";

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
        <ArrowUpDown className="h-3 w-3" /> Sort
      </label>
      <div className="relative">
        <button
          type="button"
          id="filter-sort-by"
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl text-sm transition-all border shadow-sm
            ${isSelected
              ? "bg-primary/5 border-primary/30 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}
            hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10`}
        >
          <span className="truncate text-sm font-semibold">
            {isSelected ? activeOption?.label : "Sort by"}
          </span>
          <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
            {isSelected && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("default");
                }}
                title="Reset to default order"
                className="p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-2 w-60 left-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {EMPLOYEE_SORT_OPTIONS.map((opt) => {
              const active = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs text-left transition-colors
                    ${active
                      ? "bg-primary/10 text-primary font-bold dark:bg-primary/20"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="leading-tight font-semibold">{opt.label}</span>
                    {opt.sub && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">{opt.sub}</span>
                    )}
                  </div>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmployeeDirectoryFilterBar({
  filters: f,
  showSort = true,
  children,
  extraActive = false,
  onClearExtra,
}: {
  filters: EmployeeDirectoryFilters;
  /** Whether to render the sort dropdown. Defaults to true. */
  showSort?: boolean;
  /** Page-specific controls rendered after the shared dropdowns. */
  children?: React.ReactNode;
  /** Whether a page-specific filter is set, so "Clear Filters" shows. */
  extraActive?: boolean;
  onClearExtra?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by name, code, CNIC, or role..."
          value={f.search}
          onChange={(e) => f.setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-9 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
        />
        {f.search && (
          <button onClick={() => f.setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="w-[180px]">
        <FilterDropdown label="Campus" icon={Building2} value={f.campusIds} options={f.campusOptions} placeholder="All Campuses"
          onToggle={(id) => f.setCampusIds((prev) => toggleId(prev, id))} onClear={() => f.setCampusIds([])} />
      </div>
      <div className="w-[180px]">
        <FilterDropdown label="Department" icon={Building2} value={f.departmentIds} options={f.departmentOptions} placeholder="All Departments"
          onToggle={(id) => f.setDepartmentIds((prev) => toggleId(prev, id))} onClear={() => f.setDepartmentIds([])} />
      </div>
      <div className="w-[180px]">
        <FilterDropdown label="Category" icon={Layers} value={f.categoryIds} options={f.categoryOptions} placeholder="All Categories"
          onToggle={(id) => f.setCategoryIds((prev) => toggleId(prev, id))} onClear={() => f.setCategoryIds([])} />
      </div>
      <div className="w-[180px]">
        <FilterDropdown label="Segment" icon={Layers} value={f.segmentIds} options={f.segmentOptions} placeholder="All Segments"
          onToggle={(id) => f.setSegmentIds((prev) => toggleId(prev, id))} onClear={() => f.setSegmentIds([])} />
      </div>
      <div className="w-[180px]">
        <FilterDropdown label="Status" icon={BadgeCheck} value={f.statuses} options={STATUS_OPTIONS} placeholder="All Statuses"
          onToggle={(id) => f.setStatuses((prev) => toggleId(prev, id))} onClear={() => f.setStatuses([])} onSetValue={(ids) => f.setStatuses(ids)} />
      </div>
      <div className="w-[180px]">
        <FilterDropdown label="Subtype" icon={BadgeCheck} value={f.subtypes} options={SUBTYPE_OPTIONS} placeholder="All Subtypes"
          onToggle={(id) => f.setSubtypes((prev) => toggleId(prev, id))} onClear={() => f.setSubtypes([])} onSetValue={(ids) => f.setSubtypes(ids)} />
      </div>
      {showSort && (
        <div className="w-[180px]">
          <SortDropdown value={f.sortBy} onChange={f.setSortBy} />
        </div>
      )}

      {children}

      {(f.isFiltered || extraActive) && (
        <button
          onClick={() => { f.clear(); onClearExtra?.(); }}
          className="h-11 w-[180px] px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
