import { StudentDataTable } from "@/src/features/students/components/student-data-table";

export default function StudentsDirectoryPage() {
    return (
        <div className="pb-10 max-w-full">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Student Directory</h2>
                <p className="text-zinc-500 mt-2">Manage all student records, filter by campus, track financial status, and perform quick actions.</p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                <StudentDataTable />
            </div>
        </div>
    );
}