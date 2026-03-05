import { StudentDataTable } from "@/src/features/students/components/student-data-table";

export default function StudentsDirectoryPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Student Directory</h1>
                <p className="text-zinc-500 mt-1">
                    Manage all student records, filter by campus, track financial status, and perform quick actions.
                </p>
            </div>
            <StudentDataTable />
        </div>
    );
}