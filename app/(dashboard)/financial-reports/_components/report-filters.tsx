"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Calendar, GraduationCap, Layers, LayoutGrid } from "lucide-react";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";

type SegmentOption = {
  id: number;
  code: string;
  name: string;
  display_order: number;
};

type Props = {
  campusIds: number[];
  setCampusIds: (ids: number[]) => void;
  classIds: number[];
  setClassIds: (ids: number[]) => void;
  sectionIds: number[];
  setSectionIds: (ids: number[]) => void;
  segmentIds: number[];
  setSegmentIds: (ids: number[]) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  extra?: ReactNode;
};

export function ReportFilters({
  campusIds,
  setCampusIds,
  classIds,
  setClassIds,
  sectionIds,
  setSectionIds,
  segmentIds,
  setSegmentIds,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  extra,
}: Props) {
  const { user } = useAuthState();
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const campusesLoading = useAppSelector((s) => s.campuses.isLoading);
  const campusLocked = user?.campusId != null;
  const [segments, setSegments] = useState<SegmentOption[]>([]);

  useEffect(() => {
    if (campuses.length === 0) dispatch(fetchCampuses());
  }, [campuses.length, dispatch]);

  useEffect(() => {
    api.get("/v1/financial-reports/filter-options")
      .then(({ data }) => {
        const list = (data?.data?.segments ?? []) as SegmentOption[];
        setSegments([...list].sort((a, b) => a.display_order - b.display_order));
      })
      .catch(() => {
        setSegments([]);
      });
  }, []);

  useEffect(() => {
    if (campusLocked && user?.campusId != null) {
      setCampusIds([user.campusId]);
    }
  }, [campusLocked, user?.campusId, setCampusIds]);

  const scopedCampuses = useMemo(() => {
    if (campusIds.length === 0) return campuses;
    return campuses.filter((c) => campusIds.includes(c.id));
  }, [campuses, campusIds]);

  const classOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const campus of scopedCampuses) {
      for (const cls of campus.offered_classes ?? []) {
        map.set(cls.id, cls.description);
      }
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [scopedCampuses]);

  const sectionOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const campus of scopedCampuses) {
      for (const cls of campus.offered_classes ?? []) {
        if (classIds.length > 0 && !classIds.includes(cls.id)) continue;
        for (const section of cls.sections ?? []) {
          map.set(section.id, section.description);
        }
      }
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [scopedCampuses, classIds]);

  useEffect(() => {
    if (classOptions.length === 0) return;
    const valid = new Set(classOptions.map((c) => c.id));
    const next = classIds.filter((id) => valid.has(id));
    if (next.length !== classIds.length) setClassIds(next);
  }, [classOptions, classIds, setClassIds]);

  useEffect(() => {
    if (sectionOptions.length === 0) return;
    const valid = new Set(sectionOptions.map((s) => s.id));
    const next = sectionIds.filter((id) => valid.has(id));
    if (next.length !== sectionIds.length) setSectionIds(next);
  }, [sectionOptions, sectionIds, setSectionIds]);

  const lockedCampusName =
    campuses.find((c) => c.id === user?.campusId)?.campus_name || "Your Campus";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
          <Calendar className="h-3 w-3" /> From
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
          <Calendar className="h-3 w-3" /> To
        </label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
        />
      </div>

      {campusLocked ? (
        <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-bold text-zinc-600 dark:text-zinc-300 min-w-[200px]">
          <Building2 className="h-4 w-4 text-zinc-400" />
          {lockedCampusName}
        </div>
      ) : (
        <div className="min-w-[220px]">
          <FilterDropdown
            label="Campus"
            icon={Building2}
            value={campusIds}
            options={campuses.map((c) => ({ id: c.id, label: c.campus_name }))}
            loading={campusesLoading}
            placeholder="All campuses"
            hint="multi"
            onToggle={(id) => setCampusIds(toggleId(campusIds, id))}
            onSetValue={setCampusIds}
            onClear={() => setCampusIds([])}
          />
        </div>
      )}

      <div className="min-w-[200px]">
        <FilterDropdown
          label="Class"
          icon={GraduationCap}
          value={classIds}
          options={classOptions}
          placeholder="All classes"
          hint="multi"
          onToggle={(id) => setClassIds(toggleId(classIds, id))}
          onSetValue={setClassIds}
          onClear={() => setClassIds([])}
        />
      </div>

      <div className="min-w-[180px]">
        <FilterDropdown
          label="Section"
          icon={LayoutGrid}
          value={sectionIds}
          options={sectionOptions}
          placeholder="All sections"
          hint="multi"
          onToggle={(id) => setSectionIds(toggleId(sectionIds, id))}
          onSetValue={setSectionIds}
          onClear={() => setSectionIds([])}
        />
      </div>

      <div className="min-w-[200px]">
        <FilterDropdown
          label="Segment"
          icon={Layers}
          value={segmentIds}
          options={segments.map((s) => ({ id: s.id, label: s.name, sub: s.code }))}
          placeholder="All segments"
          hint="multi"
          onToggle={(id) => setSegmentIds(toggleId(segmentIds, id))}
          onSetValue={setSegmentIds}
          onClear={() => setSegmentIds([])}
        />
      </div>

      {extra}
    </div>
  );
}
