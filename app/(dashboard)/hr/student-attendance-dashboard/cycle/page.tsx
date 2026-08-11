"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StudentAttendanceCycleWidget } from "../_components/StudentAttendanceCycleWidget";

export default function StudentAttendanceCyclePage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/hr/student-attendance-dashboard"
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    aria-label="Back to today's student register"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
                        Student Attendance by Cycle
                    </h1>
                    <p className="text-[13px] text-zinc-400 font-medium leading-snug">
                        Student lines and punch matrix over a selected date range.
                    </p>
                </div>
            </div>
            <StudentAttendanceCycleWidget />
        </div>
    );
}
