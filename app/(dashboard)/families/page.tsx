"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { Link as LinkIcon, Users, Search, Save } from "lucide-react";
import { useState } from "react";

export default function FamiliesPage() {
    // Modal States
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);

    return (
        <div className="flex-1 h-[calc(100vh-64px)] flex flex-col p-6 overflow-hidden">
            <div className="mb-6 flex-shrink-0 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Family & Household Directory</h2>
                    <p className="text-zinc-500 mt-2">Manage household connections, review sibling links, and monitor family-level financial statuses.</p>
                </div>

                {/* Global Action Buttons */}
                <div className="flex items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                    <button
                        onClick={() => setIsCreateFamilyModalOpen(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium"
                    >
                        <Users className="h-4 w-4" />
                        Create New Family
                    </button>
                    <button
                        onClick={() => setIsChangeFamilyModalOpen(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm font-medium"
                    >
                        <LinkIcon className="h-4 w-4" />
                        Change Student's Family
                    </button>
                </div>
            </div>

            <FamiliesDataTable />

            {/* Create Family Modal (Includes all Schema Fields) */}
            {isCreateFamilyModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 flex-shrink-0">
                            <h3 className="font-semibold text-lg text-zinc-900">Create New Family</h3>
                            <button onClick={() => setIsCreateFamilyModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">✕</button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <p className="text-zinc-500 text-sm mb-6 pb-4 border-b">Enter details to establish a new household record mapping to the database.</p>

                            <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">Household Name <span className="text-red-500">*</span></label>
                                        <input type="text" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-zinc-300 focus:ring-primary/20 focus:border-primary text-sm shadow-sm" placeholder="e.g. Ali Household" />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">Legacy PID</label>
                                        <input type="text" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-zinc-300 focus:ring-primary/20 focus:border-primary text-sm shadow-sm" placeholder="e.g. OLD-PID-123" />
                                        <p className="text-[10px] text-zinc-500 mt-1">Cross-system migration identifier.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">Account Username</label>
                                        <input type="text" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-zinc-300 focus:ring-primary/20 focus:border-primary text-sm shadow-sm" placeholder="Username (Optional)" />
                                        <p className="text-[10px] text-zinc-500 mt-1">Unique identifier for portal login.</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">Primary Contact Email</label>
                                    <input type="email" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-zinc-300 focus:ring-primary/20 focus:border-primary text-sm shadow-sm" placeholder="parent@example.com" />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">Primary Mailing Address</label>
                                    <textarea rows={3} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-zinc-300 focus:ring-primary/20 focus:border-primary text-sm shadow-sm resize-none" placeholder="123 Example Street, City..."></textarea>
                                </div>

                                <div className="bg-zinc-50 p-4 border rounded-lg flex items-start gap-3">
                                    <input type="checkbox" id="publicityConsent" className="mt-0.5 rounded border-zinc-300 text-primary w-4 h-4 focus:ring-primary/30" />
                                    <div>
                                        <label htmlFor="publicityConsent" className="text-sm font-medium text-zinc-900 cursor-pointer">Consent to Publicity & Photography</label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Authorizes the school to use student photography and media belonging to this household in official publications.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t bg-zinc-50 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => setIsCreateFamilyModalOpen(false)} className="px-4 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-100 font-medium text-zinc-700 bg-white shadow-sm transition-colors">Cancel</button>
                            <button className="px-5 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium shadow-sm transition-colors flex items-center gap-2">
                                <Save className="h-4 w-4" /> Save Family Record
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Student's Family Modal (Preserved as is from previous design) */}
            {isChangeFamilyModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 flex-shrink-0">
                            <h3 className="font-semibold text-lg text-zinc-900">Change Pre-existing Student's Family</h3>
                            <button onClick={() => setIsChangeFamilyModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">✕</button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto bg-zinc-50/50">
                            <p className="text-zinc-500 text-sm mb-6">Select a student and choose which household to move them from and to.</p>

                            <div className="mb-6">
                                <label className="block text-xs font-medium text-zinc-700 mb-1">Select Student to Move</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <input type="text" className="w-full pl-9 px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 focus:ring-primary focus:border-primary text-sm shadow-sm bg-white" placeholder="Search by name, CC, or GR..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* From Column */}
                                <div className="bg-white border rounded-xl p-5 shadow-sm">
                                    <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> From Current Family
                                    </h4>
                                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg flex flex-col items-center justify-center min-h-[120px] text-center">
                                        <p className="text-xs text-zinc-500 mb-1">Current Household</p>
                                        <p className="font-medium text-sm text-zinc-800">No student selected yet</p>
                                    </div>
                                </div>

                                {/* To Column */}
                                <div className="bg-white border rounded-xl p-5 shadow-sm">
                                    <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> To Target Family
                                    </h4>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 mb-2">Search Target Household</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                            <input type="text" className="w-full pl-9 px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-zinc-50" placeholder="Search target families..." />
                                        </div>
                                    </div>
                                    <div className="mt-4 p-4 border border-zinc-100 rounded-lg flex flex-col items-center justify-center min-h-[100px] text-center">
                                        <p className="text-zinc-400 text-xs">Search and select a new household above.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t bg-zinc-50 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => setIsChangeFamilyModalOpen(false)} className="px-5 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-100 font-medium text-zinc-700 bg-white shadow-sm transition-colors">Cancel</button>
                            <button className="px-5 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium shadow-sm transition-colors">Execute Move</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
