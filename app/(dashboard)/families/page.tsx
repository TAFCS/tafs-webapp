import { FamiliesDataTable } from "@/features/families/components/families-data-table";

export default function FamiliesPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-120px)] w-full max-w-[95%] lg:max-w-[92%] xl:max-w-[90%] mx-auto flex-1 transition-all duration-300">
            <div className="mb-6 flex-shrink-0">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Family & Household Directory</h2>
                <p className="text-zinc-500 mt-2">Manage household connections, review sibling links, and monitor family-level financial statuses.</p>
            </div>

            <div className="flex-1 min-h-0">
                <FamiliesDataTable />
            </div>
        </div>
    );
}
