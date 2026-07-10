export interface EmployeeCodeParts {
  dep: string;
  number: string;
}

const SPLIT_CODE_RE = /^(\d{2})-(.+)$/;

export function parseEmployeeCode(code: string | null | undefined): EmployeeCodeParts | null {
  if (!code) return null;
  const match = code.trim().toUpperCase().match(SPLIT_CODE_RE);
  if (!match) return null;
  return { dep: match[1], number: match[2] };
}

export function composeEmployeeCode(dep: string, number: string): string {
  const normalizedDep = dep.trim().padStart(2, "0");
  const normalizedNumber = number.trim();
  return `${normalizedDep}-${normalizedNumber}`;
}

export function employeeCodePartsFromProfile(employee: {
  employee_code?: string | null;
  employee_code_dep?: string | null;
  employee_code_number?: string | null;
}): EmployeeCodeParts | null {
  if (employee.employee_code_dep && employee.employee_code_number) {
    return {
      dep: employee.employee_code_dep,
      number: employee.employee_code_number,
    };
  }
  return parseEmployeeCode(employee.employee_code);
}

export function isLegacyEmployeeCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false;
  return parseEmployeeCode(code) === null;
}

export function formatEmployeeCodeDisplay(employee: {
  employee_code?: string | null;
  employee_code_dep?: string | null;
  employee_code_number?: string | null;
}): string | null {
  const parts = employeeCodePartsFromProfile(employee);
  if (parts) return composeEmployeeCode(parts.dep, parts.number);
  return employee.employee_code?.trim().toUpperCase() ?? null;
}
