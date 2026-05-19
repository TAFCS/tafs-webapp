"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2, Loader2, Building, AlertCircle, CheckCircle2, Calendar, Coffee, GraduationCap } from "lucide-react";
import { hrService, CalendarDay } from "@/lib/hr.service";
import { campusesService, Campus } from "@/lib/campuses.service";

export default function CalendarPage() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    day_type: "HOLIDAY", // WORKDAY, HOLIDAY, WEEKEND
    description: "",
  });

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

  // Fetch calendar when campus selection changes
  useEffect(() => {
    if (selectedCampusId !== null) {
      fetchCalendar(selectedCampusId);
    }
  }, [selectedCampusId]);

  const fetchCalendar = async (campusId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrService.listCalendarDays(campusId);
      setCalendarDays(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch calendar days.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      day_type: "HOLIDAY",
      description: "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCampusId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await hrService.createCalendarDay({
        campus_id: selectedCampusId,
        date: formData.date,
        day_type: formData.day_type,
        description: formData.description,
      });
      setSuccess("Calendar day override added successfully.");
      setShowModal(false);
      fetchCalendar(selectedCampusId);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to add calendar day exception. Ensure the date is unique.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this calendar day override?")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deleteCalendarDay(id);
      setSuccess("Calendar override deleted successfully.");
      if (selectedCampusId !== null) fetchCalendar(selectedCampusId);
    } catch (err) {
      console.error(err);
      setError("Failed to delete calendar day.");
    }
  };

  const getDayTypeBadge = (type: string) => {
    switch (type) {
      case "WORKDAY":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400";
      case "HOLIDAY":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400";
      case "WEEKEND":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  const getDayTypeIcon = (type: string) => {
    switch (type) {
      case "WORKDAY":
        return <GraduationCap className="h-4 w-4 text-emerald-500" />;
      case "HOLIDAY":
        return <Coffee className="h-4 w-4 text-rose-500" />;
      default:
        return <Calendar className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Academic Calendar</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage academic dates, holidays, and weekly schedules</p>
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
            onClick={handleOpenCreate}
            disabled={selectedCampusId === null}
            className="inline-flex items-center justify-center h-10 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Calendar Day
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
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading calendar overrides...</p>
        </div>
      ) : calendarDays.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <CalendarDays className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Custom Calendar Days</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            There are no calendar exceptions or custom days added. Weekly schedule runs on default settings (Mon-Fri workdays, Sat-Sun weekends).
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
          >
            Add Exception Day
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Day Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Description</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {calendarDays.map((day) => (
                  <tr key={day.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getDayTypeBadge(day.day_type)}`}>
                        {getDayTypeIcon(day.day_type)}
                        {day.day_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                      {day.description || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(day.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                        title="Delete Override"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar Day Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSave}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Add Calendar Exception</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Override a standard working calendar date for the selected campus
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Day Status</label>
                  <select
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formData.day_type}
                    onChange={(e) => setFormData({ ...formData, day_type: e.target.value })}
                  >
                    <option value="WORKDAY">WORKDAY (Working Day)</option>
                    <option value="HOLIDAY">HOLIDAY (Closed / Official Holiday)</option>
                    <option value="WEEKEND">WEEKEND (Saturday/Sunday Off)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Eid-ul-Fitr, Parent Teacher Meeting"
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
