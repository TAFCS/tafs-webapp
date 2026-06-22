"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, AlertTriangle, CheckCircle2, Fingerprint, Info, Loader2, Pencil, Plus, Power, PowerOff, Tag, X } from "lucide-react";
import {
    zkPushService,
    DeviceUserMapping,
    DevicePersonType,
    PersonSearchResult,
    UnmappedPin,
} from "@/lib/zk-push.service";
import { PersonPicker } from "./person-picker";

interface MappingModalProps {
    mapping: DeviceUserMapping | null;
    mappings: DeviceUserMapping[];
    prefill?: Pick<UnmappedPin, "device_sn" | "device_pin" | "suggested_name">;
    onClose: () => void;
    onSaved: () => void;
}

export function MappingModal({ mapping, mappings, prefill, onClose, onSaved }: MappingModalProps) {
    const isEdit = !!mapping;
    const deviceFieldsLocked = isEdit || !!prefill;
    const [deviceSn, setDeviceSn] = useState(mapping?.device_sn ?? prefill?.device_sn ?? "");
    const [devicePin, setDevicePin] = useState(mapping?.device_pin ?? prefill?.device_pin ?? "");
    const [personType, setPersonType] = useState<DevicePersonType>(mapping?.person_type ?? "STAFF");
    const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(() => {
        if (mapping?.employee_profiles) {
            return {
                id: mapping.employee_profiles.id,
                full_name: mapping.employee_profiles.full_name,
                employee_code: mapping.employee_profiles.employee_code,
            };
        }
        if (mapping?.students) {
            return { cc: mapping.students.cc, full_name: mapping.students.full_name, gr_number: mapping.students.gr_number };
        }
        return null;
    });
    const [displayName, setDisplayName] = useState(mapping?.display_name ?? prefill?.suggested_name ?? "");
    const [notes, setNotes] = useState(mapping?.notes ?? "");
    const [isActive, setIsActive] = useState(mapping?.is_active ?? true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pinHint, setPinHint] = useState<{ type: 'info' | 'success' | 'warning'; message: string } | null>(null);

    // PIN duplication hint — only for new mappings (deviceFieldsLocked === false)
    useEffect(() => {
        if (deviceFieldsLocked || !devicePin.trim()) {
            setPinHint(null);
            return;
        }
        const handle = setTimeout(() => {
            const match = mappings.find(
                (m) => m.device_pin === devicePin.trim() && m.device_sn !== deviceSn.trim()
            );
            if (!match) {
                setPinHint({
                    type: 'info',
                    message: "This PIN isn't used on any other device yet. For best results, use the same PIN when adding this person on other devices too.",
                });
                return;
            }
            const matchedName = match.person_type === 'STAFF'
                ? (match.employee_profiles?.full_name ?? 'Unknown')
                : (match.students?.full_name ?? 'Unknown');
            const isSamePerson =
                (personType === 'STAFF' && selectedPerson?.id !== undefined && match.employee_id === selectedPerson.id) ||
                (personType === 'STUDENT' && selectedPerson?.cc !== undefined && match.student_cc === selectedPerson.cc);
            if (isSamePerson) {
                setPinHint({
                    type: 'success',
                    message: `This PIN is already linked to ${matchedName} on device ${match.device_sn} — staying consistent. ✓`,
                });
            } else {
                setPinHint({
                    type: 'warning',
                    message: `PIN ${devicePin.trim()} is already assigned to ${matchedName} on device ${match.device_sn}. Device PINs should ideally be unique across the whole school. Consider choosing a PIN that hasn't been used before.`,
                });
            }
        }, 250);
        return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devicePin, deviceSn, deviceFieldsLocked, selectedPerson, personType]);

    function handlePersonTypeChange(next: DevicePersonType) {
        if (next !== personType) {
            setPersonType(next);
            setSelectedPerson(null);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!deviceSn.trim() || !devicePin.trim()) {
            setError("Device serial and PIN are required");
            return;
        }
        if (!selectedPerson) {
            setError(`Select a ${personType === "STAFF" ? "staff member" : "student"}`);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            if (isEdit && mapping) {
                await zkPushService.updateMapping(mapping.id, {
                    person_type: personType,
                    employee_id: personType === "STAFF" ? selectedPerson.id : undefined,
                    student_cc: personType === "STUDENT" ? selectedPerson.cc : undefined,
                    display_name: displayName || undefined,
                    notes: notes || undefined,
                    is_active: isActive,
                });
            } else {
                await zkPushService.createMapping({
                    device_sn: deviceSn.trim(),
                    device_pin: devicePin.trim(),
                    person_type: personType,
                    employee_id: personType === "STAFF" ? selectedPerson.id : undefined,
                    student_cc: personType === "STUDENT" ? selectedPerson.cc : undefined,
                    display_name: displayName || undefined,
                    notes: notes || undefined,
                });
            }
            onSaved();
            onClose();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to save mapping";
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            {isEdit ? "Edit PIN Mapping" : "Map Device PIN"}
                        </h2>
                        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Device SN
                                </label>
                                <input
                                    type="text"
                                    value={deviceSn}
                                    onChange={(e) => setDeviceSn(e.target.value)}
                                    readOnly={deviceFieldsLocked}
                                    className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm outline-none font-mono ${
                                        deviceFieldsLocked
                                            ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-500"
                                            : "bg-white dark:bg-zinc-950 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Device PIN
                                </label>
                                <input
                                    type="text"
                                    value={devicePin}
                                    onChange={(e) => setDevicePin(e.target.value)}
                                    readOnly={deviceFieldsLocked}
                                    className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm outline-none font-mono ${
                                        deviceFieldsLocked
                                            ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-500"
                                            : "bg-white dark:bg-zinc-950 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    }`}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Person Type</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handlePersonTypeChange("STAFF")}
                                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                                        personType === "STAFF"
                                            ? "bg-primary text-white"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                    }`}
                                >
                                    Staff
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePersonTypeChange("STUDENT")}
                                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                                        personType === "STUDENT"
                                            ? "bg-primary text-white"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                    }`}
                                >
                                    Student
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                {personType === "STAFF" ? "Staff Member" : "Student"}
                            </label>
                            <PersonPicker personType={personType} selected={selectedPerson} onSelect={setSelectedPerson} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Display Name (optional)
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Name as shown on the device"
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Notes (optional)
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                            />
                        </div>

                        {isEdit && (
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded"
                                />
                                Active
                            </label>
                        )}

                        {/* PIN duplication hint — new mapping only */}
                        {!deviceFieldsLocked && pinHint && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                                pinHint.type === 'info'
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                    : pinHint.type === 'success'
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                            }`}>
                                {pinHint.type === 'info' && <Info className="w-4 h-4 shrink-0 mt-0.5" />}
                                {pinHint.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                                {pinHint.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                                <span>{pinHint.message}</span>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 font-medium text-white bg-primary rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Mapping"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function PinMappingsTab({ active }: { active: boolean }) {
    const [mappings, setMappings] = useState<DeviceUserMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalState, setModalState] = useState<{ mapping: DeviceUserMapping | null } | null>(null);
    const [simulatingId, setSimulatingId] = useState<number | null>(null);

    const fetchMappings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await zkPushService.getMappings();
            setMappings(data);
        } catch {
            setError("Failed to load PIN mappings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active) fetchMappings();
    }, [active, fetchMappings]);

    function personLabel(m: DeviceUserMapping) {
        if (m.person_type === "STAFF" && m.employee_profiles) {
            return `${m.employee_profiles.full_name ?? "Unnamed"}${
                m.employee_profiles.employee_code ? ` (${m.employee_profiles.employee_code})` : ""
            }`;
        }
        if (m.person_type === "STUDENT" && m.students) {
            return `${m.students.full_name}${m.students.gr_number ? ` (${m.students.gr_number})` : ""}`;
        }
        return "—";
    }

    async function toggleActive(m: DeviceUserMapping) {
        try {
            await zkPushService.updateMapping(m.id, { is_active: !m.is_active });
            fetchMappings();
        } catch {
            setError("Failed to update mapping.");
        }
    }

    async function runSimulateScan(m: DeviceUserMapping) {
        setSimulatingId(m.id);
        try {
            const result = await zkPushService.simulateScan({ device_sn: m.device_sn, device_pin: m.device_pin });
            if (!result.scan) {
                toast.error("Scan was not recorded.");
                return;
            }
            const time = new Date(result.scan.scan_time).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
            });
            const direction = result.scan.direction ?? "—";
            const status = result.record?.status ?? "—";
            const base = `Scan recorded — ${direction} at ${time}, status ${status}`;
            if (m.person_type === "STUDENT") {
                if (result.notified) {
                    toast.success(`${base}. Parent notified.`);
                } else if (result.skip_reason === "no_family_id") {
                    toast.error(`${base}. Parent not notified — student has no linked family account.`);
                } else if (result.skip_reason) {
                    toast.error(`${base}. Parent not notified (${result.skip_reason.replace(/_/g, " ")}).`);
                } else {
                    toast.success(base);
                }
            } else {
                toast.success(base);
            }
        } catch {
            toast.error("Failed to simulate scan.");
        } finally {
            setSimulatingId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">{mappings.length}</span> mappings
                </div>
                <button
                    onClick={() => setModalState({ mapping: null })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Map a PIN
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {loading && mappings.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading mappings…</span>
                    </div>
                ) : mappings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                        <Tag className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No PIN mappings yet.</p>
                        <p className="text-xs text-zinc-400 max-w-sm text-center">
                            Map device PINs to staff or students from the &ldquo;Unmapped PINs&rdquo; tab once scans
                            start arriving.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Device SN
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        PIN
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Person
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Display Name
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-2.5 w-20" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {mappings.map((m) => (
                                    <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-200">{m.device_sn}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-200">{m.device_pin}</td>
                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{m.person_type}</td>
                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{personLabel(m)}</td>
                                        <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{m.display_name ?? "—"}</td>
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
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setModalState({ mapping: m })}
                                                    className="text-zinc-400 hover:text-zinc-600"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleActive(m)}
                                                    className="text-zinc-400 hover:text-zinc-600"
                                                    title={m.is_active ? "Deactivate" : "Activate"}
                                                >
                                                    {m.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                </button>
                                                {m.is_active && (
                                                    <button
                                                        onClick={() => runSimulateScan(m)}
                                                        disabled={simulatingId === m.id}
                                                        className="text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
                                                        title="Simulate Scan"
                                                    >
                                                        {simulatingId === m.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Fingerprint className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modalState && (
                <MappingModal
                    mapping={modalState.mapping}
                    mappings={mappings}
                    onClose={() => setModalState(null)}
                    onSaved={fetchMappings}
                />
            )}
        </div>
    );
}
