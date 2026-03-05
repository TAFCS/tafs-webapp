import { Layers } from "lucide-react";

export default function SectionsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sections</h1>
                    <p className="text-zinc-500 mt-1">Manage class sections and divisions.</p>
                </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden p-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                        <Layers className="text-zinc-400 h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-medium text-zinc-900">Sections management coming soon</h3>
                    <p className="mt-1 text-sm text-zinc-500">This module is currently under development.</p>
                </div>
            </div>
        </div>
    );
}
