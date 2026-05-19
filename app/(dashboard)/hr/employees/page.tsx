"use client";

import { useAuthState } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { Users, Plus, Edit2, Trash2, Loader2, Link as LinkIcon, Calendar, Briefcase, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { hrService, EmployeeProfile, Department, Designation } from "@/lib/hr.service";

export default function EmployeesPage() {
  const { user } = useAuthState();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    user_id: "",
    cnic: "",
    join_date: "",
    employment_type: "Full-time",
    department_id: "",
    designation_id: "",
    reporting_manager_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empList, usersList, deptsList] = await Promise.all([
        hrService.listEmployees(),
        hrService.getUnlinkedUsers(),
        hrService.listDepartments(),
      ]);
      setEmployees(empList);
      setUnlinkedUsers(usersList);
      setDepartments(deptsList);
      
      // Flatten all designations for easy lookup
      const allDesg = deptsList.reduce((acc: Designation[], dept) => {
        if (dept.designations) acc.push(...dept.designations);
        return acc;
      }, []);
      setDesignations(allDesg);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch employees and related data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      user_id: "",
      cnic: "",
      join_date: new Date().toISOString().split("T")[0],
      employment_type: "Full-time",
      department_id: "",
      designation_id: "",
      reporting_manager_id: "",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (emp: EmployeeProfile) => {
    setEditingId(emp.id);
    setFormData({
      user_id: emp.user_id || "",
      cnic: emp.cnic || "",
      join_date: emp.join_date ? new Date(emp.join_date).toISOString().split("T")[0] : "",
      employment_type: emp.employment_type || "Full-time",
      department_id: emp.department_id ? String(emp.department_id) : "",
      designation_id: emp.designation_id ? String(emp.designation_id) : "",
      reporting_manager_id: emp.reporting_manager_id ? String(emp.reporting_manager_id) : "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      user_id: formData.user_id || undefined,
      cnic: formData.cnic || undefined,
      join_date: formData.join_date || undefined,
      employment_type: formData.employment_type || undefined,
      department_id: formData.department_id ? parseInt(formData.department_id, 10) : undefined,
      designation_id: formData.designation_id ? parseInt(formData.designation_id, 10) : undefined,
      reporting_manager_id: formData.reporting_manager_id ? parseInt(formData.reporting_manager_id, 10) : undefined,
    };

    try {
      if (editingId) {
        await hrService.updateEmployee(editingId, payload);
        setSuccess("Employee profile updated successfully.");
      } else {
        await hrService.createEmployee(payload);
        setSuccess("Employee profile created and linked successfully.");
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save employee profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this employee profile?")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deleteEmployee(id);
      setSuccess("Employee profile deleted successfully.");
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to delete employee profile.");
    }
  };

  // Helper to filter designations based on selected department
  const filteredDesignations = designations.filter(
    (d) => !formData.department_id || d.department_id === parseInt(formData.department_id, 10)
  );

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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage workforce records and profile configurations</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center h-11 px-5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl shadow-sm transition-all active:scale-95 text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Employee Profile
        </button>
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
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading employees directory...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <Users className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Employee Profiles</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            Get started by adding employee profiles and linking them to active portal users.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
          >
            Create First Profile
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Name / User</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Department</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Designation</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">CNIC</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Employment</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-primary/5 rounded-xl flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {emp.users?.full_name || "Unlinked Staff Profile"}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {emp.users?.email || "No system account"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {emp.departments?.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {emp.designations?.title || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {emp.cnic || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                        {emp.employment_type || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Edit Profile"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                          title="Delete Profile"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSave}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingId ? "Edit Employee Profile" : "Add Employee Profile"}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {editingId ? "Update existing staff workforce information" : "Create new HR profile and link to user account"}
                </p>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* User Link Dropdown (Only for Creation or optionally updating) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Link User Account
                  </label>
                  <select
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  >
                    <option value="">-- Choose User (Optional) --</option>
                    {/* Add current editing user if exists so they don't get lost */}
                    {editingId && employees.find(e => e.id === editingId)?.users && (
                      <option value={employees.find(e => e.id === editingId)?.user_id || ""}>
                        {employees.find(e => e.id === editingId)?.users?.full_name} (Current)
                      </option>
                    )}
                    {unlinkedUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email} - {u.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* CNIC */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    CNIC / ID Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 42101-1234567-1"
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Join Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Join Date
                    </label>
                    <input
                      type="date"
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={formData.join_date}
                      onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                    />
                  </div>

                  {/* Employment Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Employment Type
                    </label>
                    <select
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Department */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Department
                    </label>
                    <select
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value, designation_id: "" })}
                    >
                      <option value="">-- Choose Department --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Designation */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Designation
                    </label>
                    <select
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      value={formData.designation_id}
                      onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                      disabled={!formData.department_id}
                    >
                      <option value="">-- Choose Designation --</option>
                      {filteredDesignations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reporting Manager */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Reporting Manager
                  </label>
                  <select
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formData.reporting_manager_id}
                    onChange={(e) => setFormData({ ...formData, reporting_manager_id: e.target.value })}
                  >
                    <option value="">-- Choose Manager --</option>
                    {employees
                      .filter((e) => e.id !== editingId) // Can't report to self
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.users?.full_name || `Profile #${e.id}`} ({e.designations?.title || "Staff"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 h-11 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
