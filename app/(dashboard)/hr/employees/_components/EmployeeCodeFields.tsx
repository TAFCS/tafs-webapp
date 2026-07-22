"use client";

import { useMemo } from "react";
import { composeEmployeeCode, isLegacyEmployeeCode, campusPrefixForId } from "@/lib/employee-code";

export interface EmployeeCodeFormValue {
  employee_code_dep: string;
  employee_code_number: string;
  employee_code: string;
}

interface EmployeeCodeFieldsProps {
  value: EmployeeCodeFormValue;
  onChange: (value: EmployeeCodeFormValue) => void;
  required?: boolean;
  onDepChange?: (dep: string) => void;
  inputCls: string;
  /** When set, preview/full code includes campus prefix (GEJ/GKF/NNN). */
  campusId?: number | null;
}

export function EmployeeCodeFields({
  value,
  onChange,
  required = false,
  onDepChange,
  inputCls,
  campusId = null,
}: EmployeeCodeFieldsProps) {
  const legacy = isLegacyEmployeeCode(value.employee_code);
  const campusPrefix = campusPrefixForId(campusId);
  const splitPreview = useMemo(() => {
    if (legacy) return value.employee_code;
    if (value.employee_code_dep.trim() && value.employee_code_number.trim()) {
      return composeEmployeeCode(value.employee_code_dep, value.employee_code_number, campusPrefix);
    }
    return null;
  }, [legacy, value.employee_code, value.employee_code_dep, value.employee_code_number, campusPrefix]);

  if (legacy) {
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Employee Code {required && <span className="text-rose-500">*</span>}
        </label>
        <input
          type="text"
          className={`${inputCls} font-mono uppercase`}
          value={value.employee_code}
          onChange={(e) =>
            onChange({
              ...value,
              employee_code: e.target.value.toUpperCase(),
              employee_code_dep: "",
              employee_code_number: "",
            })
          }
        />
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
          Legacy code format — enter a dept code and number below to switch to the split format.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dept Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="03"
              className={`${inputCls} font-mono`}
              value={value.employee_code_dep}
              onChange={(e) => {
                const dep = e.target.value.replace(/\D/g, "").slice(0, 2);
                onChange({ ...value, employee_code_dep: dep, employee_code: "" });
                onDepChange?.(dep);
              }}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Number</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="5256"
              className={`${inputCls} font-mono`}
              value={value.employee_code_number}
              onChange={(e) => {
                const number = e.target.value.replace(/\D/g, "");
                onChange({ ...value, employee_code_number: number, employee_code: "" });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
        Employee Code {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="grid grid-cols-[88px_1fr] gap-3 items-start">
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dept</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="03"
            required={required}
            className={`${inputCls} font-mono text-center`}
            value={value.employee_code_dep}
            onChange={(e) => {
              const dep = e.target.value.replace(/\D/g, "").slice(0, 2);
              onChange({ ...value, employee_code_dep: dep });
              onDepChange?.(dep);
            }}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Number</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="5256"
            required={required}
            className={`${inputCls} font-mono`}
            value={value.employee_code_number}
            onChange={(e) => {
              const number = e.target.value.replace(/\D/g, "");
              onChange({ ...value, employee_code_number: number });
            }}
          />
        </div>
      </div>
      {splitPreview && (
        <p className="text-[10px] text-zinc-500 font-mono">
          Full code: <span className="font-bold text-zinc-700 dark:text-zinc-300">{splitPreview}</span>
        </p>
      )}
      <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
        {campusPrefix
          ? `Campus prefix ${campusPrefix} is applied automatically (e.g. 02 + 1955 → ${campusPrefix}-02-1955).`
          : "Dept code and number are stored separately. Select a campus to add the branch prefix."}
      </p>
    </div>
  );
}
