import api from './api';

function downloadBlob(data: BlobPart, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export type RollSessionStatus = 'DRAFT' | 'SUBMITTED' | 'SKIPPED';
export type RollSessionKind = 'REGULAR' | 'MAKEUP';
export type RollRecordStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE';
export type StaffAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED' | 'UNPAID_LEAVE' | 'SICK_LEAVE' | 'CASUAL_LEAVE' | 'ANNUAL_LEAVE';

/** A weekday that runs to different times. Replaces the base for that day. */
export interface ClassScheduleDay {
  id?: number;
  /** 0 = Sunday … 6 = Saturday. */
  day_of_week: number;
  expected_check_in: string;
  end_time: string | null;
  intermediate_time: string | null;
}

export interface ClassCheckInSchedule {
  id: number;
  class_id: number;
  campus_id: number;
  /** START of the school day. Parent-visible; also the lateness threshold. */
  expected_check_in: string;
  /** END of the school day. Parent-visible. */
  end_time: string | null;
  /** Internal punch cut-off. Never shown to parents — see the backend util. */
  intermediate_time: string | null;
  effective_from: string;
  created_by?: string | null;
  created_at?: string;
  classes?: { id: number; description: string; class_code: string };
  /** When parents were last told about this pairing's timings. */
  last_notified_at?: string | null;
  last_notified_start?: string | null;
  last_notified_end?: string | null;
  /** Start/end differ from what parents were last told (or never were). */
  parents_out_of_date?: boolean;
  notification_report?: ClassTimingNotificationReport | null;
  notification_warning?: string | null;
  /** Weekday overrides, ascending by day_of_week. */
  class_check_in_schedule_days?: ClassScheduleDay[];
}

export interface ClassTimingNotificationReport {
  students_matched: number;
  families_notified: number;
  skipped_no_family: number;
  failed: number;
  failures: { family_id: number; student_names: string; reason: string }[];
  notification_id: number | null;
}

export interface ScheduleDayPayload {
  day_of_week: number;
  expected_check_in: string;
  end_time?: string | null;
  intermediate_time?: string | null;
}

export interface ClassTimingNotificationPreview {
  title: string;
  body: string;
  /** Families that would receive it. */
  recipients: number;
}

export interface StaffAttendanceRecord {
  id: number;
  employee_id: number;
  campus_id: number;
  date: string;
  status: StaffAttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  source: 'MANUAL' | 'BIOMETRIC' | 'LEAVE' | 'HOLIDAY' | 'SYSTEM' | null;
}

export interface StaffRegisterRow {
  employee: {
    id: number;
    user_id: string | null;
    full_name: string | null;
    job_title: string | null;
    staff_category_id: number | null;
    staff_categories: { id: number; code: string; name: string } | null;
    employment_type: string | null;
    reporting_time: string | null;
    late_relaxation_minutes: number | null;
    users: { id: string; full_name: string; role: string; email: string } | null;
    departments: { id: number; name: string } | null;
  };
  record: StaffAttendanceRecord | null;
  is_working_day?: boolean;
  day_type?: string | null;
  day_description?: string | null;
}

export interface RollRecord {
  id: number;
  session_id: number;
  student_cc: number;
  status: RollRecordStatus;
  notes: string | null;
  students?: {
    cc: number;
    full_name: string;
    gr_number: string | null;
  };
}

export interface RollSessionRosterEntry {
  student: {
    cc: number;
    full_name: string;
    gr_number: string | null;
    class_id: number | null;
    section_id: number | null;
  };
  record: RollRecord | null;
}

export interface RollSession {
  id: number;
  campus_id: number;
  class_id: number;
  section_id: number | null;
  teaching_group_id?: number | null;
  session_date: string;
  period: number;
  timetable_slot_id?: number | null;
  session_kind?: RollSessionKind;
  reschedule_id?: number | null;
  status: RollSessionStatus;
  skip_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  class_session_reschedules?: {
    id: number;
    status: string;
    source_date: string;
    makeup_date: string;
    source_timetable_slot?: { day_of_week: number; block_number: number };
  } | null;
  reschedule_as_source?: {
    id: number;
    status: string;
    source_date: string;
    makeup_date: string;
  } | null;
  reschedule_completion?: {
    sourceCount: number;
    excusedStudentCount: number;
    absentStudentCount: number;
    staffExcusedDays: number;
    staffExcuseWarnings: string[];
  };
  classes?: { id: number; description: string; class_code: string; academic_system: string };
  sections?: { id: number; description: string } | null;
  teaching_groups?: {
    id: number;
    label: string | null;
    subjects: { id: number; name: string; code: string | null };
    employee_profiles: { id: number; full_name: string | null };
  } | null;
  /** Subject/teacher as they stood when this session was created — frozen so a
   * later timetable edit or teaching-group reassignment can't relabel history.
   * Falls back to the live `teaching_groups` join server-side for pre-snapshot rows. */
  subject?: { id: number; name: string; code: string | null } | null;
  teacher?: { id: number; full_name: string | null } | null;
  campuses?: { id: number; campus_name: string; campus_code: string };
  records?: RollRecord[];
  roster?: RollSessionRosterEntry[];
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

// ── Staff Attendance Dashboard ─────────────────────────────────────────────

export interface SummaryCardValue {
  count: number;
  delta: number;
}

export interface StaffAttendanceSummary {
  present_summary: {
    on_time: SummaryCardValue;
    late: SummaryCardValue;
    early: SummaryCardValue;
  };
  not_present_summary: {
    absent: SummaryCardValue;
    no_clock_in: SummaryCardValue;
    no_clock_out: SummaryCardValue;
    invalid: SummaryCardValue;
  };
  away_summary: {
    day_off: SummaryCardValue;
    time_off: SummaryCardValue;
  };
}

export interface StaffDashboardRow {
  employee: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
    job_title: string | null;
    photo_url: string | null;
    department: string | null;
  };
  check_in_at: string | null;
  check_out_at: string | null;
  overtime_minutes: number | null;
  location: string | null;
  note: string | null;
  status: StaffAttendanceStatus | null;
}

export type TimelineSegmentType = 'WORK' | 'BREAK' | 'OVERTIME' | 'DAY_OFF';

export interface TimelineSegment {
  type: TimelineSegmentType;
  start: string;
  end: string;
  isMissingOut?: boolean;
}

export interface TimelineDay {
  date: string;
  status: StaffAttendanceStatus | null;
  is_working_day?: boolean;
  day_type?: string | null;
  day_description?: string | null;
  segments: TimelineSegment[];
}

export interface StaffTimeline {
  employee: { id: number; full_name: string | null };
  days: TimelineDay[];
}

// ── Student Attendance Dashboard ───────────────────────────────────────────

export interface StudentAttendanceSummary {
  present_summary: {
    present: SummaryCardValue;
    late?: SummaryCardValue;
  };
  not_present_summary: {
    absent?: SummaryCardValue;
    excused?: SummaryCardValue;
    no_clock_in: SummaryCardValue;
    no_clock_out: SummaryCardValue;
  };
}

export interface StudentDashboardRow {
  student: {
    cc: number;
    full_name: string;
    gr_number: string | null;
    photo_url: string | null;
    class: string | null;
    section: string | null;
  };
  check_in_at: string | null;
  check_out_at: string | null;
  status: RollRecordStatus | null;
  is_working_day?: boolean;
  day_type?: string | null;
  day_description?: string | null;
}

export type StudentTimelineSegmentType = 'WORK' | 'BREAK';

export interface StudentTimelineSegment {
  type: StudentTimelineSegmentType;
  start: string;
  end: string;
  isMissingOut?: boolean;
}

export interface StudentTimelineDay {
  date: string;
  status: RollRecordStatus | null;
  is_working_day?: boolean;
  day_type?: string | null;
  day_description?: string | null;
  holiday_type?: string | null;
  holiday_description?: string | null;
  segments: StudentTimelineSegment[];
}

export interface StudentTimeline {
  student: { cc: number; full_name: string };
  days: StudentTimelineDay[];
}

// ── Student Attendance Matrix (payroll-cycle-independent lines + punch matrix) ──

export type StudentDayClassification = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'UNRESOLVED' | 'DAY_OFF';

export interface StudentDayBreakdownEntry {
  date: string;
  is_working_day: boolean;
  day_type: string | null;
  day_description: string | null;
  classification: StudentDayClassification;
  check_in_at: string | null;
  check_out_at: string | null;
  break_minutes: number;
  late_minutes: number;
  source: 'MANUAL' | 'BIOMETRIC' | 'SYSTEM' | 'LEAVE' | null;
  segments?: { type: string; start: string; end: string; isMissingOut?: boolean }[];
}

export interface StudentAttendanceLine {
  student_cc: number;
  campus_id?: number;
  campus_name?: string;
  /** No active device_user_mappings row — can never record biometric attendance. */
  is_mapped: boolean;
  /** Mapped to a device, but zero scans in the period. */
  has_punches: boolean;
  present_days: number;
  late_days: number;
  absent_days: number;
  excused_days: number;
  unresolved_days: number;
  total_break_minutes: number;
  daily_breakdown: StudentDayBreakdownEntry[];
  student: {
    cc: number;
    full_name: string;
    gr_number: string | null;
    photo_url: string | null;
    class: string | null;
    section: string | null;
  };
}

export interface StudentAttendanceMatrix {
  /** null when spanning every campus the caller can see (no campus_id filter applied). */
  campus_id: number | null;
  period_start: string;
  period_end: string;
  lines: StudentAttendanceLine[];
}

export type ScanDirection = 'IN' | 'OUT';

export interface QuickCheckScan {
  id: number;
  scan_time: string;
  direction: ScanDirection | null;
  /** Punched from the webapp panel rather than a biometric device. */
  is_manual: boolean;
}

export interface QuickCheckState {
  student: {
    cc: number;
    full_name: string;
    gr_number: string | null;
    photo_url: string | null;
    status: string;
    class: string | null;
    section: string | null;
  };
  date: string;
  is_working_day: boolean;
  day_description: string | null;
  /** What the next punch must be — the other button is disabled. */
  next_direction: ScanDirection;
  /**
   * Whether this student's class has an internal cut-off time. When it does,
   * next_direction is decided by the clock rather than by the day's pairing,
   * so the disabled button needs a different explanation.
   */
  has_cutoff?: boolean;
  scan_count: number;
  status: RollRecordStatus | null;
  source: 'MANUAL' | 'BIOMETRIC' | 'SYSTEM' | 'LEAVE' | null;
  check_in_at: string | null;
  check_out_at: string | null;
  scans: QuickCheckScan[];
}

export interface QuickCheckResult {
  student_cc: number;
  full_name: string;
  direction: ScanDirection;
  scan_time: string;
  status: RollRecordStatus | null;
  check_in_at: string | null;
  check_out_at: string | null;
  next_direction: ScanDirection;
  notified: boolean;
}

export type DeviceHealthState = 'ok' | 'warn' | 'alert' | 'critical' | 'off_hours' | 'never';

export interface DeviceHealth {
  sn: string;
  name: string;
  campus_code: string;
  /** True server instant (format with formatServerTime). */
  last_contact_at: string | null;
  minutes_since: number | null;
  state: DeviceHealthState;
  expected_now: boolean;
  not_expected_reason: 'sunday' | 'saturday' | 'after_hours' | null;
}

export const attendanceService = {
  async listRollSessions(params: {
    date: string;
    campus_id?: number;
    class_id?: number;
    section_id?: number;
    teaching_group_id?: number;
    period?: number;
    timetable_slot_id?: number;
  }): Promise<RollSession[]> {
    const { data } = await api.get<ApiEnvelope<RollSession[]>>('/v1/attendance/roll-sessions', {
      params,
    });
    return data.data;
  },

  async getRollSession(id: number): Promise<RollSession> {
    const { data } = await api.get<ApiEnvelope<RollSession>>(`/v1/attendance/roll-sessions/${id}`);
    return data.data;
  },

  async createRollSession(payload: {
    session_date: string;
    campus_id: number;
    class_id: number;
    section_id?: number;
    teaching_group_id?: number;
    period?: number;
    timetable_slot_id?: number;
  }): Promise<RollSession> {
    const { data } = await api.post<ApiEnvelope<RollSession>>(
      '/v1/attendance/roll-sessions',
      payload,
    );
    return data.data;
  },

  async updateRollSession(
    id: number,
    payload: {
      records?: { student_cc: number; status: RollRecordStatus; notes?: string }[];
      submit?: boolean;
    },
  ): Promise<RollSession & { reschedule_completion?: RollSession['reschedule_completion'] }> {
    const { data } = await api.put<
      ApiEnvelope<RollSession & { reschedule_completion?: RollSession['reschedule_completion'] }>
    >(
      `/v1/attendance/roll-sessions/${id}`,
      payload,
    );
    return data.data;
  },

  async skipRollSession(id: number, reason: string): Promise<RollSession> {
    const { data } = await api.post<ApiEnvelope<RollSession>>(
      `/v1/attendance/roll-sessions/${id}/skip`,
      { reason },
    );
    return data.data;
  },

  async revertRollSession(id: number): Promise<RollSession> {
    const { data } = await api.post<ApiEnvelope<RollSession>>(
      `/v1/attendance/roll-sessions/${id}/revert`,
    );
    return data.data;
  },

  // ── Staff Daily Register ─────────────────────────────────────────────────

  async getStaffRegister(params: {
    date: string;
    campus_id?: string | number;
    department_id?: string | number;
  }): Promise<StaffRegisterRow[]> {
    const { data } = await api.get<ApiEnvelope<StaffRegisterRow[]>>(
      '/v1/attendance/staff',
      { params },
    );
    return data.data;
  },

  async bulkMarkStaff(payload: {
    date: string;
    campus_id: number;
    records: { employee_id: number; status: StaffAttendanceStatus; notes?: string; check_in_time?: string; check_out_time?: string }[];
  }): Promise<{ saved_count: number }> {
    const { data } = await api.put<ApiEnvelope<{ saved_count: number }>>(
      '/v1/attendance/staff',
      payload,
    );
    return data.data;
  },

  async getDeviceHealth(): Promise<DeviceHealth[]> {
    const { data } = await api.get<ApiEnvelope<DeviceHealth[]>>('/v1/attendance/zk-device-health');
    return data.data;
  },

  // ── Staff Attendance Dashboard ───────────────────────────────────────────

  async getStaffSummary(params: {
    date: string;
    campus_id?: string | number;
    department_id?: string | number;
  }): Promise<StaffAttendanceSummary> {
    const { data } = await api.get<ApiEnvelope<StaffAttendanceSummary>>(
      '/v1/attendance/staff/summary',
      { params },
    );
    return data.data;
  },

  async getStaffDashboard(params: {
    date: string;
    campus_id?: string | number;
    department_id?: string | number;
  }): Promise<StaffDashboardRow[]> {
    const { data } = await api.get<ApiEnvelope<StaffDashboardRow[]>>(
      '/v1/attendance/staff/dashboard',
      { params },
    );
    return data.data;
  },

  async getStaffTimeline(
    employeeId: number,
    params: { date_from: string; date_to: string },
  ): Promise<StaffTimeline> {
    const { data } = await api.get<ApiEnvelope<StaffTimeline>>(
      `/v1/attendance/staff/${employeeId}/timeline`,
      { params },
    );
    return data.data;
  },

  // ── Student Attendance Dashboard ─────────────────────────────────────────

  async getStudentSummary(params: {
    date: string;
    campus_id?: number;
    class_id?: number;
    section_id?: number;
  }): Promise<StudentAttendanceSummary> {
    const { data } = await api.get<ApiEnvelope<StudentAttendanceSummary>>(
      '/v1/attendance/students/summary',
      { params },
    );
    return data.data;
  },

  async getStudentDashboard(params: {
    date: string;
    campus_id?: number;
    class_id?: number;
    section_id?: number;
  }): Promise<StudentDashboardRow[]> {
    const { data } = await api.get<ApiEnvelope<StudentDashboardRow[]>>(
      '/v1/attendance/students/dashboard',
      { params },
    );
    return data.data;
  },

  async getStudentTimeline(
    studentCc: number,
    params: { date_from: string; date_to: string },
  ): Promise<StudentTimeline> {
    const { data } = await api.get<ApiEnvelope<StudentTimeline>>(
      `/v1/attendance/students/${studentCc}/timeline`,
      { params },
    );
    return data.data;
  },

  // ── Student Attendance Matrix (lines + punch matrix) ─────────────────────

  async getStudentAttendanceMatrix(params: {
    campus_id?: number;
    class_id?: number;
    section_id?: number;
    period_start: string;
    period_end: string;
  }): Promise<StudentAttendanceMatrix> {
    const { data } = await api.get<ApiEnvelope<StudentAttendanceMatrix>>(
      '/v1/attendance/students/matrix',
      { params },
    );
    return data.data;
  },

  async exportStudentAttendanceMatrix(params: {
    campus_id?: number;
    class_id?: number;
    section_id?: number;
    period_start: string;
    period_end: string;
  }): Promise<void> {
    const { data } = await api.get('/v1/attendance/students/matrix/export', { params, responseType: 'blob' });
    downloadBlob(data, `student-attendance-${params.period_start}-to-${params.period_end}.xlsx`);
  },

  // ── Quick Check-In / Check-Out (gate desk) ───────────────────────────────

  async getQuickCheckState(studentCc: number): Promise<QuickCheckState> {
    const { data } = await api.get<ApiEnvelope<QuickCheckState>>(
      `/v1/attendance/students/${studentCc}/quick-check`,
    );
    return data.data;
  },

  async quickCheck(studentCc: number, direction: ScanDirection): Promise<QuickCheckResult> {
    const { data } = await api.post<ApiEnvelope<QuickCheckResult>>(
      `/v1/attendance/students/${studentCc}/quick-check`,
      { direction },
    );
    return data.data;
  },

  async resolveStudentAttendance(
    studentCc: number,
    payload: { date: string; campus_id: number; check_in_time?: string; check_out_time: string },
  ): Promise<{ resolved: boolean; student_cc: number; date: string }> {
    const { data } = await api.put<ApiEnvelope<{ resolved: boolean; student_cc: number; date: string }>>(
      `/v1/attendance/students/${studentCc}/resolve`,
      payload,
    );
    return data.data;
  },

  async bulkMarkStudentsDaily(payload: {
    date: string;
    campus_id: number;
    /** `check_in_time`/`check_out_time` are "HH:MM" and only apply to PRESENT/LATE — ABSENT/EXCUSED always clear the day's punches. */
    records: { student_cc: number; status: RollRecordStatus; check_in_time?: string; check_out_time?: string }[];
  }): Promise<{ saved_count: number }> {
    const { data } = await api.put<ApiEnvelope<{ saved_count: number }>>(
      '/v1/attendance/students/bulk-manual',
      payload,
    );
    return data.data;
  },

  // ── Class Check-In Schedules (CRUD) ────────────────────────────────────────

  async getClassCheckInSchedules(campusId: number): Promise<ClassCheckInSchedule[]> {
    const { data } = await api.get<ApiEnvelope<ClassCheckInSchedule[]>>(
      '/v1/hr/class-check-in-schedules',
      { params: { campus_id: campusId } },
    );
    return data.data;
  },

  async createClassCheckInSchedule(payload: {
    class_id: number;
    campus_id: number;
    expected_check_in: string; // "HH:MM" — start of day
    end_time?: string | null; // "HH:MM"
    intermediate_time?: string | null; // "HH:MM" — internal
    effective_from: string; // "YYYY-MM-DD"
    days?: ScheduleDayPayload[];
    notify_parents?: boolean;
  }): Promise<ClassCheckInSchedule> {
    const { data } = await api.post<ApiEnvelope<ClassCheckInSchedule>>(
      '/v1/hr/class-check-in-schedules',
      payload,
    );
    return data.data;
  },

  async updateClassCheckInSchedule(
    id: number,
    payload: {
      expected_check_in?: string;
      end_time?: string | null;
      intermediate_time?: string | null;
      effective_from?: string;
      /** Replaces the whole override set. [] clears them; omit to leave alone. */
      days?: ScheduleDayPayload[];
      notify_parents?: boolean;
    },
  ): Promise<ClassCheckInSchedule> {
    const { data } = await api.patch<ApiEnvelope<ClassCheckInSchedule>>(
      `/v1/hr/class-check-in-schedules/${id}`,
      payload,
    );
    return data.data;
  },

  /** The exact message parents would receive. Sends nothing. */
  async previewClassTimingNotification(payload: {
    campus_id: number;
    class_id: number;
    expected_check_in: string;
    end_time?: string | null;
    effective_from: string;
  }): Promise<ClassTimingNotificationPreview> {
    const { data } = await api.post<ApiEnvelope<ClassTimingNotificationPreview>>(
      '/v1/hr/class-check-in-schedules/preview-notification',
      payload,
    );
    return data.data;
  },

  async deleteClassCheckInSchedule(id: number): Promise<void> {
    await api.delete<ApiEnvelope<void>>(`/v1/hr/class-check-in-schedules/${id}`);
  },

  async recomputeLateStatus(payload: {
    campus_id: number;
    date_from: string;
    date_to: string;
    class_id?: number;
  }): Promise<{ studentsRecomputed: number; staffRecomputed: number }> {
    const { data } = await api.post<ApiEnvelope<{ studentsRecomputed: number; staffRecomputed: number }>>(
      '/v1/attendance/recompute-late-status',
      payload,
    );
    return data.data;
  },
};
