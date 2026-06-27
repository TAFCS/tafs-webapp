"use client";

import { useEffect, useState } from "react";
import { Layers, Tag, Loader2, AlertCircle, Info } from "lucide-react";
import { hrService, Department, STAFF_CATEGORY_OPTIONS } from "@/lib/hr.service";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await hrService.listDepartments();
        setDepartments(data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch departments.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-primary/10 rounded-2xl">
          <Layers className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Org Structure</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Reference list of departments and staff categories used on employee profiles
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-2xl p-4 text-sm dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-200">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p>
          Employees are defined by <strong>Department</strong>, <strong>Category</strong>, and <strong>Role</strong> on their profile.
          These lists are managed centrally — edit employees from the Employee Directory.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading…</p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Departments</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                {departments.length}
              </span>
            </div>

            {departments.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
                No departments found. Run the HR import script to seed the canonical departments.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm"
                  >
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base tracking-wide">
                      {dept.name}
                    </h3>
                    {dept.description && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                        {dept.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-violet-600" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Staff Categories</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600">
                {STAFF_CATEGORY_OPTIONS.length}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {STAFF_CATEGORY_OPTIONS.map((cat) => (
                <div
                  key={cat.value}
                  className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm"
                >
                  <h3 className="font-bold text-violet-700 dark:text-violet-300 text-sm tracking-wide">
                    {cat.label}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
