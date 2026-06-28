"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint, Loader2, Plus, Power, PowerOff, ExternalLink, X } from "lucide-react";
import { zkPushService, DeviceUserMapping } from "@/lib/zk-push.service";

interface Props {
  employeeId: number;
  employeeName: string;
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function MappingFormModal({
  employeeId,
  employeeName,
  mapping,
  onClose,
  onSaved,
}: {
  employeeId: number;
  employeeName: string;
  mapping: DeviceUserMapping | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!mapping;
  const [deviceSn, setDeviceSn] = useState(mapping?.device_sn ?? "");
  const [devicePin, setDevicePin] = useState(mapping?.device_pin ?? "");
  const [displayName, setDisplayName] = useState(mapping?.display_name ?? employeeName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceSn.trim() || !devicePin.trim()) {
      setError("Device S/N and PIN are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && mapping) {
        await zkPushService.updateMapping(mapping.id, {
          display_name: displayName.trim() || undefined,
        });
      } else {
        await zkPushService.createMapping({
          device_sn: deviceSn.trim(),
          device_pin: devicePin.trim(),
          person_type: "STAFF",
          employee_id: employeeId,
          display_name: displayName.trim() || employeeName,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save mapping.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
              {isEdit ? "Edit mapping" : "Add device mapping"}
            </h4>
            <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">Device S/N</label>
              <input className={inputCls} value={deviceSn} disabled={isEdit}
                onChange={(e) => setDeviceSn(e.target.value)} required />
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">PIN</label>
              <input className={inputCls} value={devicePin} disabled={isEdit}
                onChange={(e) => setDevicePin(e.target.value)} required />
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">Display name</label>
              <input className={inputCls} value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 text-sm font-semibold text-zinc-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="h-9 px-4 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EmployeeBiometricTab({ employeeId, employeeName }: Props) {
  const [mappings, setMappings] = useState<DeviceUserMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DeviceUserMapping | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMappings(await zkPushService.getMappings(employeeId));
    } catch (err: any) {
      setMappings([]);
      const status = err?.response?.status;
      if (status === 403) {
        setError("You do not have permission to view biometric mappings.");
      } else {
        setError(err?.response?.data?.message || "Failed to load biometric mappings.");
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (mapping: DeviceUserMapping) => {
    try {
      await zkPushService.updateMapping(mapping.id, { is_active: !mapping.is_active });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update mapping.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Fingerprint className="h-4 w-4" /> Biometric device mappings
        </h3>
        <div className="flex items-center gap-2">
          <Link href="/attendance/zk-device-logs"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-primary">
            Manage all <ExternalLink className="h-3 w-3" />
          </Link>
          {!error && (
            <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold text-white bg-primary rounded-xl">
              <Plus className="h-3.5 w-3.5" /> Add mapping
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400 text-center py-10 font-medium">{error}</p>
      ) : mappings.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-10">
          No device PINs mapped to this employee. Add a mapping so biometric punches are recognized.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase">
                <th className="py-2 pr-4">Device S/N</th>
                <th className="py-2 pr-4">PIN</th>
                <th className="py-2 pr-4">Display name</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{m.device_sn}</td>
                  <td className="py-3 pr-4 font-mono font-bold">{m.device_pin}</td>
                  <td className="py-3 pr-4">{m.display_name ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-bold ${m.is_active ? "text-emerald-600" : "text-zinc-400"}`}>
                      {m.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-1">
                    <button type="button" onClick={() => { setEditing(m); setShowModal(true); }}
                      className="text-xs font-semibold text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => toggleActive(m)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 inline-flex align-middle"
                      title={m.is_active ? "Deactivate" : "Activate"}>
                      {m.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <MappingFormModal
          employeeId={employeeId}
          employeeName={employeeName}
          mapping={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
