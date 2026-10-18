import { Users, Wallet, Fingerprint, Briefcase, Megaphone, School, type LucideIcon } from "lucide-react";

// What TAFSync covers today — keep in step with the top-level groups in src/lib/nav-config.ts.
export const TAFSYNC_MODULES: { icon: LucideIcon; name: string; detail: string }[] = [
    { icon: Users, name: "Students", detail: "Admissions, directory, families, transfers and promotions" },
    { icon: Wallet, name: "Finance", detail: "Fee schedules, vouchers, bank deposits and financial reports" },
    { icon: Fingerprint, name: "Attendance", detail: "Biometric devices, staff and student attendance, timetables" },
    { icon: Briefcase, name: "HR & Payroll", detail: "Employee records, payroll, loans and increments" },
    { icon: Megaphone, name: "Communications", detail: "Notice board, support tickets and parent chat" },
    { icon: School, name: "School Setup", detail: "Campuses, classes, sections and the academic calendar" },
];
