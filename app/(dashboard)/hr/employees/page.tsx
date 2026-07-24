"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Plus, Loader2, AlertCircle, CheckCircle2, Search, X,
  SlidersHorizontal, Building2, Briefcase, AlertTriangle, Phone,
} from "lucide-react";
import { hrService, EmployeeProfile, formatStaffCategory, EMPLOYEE_STATUS_OPTIONS, employeeStatusBadgeClass } from "@/lib/hr.service";
import { EmployeeDetailPanel } from "./_components/EmployeeDetailPanel";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];

function missingFields(emp: EmployeeProfile): string[] {
  const missing: string[] = [];
  if (!emp.cnic) missing.push("CNIC");
  if (!emp.join_date) missing.push("Date of Joining");
  if (emp.monthly_pay == null) missing.push("Monthly Pay");
  if (!emp.photo_url) missing.push("Photo");
  return missing;
}

function FilterSelect({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; icon?: React.ReactNode }) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{icon}</div>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-9 pr-3 text-[12px] font-medium text-zinc-700 bg-white border border-zinc-200 rounded-xl appearance-none outline-none hover:border-zinc-300 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${icon ? "pl-8" : "pl-3"}`}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function EmployeeCard({ employee, onClick }: { employee: EmployeeProfile; onClick: () => void }) {
  const name = employee.full_name || employee.users?.full_name || `Profile #${employee.id}`;
  const missing = missingFields(employee);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all duration-200 active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        {employee.photo_url ? (
          <img
            src={employee.photo_url.replace(/([^:])\/\//g, "$1/")}
            alt={name}
            className="h-11 w-11 rounded-xl object-cover bg-zinc-100 shrink-0"
          />
        ) : (
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${color}`}>
            {initials(name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-zinc-900 dark:text-white text-[14px] leading-tight truncate">{name}</p>
            {missing.length > 0 && (
              <div title={`Missing: ${missing.join(", ")}`}>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {employee.employee_code && (
              <span className="text-[11px] text-zinc-400 font-mono font-bold">{employee.employee_code}</span>
            )}
            {employee.cnic && <span className="text-[11px] text-zinc-400 font-mono">{employee.cnic}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`text-[10px] border rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight ${employeeStatusBadgeClass(employee.employment_status)}`}>
              {employee.employment_status ?? "ACTIVE"}
            </span>
            {employee.job_title && (
              <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                <Briefcase className="h-2.5 w-2.5" />{employee.job_title}
              </span>
            )}
            {employee.staff_categories && (
              <span className="flex items-center gap-1 text-[10px] bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900 text-violet-700 dark:text-violet-300 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                {formatStaffCategory(employee.staff_categories)}
              </span>
            )}
            {employee.departments?.name && (
              <span className="flex items-center gap-1 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                <Building2 className="h-2.5 w-2.5" />{employee.departments.name}
              </span>
            )}
            {employee.campuses?.campus_name && (
              <span className="flex items-center gap-1 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                <Building2 className="h-2.5 w-2.5" />{employee.campuses.campus_name}
              </span>
            )}
            {employee.personal_phone && (
              <span className="flex items-center gap-1 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-md px-1.5 py-0.5 font-bold tracking-tight">
                <Phone className="h-2.5 w-2.5" />{employee.personal_phone}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

const AUDIT_OPTIONS = [
  { value: "missing_cnic", label: "Missing CNIC" },
  { value: "missing_doj", label: "Missing Date of Joining" },
  { value: "missing_pay", label: "Missing Monthly Pay" },
  { value: "missing_photo", label: "No Photo" },
  { value: "incomplete", label: "Any Incomplete Field" },
];

function EmployeesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (idParam) {
      const parsedId = Number(idParam);
      if (!isNaN(parsedId) && parsedId > 0) {
        setSelectedId(parsedId);
      }
    }
  }, [idParam]);

  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [auditFilter, setAuditFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const empList = await hrService.listEmployees();
      setEmployees(empList);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const campusOptions = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach(e => { if (e.campuses) map.set(String(e.campuses.id), e.campuses.campus_name); });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach(e => { if (e.departments) map.set(String(e.departments.id), e.departments.name); });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [employees]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.staff_categories) {
        const cat = e.staff_categories;
        const name = cat.name || cat.code;
        map.set(String(cat.id), name);
      }
    });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(emp => {
      if (campusFilter && String(emp.campus_id) !== campusFilter && String(emp.campuses?.id) !== campusFilter) return false;
      if (departmentFilter && String(emp.department_id) !== departmentFilter && String(emp.departments?.id) !== departmentFilter) return false;
      if (categoryFilter && String(emp.staff_category_id) !== categoryFilter && String(emp.staff_categories?.id) !== categoryFilter) return false;
      if (statusFilter && (emp.employment_status ?? "ACTIVE") !== statusFilter) return false;

      if (q) {
        const name = (emp.full_name || emp.users?.full_name || "").toLowerCase();
        const code = (emp.employee_code || "").toLowerCase();
        const cnic = (emp.cnic || "").toLowerCase();
        const title = (emp.job_title || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !cnic.includes(q) && !title.includes(q)) return false;
      }

      if (auditFilter) {
        const missing = missingFields(emp);
        if (auditFilter === "missing_cnic" && !missing.includes("CNIC")) return false;
        if (auditFilter === "missing_doj" && !missing.includes("Date of Joining")) return false;
        if (auditFilter === "missing_pay" && !missing.includes("Monthly Pay")) return false;
        if (auditFilter === "missing_photo" && !missing.includes("Photo")) return false;
        if (auditFilter === "incomplete" && missing.length === 0) return false;
      }
      return true;
    });
  }, [employees, search, campusFilter, departmentFilter, categoryFilter, statusFilter, auditFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Employee Directory</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? "Manage workforce records and profile configurations" : <span><strong className="text-zinc-700 dark:text-zinc-300">{filteredEmployees.length}</strong> of {employees.length} employees</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-400 rounded-2xl p-4 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-2xl p-4 text-sm flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, code, CNIC, or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-9 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <FilterSelect label="All Campuses" value={campusFilter} onChange={setCampusFilter} options={campusOptions} icon={<Building2 className="h-3.5 w-3.5" />} />
        <FilterSelect label="All Departments" value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} icon={<Building2 className="h-3.5 w-3.5" />} />
        <FilterSelect
          label="ALL STATUSES"
          value={statusFilter}
          onChange={setStatusFilter}
          options={EMPLOYEE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <FilterSelect label="All Categories" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
        <FilterSelect label="Data Audit" value={auditFilter} onChange={setAuditFilter} options={AUDIT_OPTIONS} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} />

        {(search || campusFilter || departmentFilter || categoryFilter || statusFilter || auditFilter) && (
          <button
            onClick={() => { setSearch(""); setCampusFilter(""); setDepartmentFilter(""); setCategoryFilter(""); setStatusFilter(""); setAuditFilter(""); }}
            className="h-9 px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800/60 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <Users className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {employees.length === 0 ? "No Employee Profiles" : "No Matches Found"}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            {employees.length === 0
              ? "Get started by adding employee profiles. Each employee can be linked to a staff portal account."
              : "Try adjusting your search or filters."}
          </p>
          {employees.length === 0 && (
            <button
              onClick={() => router.push("/hr/employees/new")}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
            >
              Create First Profile
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredEmployees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedId(emp.id)} />
          ))}
        </div>
      )}

      <EmployeeDetailPanel
        employeeId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={fetchData}
        onDeleted={() => { setSuccess("Employee profile deleted successfully."); fetchData(); }}
      />
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading employee directory...</p>
        </div>
      }
    >
      <EmployeesContent />
    </Suspense>
  );
}
