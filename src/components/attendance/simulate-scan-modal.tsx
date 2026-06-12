"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Fingerprint, Loader2, X } from "lucide-react";
import { zkPushService, DeviceUserMapping, DevicePersonType } from "@/lib/zk-push.service";

interface SimulateScanModalProps {
    personType?: DevicePersonType;
    onClose: () => void;
    onDone: () => void;
}

export function SimulateScanModal({ personType = "STAFF", onClose, onDone }: SimulateScanModalProps) {
    const [mappings, setMappings] = useState<DeviceUserMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const isStaff = personType === "STAFF";
    const personLabel = isStaff ? "staff member" : "student";

    useEffect(() => {
        zkPushService
            .getMappings()
            .then((data) =>
                setMappings(
                    data.filter(
                        (m) =>
                            m.is_active &&
                            m.person_type === personType &&
                            (isStaff ? m.employee_profiles : m.students),
                    ),
                ),
            )
            .catch(() => toast.error(`Failed to load ${personLabel} mappings.`))
            .finally(() => setLoading(false));
    }, [personType, isStaff, personLabel]);

    function mappingLabel(m: DeviceUserMapping): string {
        const name = isStaff ? m.employee_profiles?.full_name : m.students?.full_name;
        return name ?? m.display_name ?? `${m.device_sn} / ${m.device_pin}`;
    }

    async function handleSubmit() {
        const mapping = mappings.find((m) => String(m.id) === selectedId);
        if (!mapping) return;
        setSubmitting(true);
        try {
            const result = await zkPushService.simulateScan({ device_sn: mapping.device_sn, device_pin: mapping.device_pin });
            if (!result.scan) {
                toast.error("Scan was not recorded.");
                return;
            }
            const time = new Date(result.scan.scan_time).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
            });
            toast.success(`Scan recorded — ${result.scan.direction ?? "—"} at ${time}, status ${result.record?.status ?? "—"}`);
            onDone();
            onClose();
        } catch {
            toast.error("Failed to simulate scan.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Fingerprint className="h-5 w-5 text-primary" />
                        Simulate Fingerprint Scan
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-zinc-500">
                    Pick a {personLabel} with a mapped device PIN to simulate a clock-in/out scan.
                </p>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : mappings.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-4 text-center">
                        No {personLabel}s have a mapped device PIN yet. Map one from ZK Device Logs first.
                    </p>
                ) : (
                    <select
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="w-full h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        <option value="">Select {personLabel}...</option>
                        {mappings.map((m) => (
                            <option key={m.id} value={m.id}>
                                {mappingLabel(m)}
                            </option>
                        ))}
                    </select>
                )}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedId || submitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? "Simulating…" : "Simulate Scan"}
                    </button>
                </div>
            </div>
        </div>
    );
}
