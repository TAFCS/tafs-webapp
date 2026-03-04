import { FamiliesDataTable } from "@/features/families/components/families-data-table";

export default function FamiliesPage() {
    return (
        <div className="flex-1 h-[calc(100vh-64px)] flex flex-col p-6 overflow-hidden">
            <div className="mb-6 flex-shrink-0">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Family & Household Directory</h2>
                <p className="text-zinc-500 mt-2">Manage household connections, review sibling links, and monitor family-level financial statuses.</p>
            </div>

            <FamiliesDataTable />
        </div>
    );
}
