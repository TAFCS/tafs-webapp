"use client";

import { useEffect, useState } from "react";
import { Layers, Plus, Edit2, Trash2, Loader2, FileText, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { hrService, Department, Designation } from "@/lib/hr.service";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Expanded department IDs for viewing designations
  const [expandedDepts, setExpandedDepts] = useState<Record<number, boolean>>({});

  // Department Form State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });

  // Designation Form State
  const [showDesModal, setShowDesModal] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState<number | null>(null);
  const [editingDesId, setEditingDesId] = useState<number | null>(null);
  const [desForm, setDesForm] = useState({ title: "", description: "" });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrService.listDepartments();
      setDepartments(data);
      // Auto-expand departments that have designations
      const expanded: Record<number, boolean> = {};
      data.forEach((d) => {
        if (d.designations && d.designations.length > 0) expanded[d.id] = true;
      });
      setExpandedDepts(expanded);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch departments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedDepts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Department actions
  const handleOpenCreateDept = () => {
    setEditingDeptId(null);
    setDeptForm({ name: "", description: "" });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (dept: Department) => {
    setEditingDeptId(dept.id);
    setDeptForm({ name: dept.name, description: dept.description || "" });
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingDeptId) {
        await hrService.updateDepartment(editingDeptId, deptForm);
        setSuccess("Department updated successfully.");
      } else {
        await hrService.createDepartment(deptForm);
        setSuccess("Department created successfully.");
      }
      setShowDeptModal(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError("Failed to save department.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm("Are you sure you want to delete this department? All child designations will also be deleted.")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deleteDepartment(id);
      setSuccess("Department deleted successfully.");
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to delete department.");
    }
  };

  // Designation actions
  const handleOpenCreateDes = (deptId: number) => {
    setTargetDeptId(deptId);
    setEditingDesId(null);
    setDesForm({ title: "", description: "" });
    setShowDesModal(true);
  };

  const handleOpenEditDes = (deptId: number, des: Designation) => {
    setTargetDeptId(deptId);
    setEditingDesId(des.id);
    setDesForm({ title: des.title, description: des.description || "" });
    setShowDesModal(true);
  };

  const handleSaveDes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetDeptId === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingDesId) {
        await hrService.updateDesignation(targetDeptId, editingDesId, desForm);
        setSuccess("Designation updated successfully.");
      } else {
        await hrService.createDesignation(targetDeptId, desForm);
        setSuccess("Designation created successfully.");
      }
      setShowDesModal(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError("Failed to save designation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDes = async (deptId: number, id: number) => {
    if (!confirm("Are you sure you want to delete this designation?")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deleteDesignation(deptId, id);
      setSuccess("Designation deleted successfully.");
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to delete designation.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Departments & Designations</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure organizational structural units and roles</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateDept}
          className="inline-flex items-center justify-center h-11 px-5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl shadow-sm transition-all active:scale-95 text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Department
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

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading structure...</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <Layers className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Departments Defined</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            Create departments first, then define roles/designations inside them.
          </p>
          <button
            onClick={handleOpenCreateDept}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
          >
            Create Department
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => {
            const isExpanded = expandedDepts[dept.id];
            return (
              <div
                key={dept.id}
                className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Department Header Row */}
                <div className="p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/15 transition-all">
                  <div className="flex items-center space-x-3 cursor-pointer" onClick={() => toggleExpand(dept.id)}>
                    <button className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-base">
                        {dept.name}
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {dept.designations?.length || 0} roles
                        </span>
                      </h3>
                      {dept.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {dept.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenCreateDes(dept.id)}
                      className="inline-flex items-center justify-center px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-all"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Role
                    </button>
                    <button
                      onClick={() => handleOpenEditDept(dept)}
                      className="p-1.5 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDept(dept.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Designations/Roles Sub-list */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {!dept.designations || dept.designations.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-4 text-center">No designation roles set for this department yet.</p>
                    ) : (
                      dept.designations.map((des) => (
                        <div key={des.id} className="py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all px-2 rounded-lg mt-1">
                          <div>
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                              {des.title}
                            </p>
                            {des.description && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {des.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenEditDes(dept.id, des)}
                              className="p-1 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDes(dept.id, des.id)}
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <form onSubmit={handleSaveDept}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingDeptId ? "Edit Department" : "Add Department"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Department Name</label>
                  <input
                    type="text"
                    required
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={3}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
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

      {/* Designation Modal */}
      {showDesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <form onSubmit={handleSaveDes}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingDesId ? "Edit Designation Role" : "Add Designation Role"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Role Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Teacher, HR Manager"
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                    value={desForm.title}
                    onChange={(e) => setDesForm({ ...desForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={3}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={desForm.description}
                    onChange={(e) => setDesForm({ ...desForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDesModal(false)}
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
