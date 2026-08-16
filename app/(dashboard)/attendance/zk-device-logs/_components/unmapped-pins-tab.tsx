"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles, Tag, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { zkPushService, UnmappedPin, PersonSearchResult, DevicePersonType } from "@/lib/zk-push.service";
import { getDeviceName, isHiddenDevice } from "@/lib/zk-devices";
import { MappingModal } from "./pin-mappings-tab";
import { MappingImpactDialog, MappingIntent, reportRebuildIfNeeded } from "@/components/attendance/mapping-impact-dialog";

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-PK", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function SuggestedEmployeeCell({
    pin,
    suggestedName,
    onLink,
}: {
    pin: string;
    suggestedName: string | null;
    onLink: (employee: PersonSearchResult) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [match, setMatch] = useState<PersonSearchResult | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);

        async function findMatch() {
            try {
                // 1. Search using raw PIN (backend's searchSimple now transforms e.g. 40050117 -> 04-0050117, 300648 -> 03-00648)
                const codeResults = await zkPushService.searchEmployees(pin);
                if (active && codeResults && codeResults.length > 0) {
                    setMatch(codeResults[0]);
                    return;
                }

                // 2. Fallback search by clean suggested name if present
                if (suggestedName && suggestedName.trim() && suggestedName.toLowerCase() !== "unknown") {
                    const cleanName = suggestedName
                        .replace(/\s*\(\d+.*$/, "")
                        .replace(/^MS\.\s*/i, "")
                        .replace(/^MRS\.\s*/i, "")
                        .replace(/^MR\.\s*/i, "")
                        .replace(/^SIR\s*/i, "")
                        .trim();

                    if (cleanName.length >= 3) {
                        const nameResults = await zkPushService.searchEmployees(cleanName);
                        if (active && nameResults && nameResults.length > 0) {
                            setMatch(nameResults[0]);
                            return;
                        }
                    }
                }

                if (active) setMatch(null);
            } catch {
                if (active) setMatch(null);
            } finally {
                if (active) setLoading(false);
            }
        }

        findMatch();
        return () => {
            active = false;
        };
    }, [pin, suggestedName]);

    if (loading) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
            </div>
        );
    }

    if (!match) {
        return <span className="text-zinc-400 text-xs italic">No suggestion</span>;
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex flex-col">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    {match.full_name}
                </span>
                {match.employee_code && (
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                        {match.employee_code}
                    </span>
                )}
            </div>
            <button
                type="button"
                onClick={() => onLink(match)}
                title={`Review linking ${pin} to ${match.full_name}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors"
            >
                <Check className="w-3 h-3" />
                Review
            </button>
        </div>
    );
}

function SuggestedStudentCell({
    pin,
    suggestedName,
    onLink,
}: {
    pin: string;
    suggestedName: string | null;
    onLink: (student: PersonSearchResult) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [match, setMatch] = useState<PersonSearchResult | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);

        async function findMatch() {
            try {
                // 1. Search using raw PIN — students are only ever linked via PIN == CC,
                // so only accept an exact CC match here. Never suggest a GR# match for a PIN.
                const codeResults = await zkPushService.searchStudents(pin);
                const exactCcMatch = codeResults?.find((r) => String(r.cc) === pin);
                if (active && exactCcMatch) {
                    setMatch(exactCcMatch);
                    return;
                }

                // 2. Fallback search by clean suggested name if present
                if (suggestedName && suggestedName.trim() && suggestedName.toLowerCase() !== "unknown") {
                    const cleanName = suggestedName
                        .replace(/\s*\(\d+.*$/, "")
                        .replace(/^MS\.\s*/i, "")
                        .replace(/^MRS\.\s*/i, "")
                        .replace(/^MR\.\s*/i, "")
                        .replace(/^SIR\s*/i, "")
                        .trim();

                    if (cleanName.length >= 3) {
                        const nameResults = await zkPushService.searchStudents(cleanName);
                        if (active && nameResults && nameResults.length > 0) {
                            setMatch(nameResults[0]);
                            return;
                        }
                    }
                }

                if (active) setMatch(null);
            } catch {
                if (active) setMatch(null);
            } finally {
                if (active) setLoading(false);
            }
        }

        findMatch();
        return () => {
            active = false;
        };
    }, [pin, suggestedName]);

    if (loading) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
            </div>
        );
    }

    if (!match) {
        return <span className="text-zinc-400 text-xs italic">No suggestion</span>;
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex flex-col">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    {match.full_name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    CC {match.cc}
                    {match.gr_number ? ` · GR ${match.gr_number}` : ""}
                </span>
            </div>
            <button
                type="button"
                onClick={() => onLink(match)}
                title={`Review linking ${pin} to ${match.full_name}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors"
            >
                <Check className="w-3 h-3" />
                Review
            </button>
        </div>
    );
}

export function UnmappedPinsTab({ active }: { active: boolean }) {
    const [pins, setPins] = useState<UnmappedPin[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mappingTarget, setMappingTarget] = useState<UnmappedPin | null>(null);
    const [confirming, setConfirming] = useState<{
        intent: MappingIntent;
        person: PersonSearchResult;
        personType: DevicePersonType;
        pin: UnmappedPin;
        notes: string[];
    } | null>(null);

    const fetchPins = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await zkPushService.getUnmappedPins();
            setPins(data.filter((p) => !isHiddenDevice(p.device_sn)));
        } catch {
            setError("Failed to load unmapped PINs.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active) fetchPins();
    }, [active, fetchPins]);

    /**
     * Opens the confirm step rather than mapping outright. Linking now replays
     * the PIN's whole scan history onto the person, so a mis-click rewrites real
     * attendance — the operator sees exactly what moves before it happens.
     */
    async function handleQuickLink(pin: UnmappedPin, person: PersonSearchResult, personType: DevicePersonType) {
        const notes: string[] = [];
        if (personType === "STUDENT" && person.cc !== undefined) {
            const existing = await zkPushService.getMappings(undefined, person.cc).catch(() => []);
            if (existing.length > 0) {
                const list = existing
                    .map((m) => `${getDeviceName(m.device_sn)} (PIN ${m.device_pin})${m.is_active ? "" : " — inactive"}`)
                    .join(", ");
                notes.push(
                    `${person.full_name} is already mapped to: ${list}. Check this isn't a duplicate before adding another PIN.`,
                );
            }
        }

        setConfirming({
            person,
            personType,
            pin,
            notes,
            intent: {
                kind: "link",
                deviceSn: pin.device_sn,
                devicePin: pin.device_pin,
                personType,
                employeeId: personType === "STAFF" ? person.id : undefined,
                studentCc: personType === "STUDENT" ? person.cc : undefined,
                personName: person.full_name ?? "this person",
            },
        });
    }

    async function applyQuickLink(acknowledgeCollisions: boolean) {
        if (!confirming) return;
        const { pin, person, personType } = confirming;

        const result = await zkPushService.createMapping({
            device_sn: pin.device_sn,
            device_pin: pin.device_pin,
            person_type: personType,
            employee_id: personType === "STAFF" ? person.id : undefined,
            student_cc: personType === "STUDENT" ? person.cc : undefined,
            display_name: pin.suggested_name || person.full_name || undefined,
            acknowledge_collisions: acknowledgeCollisions || undefined,
        });

        setConfirming(null);
        if (!reportRebuildIfNeeded(result, fetchPins)) {
            toast.success(`Mapped PIN ${pin.device_pin} to ${person.full_name}`);
        }
        fetchPins();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{pins.length}</span> unmapped PINs with
                scan activity
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {loading && pins.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading unmapped PINs…</span>
                    </div>
                ) : pins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                        <Tag className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No unmapped PINs — every scanning device PIN is mapped.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Device
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        PIN
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Suggested Employee
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Suggested Student
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Scans
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                        First Seen
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                        Last Seen
                                    </th>
                                    <th className="px-4 py-2.5 w-32" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {pins.map((p) => (
                                    <tr
                                        key={`${p.device_sn}:${p.device_pin}`}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                    >
                                        <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">{getDeviceName(p.device_sn)}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-200">{p.device_pin}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <SuggestedEmployeeCell
                                                pin={p.device_pin}
                                                suggestedName={p.suggested_name}
                                                onLink={(emp) => handleQuickLink(p, emp, "STAFF")}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <SuggestedStudentCell
                                                pin={p.device_pin}
                                                suggestedName={p.suggested_name}
                                                onLink={(std) => handleQuickLink(p, std, "STUDENT")}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{p.scan_count}</td>
                                        <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                            {formatDateTime(p.first_seen)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                            {formatDateTime(p.last_seen)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setMappingTarget(p)}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Map this PIN
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {mappingTarget && (
                <MappingModal
                    mapping={null}
                    mappings={[]}
                    prefill={mappingTarget}
                    onClose={() => setMappingTarget(null)}
                    onSaved={fetchPins}
                />
            )}

            {confirming && (
                <MappingImpactDialog
                    intent={confirming.intent}
                    extraNotes={confirming.notes}
                    onCancel={() => setConfirming(null)}
                    onConfirm={({ acknowledgeCollisions }) => applyQuickLink(acknowledgeCollisions)}
                />
            )}
        </div>
    );
}
