"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Globe, Users, X } from "lucide-react";
import api from "@/lib/api";

interface AnnouncementSelectorsProps {
    onFilterChange: (grade: string | null, section: string | null) => void;
}

export const AnnouncementSelectors = ({ onFilterChange }: AnnouncementSelectorsProps) => {
    const [grades, setGrades] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    
    const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                // Fetch unique grades and sections
                const [gRes, sRes] = await Promise.all([
                    api.get("v1/classes"),
                    api.get("v1/sections")
                ]);
                setGrades(gRes.data.data || []);
                setSections(sRes.data.data || []);
            } catch (err) {
                console.error("Failed to fetch filters:", err);
            }
        };
        fetchFilters();
    }, []);

    const handleGradeChange = (grade: string | null) => {
        setSelectedGrade(grade);
        setSelectedSection(null); // Reset section when grade changes
        onFilterChange(grade, null);
    };

    const handleSectionChange = (section: string | null) => {
        setSelectedSection(section);
        onFilterChange(selectedGrade, section);
    };

    return (
        <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-2 text-primary">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Announcement Target</span>
            </div>
            
            <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {/* Grade Selector */}
                <div className="relative group">
                    <select 
                        value={selectedGrade || ""} 
                        onChange={(e) => handleGradeChange(e.target.value || null)}
                        className="appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer hover:border-primary"
                    >
                        <option value="">Everyone (All Grades)</option>
                        {grades.map(g => (
                            <option key={g.id} value={g.class_code}>{g.description}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
                </div>

                {/* Section Selector */}
                {selectedGrade && (
                    <div className="relative group animate-in slide-in-from-left-2 duration-200">
                        <select 
                            value={selectedSection || ""} 
                            onChange={(e) => handleSectionChange(e.target.value || null)}
                            className="appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer hover:border-primary"
                        >
                            <option value="">All Sections</option>
                            {sections.map(s => (
                                <option key={s.id} value={s.description}>{s.description}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
                    </div>
                )}

                {/* Active Filter Chips */}
                {(selectedGrade || selectedSection) && (
                    <div className="flex items-center gap-2 ml-2">
                        <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />
                        <button 
                            onClick={() => handleGradeChange(null)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold hover:bg-primary/20 transition-colors"
                        >
                            Clear Filters
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <Users className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[10px] font-medium text-zinc-500">
                    Target: {selectedGrade ? `${selectedGrade}${selectedSection ? ` - ${selectedSection}` : ' (All)'}` : 'All Parents'}
                </span>
            </div>
        </div>
    );
};
