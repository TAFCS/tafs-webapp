"use client";

import { useEffect, useState } from "react";
import { Clock, Search, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { hrService, ClassAttendanceMode } from "@/lib/hr.service";
import api from "@/lib/api";

interface ClassItem {
  id: number;
  description: string;
  class_code: string;
  academic_system: string;
}

export default function ClassModesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [modes, setModes] = useState<ClassAttendanceMode[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all classes
      const classesRes = await api.get("/v1/classes");
      const classesData = classesRes.data?.data;
      setClasses(Array.isArray(classesData) ? classesData : []);

      // 2. Fetch all configured modes
      const modesData = await hrService.listClassAttendanceModes();
      setModes(modesData);
    } catch (err) {
      console.error(err);
      setError("Failed to load class attendance modes configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetMode = async (classId: number, mode: string) => {
    setSavingId(classId);
    setError(null);
    setSuccess(null);
    try {
      await hrService.setClassAttendanceMode({ class_id: classId, mode });
      setSuccess("Class attendance mode updated successfully.");
      
      // Refresh modes
      const modesData = await hrService.listClassAttendanceModes();
      setModes(modesData);
    } catch (err) {
      console.error(err);
      setError("Failed to update class attendance mode.");
    } finally {
      setSavingId(null);
    }
  };

  // Helper to find the mode for a class
  const getClassMode = (classId: number) => {
    const found = modes.find((m) => m.class_id === classId);
    return found ? found.mode : "NOT_SET (Default)";
  };

  // Filter classes based on search query
  const filteredClasses = classes.filter(
    (c) =>
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.class_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <Clock className="h-6 w-6 text-indigo-600" />
            Class Attendance Modes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure whether attendance for each class is tracked via Biometric Daily scan or Roll Call session.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="mt-3 md:mt-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border rounded-lg bg-white hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {/* Search Filter */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search classes by name or code..."
          className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Content */}
      {loading && classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm mt-2">Loading classes list...</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Class Code</th>
                  <th className="px-6 py-4">Class Name</th>
                  <th className="px-6 py-4">Academic System</th>
                  <th className="px-6 py-4">Attendance Mode</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      No classes found.
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((cls) => {
                    const currentMode = getClassMode(cls.id);
                    const isSaving = savingId === cls.id;
                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                          {cls.class_code}
                        </td>
                        <td className="px-6 py-4">
                          {cls.description}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {cls.academic_system}
                        </td>
                        <td className="px-6 py-4">
                          {currentMode === "BIOMETRIC_DAILY" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Biometric Daily
                            </span>
                          ) : currentMode === "ROLL_CALL_SESSION" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                              Roll Call Session
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Not Configured (Biometric Daily)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isSaving ? (
                              <Loader2 className="h-5 w-5 text-indigo-600 animate-spin mr-2" />
                            ) : (
                              <>
                                <button
                                  onClick={() => handleSetMode(cls.id, "BIOMETRIC_DAILY")}
                                  disabled={currentMode === "BIOMETRIC_DAILY"}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    currentMode === "BIOMETRIC_DAILY"
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                  }`}
                                >
                                  Use Biometric
                                </button>
                                <button
                                  onClick={() => handleSetMode(cls.id, "ROLL_CALL_SESSION")}
                                  disabled={currentMode === "ROLL_CALL_SESSION"}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    currentMode === "ROLL_CALL_SESSION"
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  }`}
                                >
                                  Use Roll Call
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
