"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    AlertTriangle,
    ArrowUpRight,
    Building2,
    Fingerprint,
    History,
    Info,
    Loader2,
    Pencil,
    Search,
    ShieldAlert,
    UserSearch,
} from "lucide-react";
import {
    zkPushService,
    DeviceUserMapping,
    PinLookupPerson,
    PinLookupResult,
    PinLookupWarning,
} from "@/lib/zk-push.service";
import { ZK_DEVICE_NAMES, getDeviceName, isHiddenDevice } from "@/lib/zk-devices";
import { MappingModal } from "./pin-mappings-tab";

function formatDateTime(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-PK", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

const SEVERITY_STYLES: Record<PinLookupWarning["severity"], string> = {
    HIGH: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900",
    MEDIUM: "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    LOW: "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800",
};

const IDENTITY_REASON_LABEL: Record<string, string> = {
    PIN_EQUALS_CC: "PIN equals their CC",
    PIN_EQUALS_GR: "PIN equals their GR number",
    PIN_EQUALS_EMPLOYEE_CODE: "PIN equals their employee code",
};

function SectionCard({
    title,
    icon,
    subtitle,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {icon}
                    {title}
                </div>
                {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

/** Name + identifier + class/role, with a link through to the person's own screen. */
function PersonBlock({ person }: { person: PinLookupPerson | null }) {
    const router = useRouter();
    if (!person) return <span className="text-sm text-zinc-400 italic">Nobody</span>;

    const href =
        person.kind === "STUDENT"
            ? `/identity/students?cc=${person.student_cc}`
            : `/hr/employees?id=${person.employee_id}`;

    return (
        <div className="space-y-0.5">
            <button
                onClick={() => router.push(href)}
                className="group flex items-center gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:text-primary"
            >
                {person.name}
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-medium">{person.kind}</span>
                {person.identifier && <span className="font-mono">{person.identifier}</span>}
                {person.kind === "STUDENT" && person.student_cc != null && (
                    <span className="font-mono">cc {person.student_cc}</span>
                )}
                {person.detail && <span>{person.detail}</span>}
                {person.campus && <span>{person.campus}</span>}
                {person.status && <span className="uppercase tracking-wide">{person.status}</span>}
            </div>
        </div>
    );
}

export function PinLookupTab({ active }: { active: boolean }) {
    const [pin, setPin] = useState("");
    const [deviceSn, setDeviceSn] = useState("");
    const [result, setResult] = useState<PinLookupResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<DeviceUserMapping | null>(null);
    const pinInputRef = useRef<HTMLInputElement>(null);

    // The tab stays mounted while hidden (so a lookup survives tab switches);
    // focus the field when it comes back into view instead.
    useEffect(() => {
        if (active) pinInputRef.current?.focus();
    }, [active]);

    const runLookup = useCallback(
        async (searchPin: string, sn: string) => {
            const trimmed = searchPin.trim();
            if (!trimmed) return;
            setLoading(true);
            setError(null);
            try {
                const data = await zkPushService.lookupPin(trimmed, sn || undefined);
                setResult({
                    ...data,
                    mappings: data.mappings.filter((m) => !isHiddenDevice(m.device_sn)),
                    scan_attributions: data.scan_attributions.filter((a) => !isHiddenDevice(a.device_sn)),
                });
            } catch {
                setError("Lookup failed. Check that you are logged in as a super admin.");
                setResult(null);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const hasAnything =
        !!result &&
        (result.mappings.length > 0 ||
            result.scan_attributions.length > 0 ||
            result.identity_matches.length > 0 ||
            result.name_hints.length > 0);

    return (
        <div className="space-y-6">
            {/* Search bar */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    runLookup(pin, deviceSn);
                }}
                className="flex flex-wrap items-end gap-3"
            >
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Device PIN
                    </label>
                    <div className="relative">
                        <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            ref={pinInputRef}
                            placeholder="e.g. 6102"
                            className="w-full pl-9 pr-3 py-2 font-mono border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                    </div>
                </div>
                <div className="min-w-[180px]">
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Device (optional)
                    </label>
                    <select
                        value={deviceSn}
                        onChange={(e) => setDeviceSn(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                        <option value="">All devices</option>
                        {Object.entries(ZK_DEVICE_NAMES).map(([sn, name]) => (
                            <option key={sn} value={sn}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={loading || !pin.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Look up
                </button>
            </form>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {!result && !error && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                    <UserSearch className="w-8 h-8 opacity-30" />
                    <p className="text-sm">Enter a device PIN to see who it is linked to.</p>
                    <p className="text-xs max-w-md text-center">
                        Shows every mapping carrying that PIN, who its stored scans are actually credited to, the name
                        the device itself reports, and any person whose CC, GR number or employee code equals the PIN.
                    </p>
                </div>
            )}

            {result && (
                <div className="space-y-5">
                    {/* Summary */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">PIN</p>
                            <p className="text-lg font-mono font-semibold text-zinc-900 dark:text-white">{result.pin}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Mappings</p>
                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                {result.mappings.length}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Scans</p>
                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">{result.total_scans}</p>
                        </div>
                        {result.matched_pins.length > 1 && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Also matched stored PINs: {result.matched_pins.filter((p) => p !== result.pin).join(", ")}
                            </p>
                        )}
                        {result.device_sn && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Filtered to {getDeviceName(result.device_sn)}
                            </p>
                        )}
                    </div>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                        <div className="space-y-2">
                            {result.warnings.map((w, i) => (
                                <div
                                    key={`${w.code}-${i}`}
                                    className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${SEVERITY_STYLES[w.severity]}`}
                                >
                                    {w.severity === "HIGH" ? (
                                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                    ) : w.severity === "MEDIUM" ? (
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    ) : (
                                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p className="font-medium">{w.message}</p>
                                        <p className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">
                                            {w.code.replace(/_/g, " ")}
                                            {w.device_sn ? ` · ${getDeviceName(w.device_sn)}` : ""}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Mappings */}
                    <SectionCard
                        title="Linked to"
                        icon={<Fingerprint className="w-4 h-4 text-zinc-400" />}
                        subtitle="Every mapping that carries this PIN, on every device."
                    >
                        {result.mappings.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-zinc-400 text-center">
                                This PIN is not mapped to anyone.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Device
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Person
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Stored PIN
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Scans
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-4 py-2.5 w-12" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {result.mappings.map((m) => (
                                            <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-nowrap">
                                                    {getDeviceName(m.device_sn)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <PersonBlock person={m.person} />
                                                    {(m.display_name || m.notes) && (
                                                        <p className="text-xs text-zinc-400 mt-1">
                                                            {m.display_name && `“${m.display_name}”`}
                                                            {m.display_name && m.notes ? " · " : ""}
                                                            {m.notes}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-mono text-zinc-600 dark:text-zinc-300">
                                                    {m.device_pin}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                                    {m.scan_count}
                                                    <span className="block text-xs text-zinc-400">
                                                        last {formatDateTime(m.last_scan_at)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            m.is_active
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                                        }`}
                                                    >
                                                        {m.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setEditing(m)}
                                                        className="text-zinc-400 hover:text-zinc-600"
                                                        title="Edit this mapping"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </SectionCard>

                    {/* Scan attribution */}
                    {result.scan_attributions.length > 0 && (
                        <SectionCard
                            title="Scans are credited to"
                            icon={<Fingerprint className="w-4 h-4 text-zinc-400" />}
                            subtitle="Stored scans keep the person they were attributed to at ingest — which can differ from the mapping above."
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Device
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Credited to
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Scans
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                First / last seen
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Matches mapping
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {result.scan_attributions.map((a, i) => (
                                            <tr
                                                key={`${a.device_sn}-${i}`}
                                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                            >
                                                <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-nowrap">
                                                    {getDeviceName(a.device_sn)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <PersonBlock person={a.attributed_to} />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                                                    {a.scan_count}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                                    {formatDateTime(a.first_seen)}
                                                    <span className="block">{formatDateTime(a.last_seen)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            a.matches_current_mapping
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                                        }`}
                                                    >
                                                        {a.matches_current_mapping ? "Yes" : "No — drifted"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    )}

                    {/* Device name hints */}
                    {result.name_hints.length > 0 && (
                        <SectionCard
                            title="The device calls this PIN"
                            icon={<Building2 className="w-4 h-4 text-zinc-400" />}
                            subtitle="Name enrolled on the hardware itself — the best independent check on who the PIN really belongs to."
                        >
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {result.name_hints.map((h) => (
                                    <li key={`${h.device_sn}-${h.device_pin}`} className="px-4 py-3 text-sm">
                                        <span className="text-zinc-700 dark:text-zinc-200 font-medium">
                                            {h.suggested_name?.trim() || "(no name on device)"}
                                        </span>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
                                            {getDeviceName(h.device_sn)} · PIN {h.device_pin} · updated{" "}
                                            {formatDateTime(h.updated_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}

                    {/* Identity clashes */}
                    {result.identity_matches.length > 0 && (
                        <SectionCard
                            title="People whose own ID equals this PIN"
                            icon={<AlertTriangle className="w-4 h-4 text-zinc-400" />}
                            subtitle="CC, GR numbers and employee codes share a numeric space with PINs — this is how a PIN ends up on the wrong person."
                        >
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {result.identity_matches.map((p, i) => (
                                    <li key={`${p.kind}-${p.student_cc ?? p.employee_id}-${i}`} className="px-4 py-3 flex items-center justify-between gap-4">
                                        <PersonBlock person={p} />
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                            {IDENTITY_REASON_LABEL[p.reason] ?? p.reason}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}

                    {/* History */}
                    {result.history.length > 0 && (
                        <SectionCard
                            title="Mapping history"
                            icon={<History className="w-4 h-4 text-zinc-400" />}
                            subtitle="Who pointed this PIN where, and when."
                        >
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {result.history.map((h) => (
                                    <li key={h.id} className="px-4 py-3 text-sm">
                                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-medium">
                                                {h.action}
                                            </span>
                                            <span>{formatDateTime(h.changed_at)}</span>
                                            <span>· {h.changed_by}</span>
                                        </div>
                                        {h.note && <p className="text-zinc-600 dark:text-zinc-300 mt-1">{h.note}</p>}
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}

                    {!hasAnything && (
                        <p className="text-sm text-zinc-400 text-center py-6">
                            Nothing found for PIN {result.pin}. It has never been mapped and has never scanned.
                        </p>
                    )}
                </div>
            )}

            {editing && (
                <MappingModal
                    mapping={editing}
                    mappings={result?.mappings ?? []}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        runLookup(result?.pin ?? pin, deviceSn);
                    }}
                />
            )}
        </div>
    );
}
