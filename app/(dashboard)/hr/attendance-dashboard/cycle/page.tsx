"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { AttendanceCycleWidget } from "../_components/AttendanceCycleWidget";
import { VideoDemoModal } from "@/components/VideoDemoModal";

const DEFAULT_ATTENDANCE_CYCLE_DEMO_VIDEO_URL =
    "https://tafs-assets.sgp1.cdn.digitaloceanspaces.com/demos/attendance-cycle/attendance-cycle-demo.mp4";

const attendanceCycleDemoVideoUrl =
    process.env.NEXT_PUBLIC_ATTENDANCE_CYCLE_DEMO_VIDEO_URL?.trim() ||
    DEFAULT_ATTENDANCE_CYCLE_DEMO_VIDEO_URL;

export default function EmployeeAttendanceCyclePage() {
    const [isDemoOpen, setIsDemoOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link
                        href="/hr/attendance-dashboard"
                        className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                        aria-label="Back to today's employee register"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
                            Employee Attendance by Cycle
                        </h1>
                        <p className="text-[13px] text-zinc-400 font-medium leading-snug">
                            Employee lines and punch matrix over a selected date range.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsDemoOpen(true)}
                    className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shrink-0 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                    <Play className="h-3.5 w-3.5" />
                    DEMO
                </button>
            </div>
            <AttendanceCycleWidget />

            <VideoDemoModal
                isOpen={isDemoOpen}
                onClose={() => setIsDemoOpen(false)}
                videoUrl={attendanceCycleDemoVideoUrl}
                title="Employee Attendance by Cycle Demo"
            />
        </div>
    );
}
