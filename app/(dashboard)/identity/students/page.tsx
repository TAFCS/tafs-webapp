import { StudentDataTable } from "@/src/features/students/components/student-data-table";

export default function StudentsDirectoryPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-[YOUR_LAYOUT_OFFSET]px)] w-full flex-1" style={{ height: 'calc(100vh - 120px)' }}>
            <div className="flex-none mb-4 px-4 pt-4">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Student Directory</h2>
                <p className="text-zinc-500 mt-2">Manage all student records, filter by campus, track financial status, and perform quick actions.</p>
            </div>

            <div className="flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full px-4 pb-4">
                <StudentDataTable />
            </div>
        </div>
    );
}