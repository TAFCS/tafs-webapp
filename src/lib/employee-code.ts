export interface EmployeeCodeParts {
  dep: string;
  number: string;
  campusPrefix?: string | null;
}

const PREFIXED_CODE_RE = /^([A-Z]{2,4})-(\d{2})-(.+)$/;
const SPLIT_CODE_RE = /^(\d{2})-(.+)$/;

export const CAMPUS_CODE_PREFIX_BY_ID: Record<number, string> = {
  1: "GEJ",
  2: "GKF",
  3: "NNN",
};

export function campusPrefixForId(campusId: number | null | undefined): string | null {
  if (campusId == null) return null;
  return CAMPUS_CODE_PREFIX_BY_ID[campusId] ?? null;
}

export function parseEmployeeCode(code: string | null | undefined): EmployeeCodeParts | null {
  if (!code) return null;
  const raw = code.trim().toUpperCase();
  const prefixed = raw.match(PREFIXED_CODE_RE);
  if (prefixed) {
    return { campusPrefix: prefixed[1], dep: prefixed[2], number: prefixed[3] };
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
  const prefix = campusPrefix?.trim().toUpperCase();
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
}): string | null {
  const parts = employeeCodePartsFromProfile(employee);
  if (parts) {
    const prefix = parts.campusPrefix ?? campusPrefixForId(employee.campus_id) ?? null;
    return composeEmployeeCode(parts.dep, parts.number, prefix);
  }
  return employee.employee_code?.trim().toUpperCase() ?? null;
}
