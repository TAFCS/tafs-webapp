export interface EmployeeCodeParts {
  dep: string;
  number: string;
  campusPrefix?: string | null;
}

const PREFIXED_CODE_RE = /^([A-Z]{2,4})-(\d{2})-(.+)$/;
const STUDENT_PREFIX_MISTAKE_RE = /^(KF-A|A-N)-(\d{2})-(.+)$/i;
const SPLIT_CODE_RE = /^(\d{2})-(.+)$/;

export const CAMPUS_CODE_PREFIX_BY_ID: Record<number, string> = {
  1: "GEJ",
  2: "GKF",
  3: "NNN",
};

const STUDENT_GR_CAMPUS_PREFIXES = new Set(["KF-A", "A-N", "A-"]);

export function isStudentGrCampusPrefix(prefix: string | null | undefined): boolean {
  if (!prefix?.trim()) return false;
  const compact = prefix.trim().toUpperCase().replace(/\s/g, "");
  if (STUDENT_GR_CAMPUS_PREFIXES.has(compact)) return true;
  if (compact.startsWith("KF-A")) return true;
  return false;
}

/** HR prefix for employee codes — ignores student G.R. values on campuses.campus_prefix. */
export function resolveEmployeeCampusPrefix(
  campusId: number | null | undefined,
  campusPrefixFromDb?: string | null,
): string | null {
  const fromDb = normalizeCampusPrefix(campusPrefixFromDb);
  if (fromDb && !isStudentGrCampusPrefix(fromDb)) {
    return fromDb;
  }
  return campusPrefixForId(campusId);
}

export function normalizeCampusPrefix(prefix: string | null | undefined): string | null {
  if (!prefix) return null;
  const upper = prefix.trim().toUpperCase();
  if (upper === "JHR") return "GEJ";
  return upper;
}

export function campusPrefixForId(campusId: number | null | undefined): string | null {
  if (campusId == null) return null;
  return CAMPUS_CODE_PREFIX_BY_ID[campusId] ?? null;
}

export function parseEmployeeCode(code: string | null | undefined): EmployeeCodeParts | null {
  if (!code) return null;
  const raw = code.trim().toUpperCase();
  const studentMistake = raw.match(STUDENT_PREFIX_MISTAKE_RE);
  if (studentMistake) {
    return { dep: studentMistake[2], number: studentMistake[3], campusPrefix: null };
  }
  const prefixed = raw.match(PREFIXED_CODE_RE);
  if (prefixed) {
    const p = normalizeCampusPrefix(prefixed[1]);
    if (p && isStudentGrCampusPrefix(p)) {
      return { dep: prefixed[2], number: prefixed[3], campusPrefix: null };
    }
    return { campusPrefix: p, dep: prefixed[2], number: prefixed[3] };
  }
  const match = raw.match(SPLIT_CODE_RE);
  if (!match) return null;
  return { dep: match[1], number: match[2], campusPrefix: null };
}

export function composeEmployeeCode(
  dep: string,
  number: string,
  campusPrefix?: string | null,
): string {
  const normalizedDep = dep.trim().padStart(2, "0");
  const normalizedNumber = number.trim();
  const body = `${normalizedDep}-${normalizedNumber}`;
  const prefix = normalizeCampusPrefix(campusPrefix);
  return prefix ? `${prefix}-${body}` : body;
}

export function employeeCodePartsFromProfile(employee: {
  employee_code?: string | null;
  employee_code_dep?: string | null;
  employee_code_number?: string | null;
}): EmployeeCodeParts | null {
  const fromFull = parseEmployeeCode(employee.employee_code);
  if (fromFull) return fromFull;
  if (employee.employee_code_dep && employee.employee_code_number) {
    return {
      dep: employee.employee_code_dep,
      number: employee.employee_code_number,
      campusPrefix: null,
    };
  }
  return null;
}

export function isLegacyEmployeeCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false;
  return parseEmployeeCode(code) === null;
}

export function formatEmployeeCodeDisplay(employee: {
  employee_code?: string | null;
  employee_code_dep?: string | null;
  employee_code_number?: string | null;
  campus_id?: number | null;
  /** Nested campus may omit campus_prefix; HR prefix then comes from campus_id map. */
  campuses?: {
    id?: number;
    campus_name?: string;
    campus_prefix?: string | null;
  } | null;
}): string | null {
  const parts = employeeCodePartsFromProfile(employee);
  if (parts) {
    const prefix = resolveEmployeeCampusPrefix(
      employee.campus_id,
      employee.campuses?.campus_prefix,
    );
    return composeEmployeeCode(parts.dep, parts.number, prefix);
  }
  const raw = employee.employee_code?.trim().toUpperCase() ?? null;
  if (raw && raw.startsWith("JHR-")) {
    return `GEJ-${raw.slice(4)}`;
  }
  return raw;
}
