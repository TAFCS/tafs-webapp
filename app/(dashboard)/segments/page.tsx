"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Layers,
  Search,
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  Hash,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Building2,
  Check,
  X,
  Sparkles,
  School,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  hrService,
  Segment,
  AvailableClass,
  SegmentStaff,
} from "@/lib/hr.service";
import { campusesService, Campus } from "@/lib/campuses.service";
import { formatEmployeeCodeDisplay } from "@/lib/employee-code";
import { useSegmentsAccess } from "@/hooks/use-segments-access";

export default function SegmentsPage() {
  const access = useSegmentsAccess();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<Set<number>>(new Set());

  // Modal states
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [deletingSegment, setDeletingSegment] = useState<Segment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formOrder, setFormOrder] = useState<number>(0);
  const [formSelectedClassIds, setFormSelectedClassIds] = useState<number[]>([]);
  const [classFilterQuery, setClassFilterQuery] = useState("");

  // Load campuses once
  useEffect(() => {
    (async () => {
      try {
        const campusList = await campusesService.list();
        setCampuses(campusList);
      } catch (err) {
        console.error("Failed to load campuses:", err);
      }
    })();
  }, []);

  // Fetch segments when selectedCampusId changes
  const fetchSegments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await hrService.listSegments(selectedCampusId);
      setSegments(data);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load segments.";
      setError(typeof msg === "string" ? msg : "Failed to load segments.");
      toast.error("Failed to load segments");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCampusId]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  // Load available classes for creation / editing
  const loadAvailableClasses = async () => {
    setIsLoadingClasses(true);
    try {
      const data = await hrService.listAvailableClasses();
      setAvailableClasses(data);
    } catch (err) {
      console.error("Failed to load classes:", err);
      toast.error("Failed to load classes for assignment");
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSegmentIds(new Set(segments.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedSegmentIds(new Set());
  };

  // Open Create Modal
  const openCreateModal = async () => {
    setFormName("");
    setFormCode("");
    setFormOrder(segments.length + 1);
    setFormSelectedClassIds([]);
    setClassFilterQuery("");
    setIsCreateModalOpen(true);
    await loadAvailableClasses();
  };

  // Open Edit Modal
  const openEditModal = async (segment: Segment) => {
    setEditingSegment(segment);
    setFormName(segment.name);
    setFormCode(segment.code);
    setFormOrder(segment.display_order);
    setFormSelectedClassIds(segment.classes?.map((c) => c.id) || []);
    setClassFilterQuery("");
    await loadAvailableClasses();
  };

  // Handle Create or Update Submit
  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!access.can(editingSegment ? "edit" : "create")) {
      toast.error("You do not have permission to save this segment.");
      return;
    }
    if (!formName.trim() || !formCode.trim()) {
      toast.error("Please enter both a name and code for the segment.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSegment) {
        await hrService.updateSegment(editingSegment.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          display_order: Number(formOrder) || 0,
          class_ids: formSelectedClassIds,
        });
        toast.success(`Segment "${formName}" updated successfully`);
        setEditingSegment(null);
      } else {
        await hrService.createSegment({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          display_order: Number(formOrder) || 0,
          class_ids: formSelectedClassIds,
        });
        toast.success(`Segment "${formName}" created successfully`);
        setIsCreateModalOpen(false);
      }
      await fetchSegments();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.message === "string" ? err.message : "Failed to save segment");
      toast.error(typeof msg === "string" ? msg : "Failed to save segment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteSegment = async () => {
    if (!deletingSegment) return;
    if (!access.can("delete")) {
      toast.error("You do not have permission to delete this segment.");
      return;
    }
    setIsSubmitting(true);
    try {
      await hrService.deleteSegment(deletingSegment.id);
      toast.success(`Segment "${deletingSegment.name}" deleted successfully`);
      setDeletingSegment(null);
      await fetchSegments();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.message === "string" ? err.message : "Failed to delete segment");
      toast.error(typeof msg === "string" ? msg : "Failed to delete segment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSegments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => {
      const matchNameOrCode =
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      const matchClass = s.classes?.some(
        (c) =>
          c.description.toLowerCase().includes(q) ||
          c.class_code.toLowerCase().includes(q),
      );
      const matchStaff = s.staff?.some(
        (st) =>
          st.full_name?.toLowerCase().includes(q) ||
          st.employee_code?.toLowerCase().includes(q) ||
          st.job_title?.toLowerCase().includes(q),
      );
      return matchNameOrCode || matchClass || matchStaff;
    });
  }, [segments, searchTerm]);

  const totalClasses = useMemo(
    () => segments.reduce((sum, s) => sum + (s._count?.classes ?? 0), 0),
    [segments],
  );
  const totalStaff = useMemo(
    () => segments.reduce((sum, s) => sum + (s._count?.employee_profiles ?? 0), 0),
    [segments],
  );

  const filteredModalClasses = useMemo(() => {
    const q = classFilterQuery.trim().toLowerCase();
    if (!q) return availableClasses;
    return availableClasses.filter(
      (c) =>
        c.description.toLowerCase().includes(q) ||
        c.class_code.toLowerCase().includes(q) ||
        c.academic_system.toLowerCase().includes(q),
    );
  }, [availableClasses, classFilterQuery]);

  const toggleClassSelection = (classId: number) => {
    setFormSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 mt-4 px-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[18px] flex items-center justify-center shadow-xl shadow-zinc-200 dark:shadow-none">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Segments & Wings
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Academic wings grouping classes and allocated staff per campus.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {access.can("create") && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-sm rounded-2xl transition-all shadow-md active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Create Segment
            </button>
          )}
        </div>
      </div>

      {/* Controls: Campus Filter, Search, Expand All */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {/* Campus Filter */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-zinc-400 shrink-0 ml-1" />
          <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
            Campus:
          </span>
          <select
            value={selectedCampusId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCampusId(val ? Number(val) : null);
            }}
            className="h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all cursor-pointer"
          >
            <option value="">All Campuses (Aggregated)</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.campus_name} ({c.campus_code})
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar & Accordion toggles */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search segments, classes, staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full pl-10 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-3">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* Summary Tiles */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryTile
            label="Segments"
            value={segments.length}
            icon={Layers}
            hint={selectedCampusId ? "Campus segments" : "Total configured"}
          />
          <SummaryTile
            label="Allocated Classes"
            value={totalClasses}
            icon={BookOpen}
            hint={selectedCampusId ? "Active on campus" : "Across all wings"}
          />
          <SummaryTile
            label="Allocated Staff"
            value={totalStaff}
            icon={Users}
            hint={selectedCampusId ? "On this campus" : "Wing members & teachers"}
          />
        </div>
      )}

      {/* Body: Segments Accordion List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 text-zinc-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-900 dark:text-zinc-100" />
          <p className="text-xs font-bold tracking-wide uppercase text-zinc-400">
            Loading segments & allocations...
          </p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 px-5 py-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="py-24 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-[32px] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="h-14 w-14 bg-white dark:bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <Layers className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
          </div>
          <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
            {segments.length === 0 ? "No segments configured" : "No matching segments"}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-1 text-xs max-w-sm mx-auto">
            {segments.length === 0
              ? "Create your first academic segment (e.g. Primary Wing, Senior Wing) to group classes and allocate staff."
              : "Try adjusting your search filter or campus selection."}
          </p>
          {segments.length === 0 && access.can("create") && (
            <>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold rounded-xl"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Segment
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSegments.map((segment) => {
            const isExpanded = expandedSegmentIds.has(segment.id);
            const classesCount = segment.classes?.length ?? segment._count?.classes ?? 0;
            const staffCount = segment.staff?.length ?? segment._count?.employee_profiles ?? 0;

            return (
              <div
                key={segment.id}
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm transition-all"
              >
                {/* Segment Header Bar */}
                <div
                  onClick={() => toggleExpand(segment.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors select-none"
                >
                  <div className="flex items-center gap-4">
                    {/* Expand Chevron Icon */}
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : ""
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </div>

                    {/* Order & Segment Name */}
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black text-zinc-600 dark:text-zinc-300 rounded-md">
                          <Hash className="h-2.5 w-2.5" />
                          {segment.display_order}
                        </span>
                        <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                          {segment.name}
                        </h3>
                        <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded-lg">
                          {segment.code}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges and Actions */}
                  <div
                    className="flex items-center gap-3 ml-12 sm:ml-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Stats pills */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold">
                      <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                      {classesCount} {classesCount === 1 ? "Class" : "Classes"}
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold">
                      <Users className="h-3.5 w-3.5 text-zinc-400" />
                      {staffCount} {staffCount === 1 ? "Staff" : "Staff"}
                    </span>

                    {/* Action buttons */}
                    {access.can("edit") && (
                      <button
                        type="button"
                        title="Edit Segment"
                        onClick={() => openEditModal(segment)}
                        className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}

                    {access.can("delete") && (
                      <button
                        type="button"
                        title="Delete Segment"
                        onClick={() => setDeletingSegment(segment)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 p-6 space-y-6">
                    {/* 1. Classes Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-zinc-500" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Assigned Classes ({segment.classes?.length || 0})
                          </h4>
                        </div>
                      </div>

                      {segment.classes && segment.classes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {segment.classes.map((cls) => (
                            <div
                              key={cls.id}
                              className="bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between gap-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-black text-sm text-zinc-900 dark:text-zinc-100">
                                    {cls.description}
                                  </span>
                                  <span className="ml-1.5 text-[10px] font-bold text-zinc-400 uppercase">
                                    ({cls.class_code})
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[9px] font-black text-zinc-500 dark:text-zinc-400 rounded">
                                  {cls.academic_system}
                                </span>
                              </div>

                              {cls.campuses && cls.campuses.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {cls.campuses.map((camp) => (
                                    <span
                                      key={camp.id}
                                      className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-800"
                                    >
                                      <School className="h-2.5 w-2.5 text-zinc-400" />
                                      {camp.campus_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-white dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
                          <p className="text-xs font-bold text-zinc-400">
                            No classes currently assigned to this segment.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 2. Staff & Teachers Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-zinc-500" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Allocated Staff & Teachers ({segment.staff?.length || 0})
                          </h4>
                        </div>
                      </div>

                      {segment.staff && segment.staff.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {segment.staff.map((st) => (
                            <StaffCard key={st.id} staff={st} />
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-white dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
                          <p className="text-xs font-bold text-zinc-400">
                            No staff or teachers currently allocated to this segment.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT SEGMENT MODAL */}
      {(isCreateModalOpen || editingSegment) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                    {editingSegment ? `Edit Segment: ${editingSegment.name}` : "Create New Segment"}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    Configure segment attributes and select classes to assign.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingSegment(null);
                }}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveSegment} className="space-y-5 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Name */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    Segment Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary Wing, Senior Wing"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>

                {/* Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRIMARY"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full h-11 px-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
              </div>

              {/* Display Order */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Display Order
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={formOrder}
                  onChange={(e) => setFormOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-32 h-11 px-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>

              {/* Class Assignment Multi-Selector */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
                      Assign Classes ({formSelectedClassIds.length} selected)
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Select classes that belong to this academic wing.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormSelectedClassIds(availableClasses.map((c) => c.id))
                      }
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFormSelectedClassIds([])}
                      className="text-[11px] font-bold text-zinc-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Filter Classes */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filter classes..."
                    value={classFilterQuery}
                    onChange={(e) => setClassFilterQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                {/* Classes Checkbox Grid */}
                {isLoadingClasses ? (
                  <div className="py-8 flex justify-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-zinc-100 dark:border-zinc-850 rounded-xl">
                    {filteredModalClasses.map((cls) => {
                      const isSelected = formSelectedClassIds.includes(cls.id);
                      return (
                        <div
                          key={cls.id}
                          onClick={() => toggleClassSelection(cls.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                                isSelected
                                  ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white border-transparent"
                                  : "border-zinc-300 dark:border-zinc-700"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <div className="truncate">
                              <span className="text-xs font-black truncate block">
                                {cls.description}
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  isSelected
                                    ? "text-zinc-300 dark:text-zinc-600"
                                    : "text-zinc-400"
                                }`}
                              >
                                {cls.academic_system} • {cls.class_code}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingSegment(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingSegment ? "Save Changes" : "Create Segment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="h-12 w-12 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                Delete Segment
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Are you sure you want to delete{" "}
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {deletingSegment.name} ({deletingSegment.code})
                </span>
                ?
              </p>
              <p className="text-[11px] text-zinc-400 mt-2">
                Classes and employee profiles linked to this segment will be unlinked safely. This action will be logged in the system audit logs.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSegment(null)}
                className="flex-1 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteSegment}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffCard({ staff }: { staff: SegmentStaff }) {
  const formattedCode = formatEmployeeCodeDisplay(staff);
  const initials = (staff.full_name || "S")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-sm flex items-start gap-3">
      {/* Avatar */}
      {staff.photo_url ? (
        <img
          src={staff.photo_url}
          alt={staff.full_name || "Staff"}
          className="h-10 w-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
        />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-zinc-100 dark:to-zinc-300 text-white dark:text-zinc-900 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="font-black text-xs text-zinc-900 dark:text-zinc-100 truncate block">
            {staff.full_name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          {formattedCode && (
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
              {formattedCode}
            </span>
          )}
          {staff.job_title && (
            <span className="text-[10px] text-zinc-400 font-medium truncate">
              {staff.job_title}
            </span>
          )}
        </div>

        {/* Campus badge */}
        {staff.campus_name && (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-zinc-400">
            <School className="h-2.5 w-2.5" />
            <span className="truncate">{staff.campus_name}</span>
          </div>
        )}

        {/* Assigned Classes */}
        {staff.assigned_classes && staff.assigned_classes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {staff.assigned_classes.slice(0, 2).map((ac, idx) => (
              <span
                key={idx}
                className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/40"
              >
                {ac}
              </span>
            ))}
            {staff.assigned_classes.length > 2 && (
              <span className="text-[9px] font-bold text-zinc-400">
                +{staff.assigned_classes.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  icon: typeof Layers;
  hint?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        {hint && (
          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-lg">
            {hint}
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-black text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}
