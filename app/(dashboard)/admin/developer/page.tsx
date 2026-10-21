"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  AlertTriangle, 
  Smartphone, 
  ShieldAlert, 
  Save, 
  Loader2,
  Users,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useDeveloperSettingsAccess } from "@/hooks/use-developer-settings-access";
import { invalidateOverrideCutoff } from "@/lib/attendance-override-cutoff";

interface ConfigItem {
  key: string;
  value: string;
}

type MobileAppTab = "staff" | "parent";

export default function DeveloperSettingsPage() {
  const access = useDeveloperSettingsAccess();
  const canView = access.can("view");
  const canEdit = access.can("edit");

  const [activeTab, setActiveTab] = useState<MobileAppTab>("staff");

  const [configs, setConfigs] = useState<Record<string, string>>({
    // Staff App Controls
    staff_maintenance_mode: "false",
    staff_maintenance_message: "The staff app is currently under maintenance. Please try again later.",
    staff_min_android_build: "1",
    staff_min_ios_build: "1",
    staff_android_store_url: "https://play.google.com/store/apps/details?id=com.tafsstaff.app",
    staff_ios_store_url: "https://apps.apple.com/app/id6572338575",

    // Parent App Controls
    parent_maintenance_mode: "false",
    parent_maintenance_message: "The parent app is currently under maintenance. Please try again later.",
    parent_min_android_build: "1",
    parent_min_ios_build: "1",
    parent_android_store_url: "https://play.google.com/store/apps/details?id=com.tafs.app",
    parent_ios_store_url: "https://apps.apple.com/app/id6572338575",

    // System Features
    pay_immediately_enabled: "false",
    attendance_same_day_override_cutoff: "15:00",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStaffVersions, setIsSavingStaffVersions] = useState(false);
  const [isSavingStaffMaintenance, setIsSavingStaffMaintenance] = useState(false);
  const [isSavingParentVersions, setIsSavingParentVersions] = useState(false);
  const [isSavingParentMaintenance, setIsSavingParentMaintenance] = useState(false);
  const [isSavingPayImmediate, setIsSavingPayImmediate] = useState(false);
  const [isSavingCutoff, setIsSavingCutoff] = useState(false);

  const [showConfirmMaintenance, setShowConfirmMaintenance] = useState(false);
  const [pendingMaintenanceTarget, setPendingMaintenanceTarget] = useState<MobileAppTab | null>(null);

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/v1/app-config");
      const configList: ConfigItem[] = data?.data || [];
      const configMap: Record<string, string> = {};
      
      configList.forEach((cfg) => {
        configMap[cfg.key] = cfg.value;
      });

      setConfigs((prev) => ({
        ...prev,
        ...configMap,
      }));
    } catch (err: unknown) {
      toast.error("Failed to load developer configurations");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canView) fetchConfigs();
  }, [canView]);

  const handleSaveStaffVersions = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStaffVersions(true);
    const loadingToast = toast.loading("Saving Staff app version settings...");
    try {
      const keys = [
        "staff_min_android_build",
        "staff_min_ios_build",
        "staff_android_store_url",
        "staff_ios_store_url",
      ];
      for (const key of keys) {
        await api.patch(`/v1/app-config/${key}`, { value: configs[key] ?? "" });
      }
      toast.success("Staff app version settings updated", { id: loadingToast });
    } catch {
      toast.error("Failed to save Staff app version settings", { id: loadingToast });
    } finally {
      setIsSavingStaffVersions(false);
    }
  };

  const handleSaveStaffMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStaffMaintenance(true);
    const loadingToast = toast.loading("Saving Staff maintenance settings...");
    try {
      await api.patch("/v1/app-config/staff_maintenance_mode", { value: configs.staff_maintenance_mode });
      await api.patch("/v1/app-config/staff_maintenance_message", { value: configs.staff_maintenance_message });
      toast.success("Staff maintenance settings updated", { id: loadingToast });
    } catch {
      toast.error("Failed to save Staff maintenance settings", { id: loadingToast });
    } finally {
      setIsSavingStaffMaintenance(false);
    }
  };

  const handleSaveParentVersions = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingParentVersions(true);
    const loadingToast = toast.loading("Saving Parent app version settings...");
    try {
      const keys = [
        "parent_min_android_build",
        "parent_min_ios_build",
        "parent_android_store_url",
        "parent_ios_store_url",
      ];
      for (const key of keys) {
        await api.patch(`/v1/app-config/${key}`, { value: configs[key] ?? "" });
      }
      toast.success("Parent app version settings updated", { id: loadingToast });
    } catch {
      toast.error("Failed to save Parent app version settings", { id: loadingToast });
    } finally {
      setIsSavingParentVersions(false);
    }
  };

  const handleSaveParentMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingParentMaintenance(true);
    const loadingToast = toast.loading("Saving Parent maintenance settings...");
    try {
      await api.patch("/v1/app-config/parent_maintenance_mode", { value: configs.parent_maintenance_mode });
      await api.patch("/v1/app-config/parent_maintenance_message", { value: configs.parent_maintenance_message });
      toast.success("Parent maintenance settings updated", { id: loadingToast });
    } catch {
      toast.error("Failed to save Parent maintenance settings", { id: loadingToast });
    } finally {
      setIsSavingParentMaintenance(false);
    }
  };

  const handleSavePayImmediate = async (nextVal: boolean) => {
    const prevVal = configs.pay_immediately_enabled;
    setConfigs((prev) => ({ ...prev, pay_immediately_enabled: String(nextVal) }));
    setIsSavingPayImmediate(true);
    const loadingToast = toast.loading("Saving PAY IMMEDIATELY setting...");
    try {
      await api.patch("/v1/app-config/pay_immediately_enabled", { value: String(nextVal) });
      toast.success("PAY IMMEDIATELY setting updated successfully", { id: loadingToast });
    } catch {
      setConfigs((prev) => ({ ...prev, pay_immediately_enabled: prevVal }));
      toast.error("Failed to save PAY IMMEDIATELY setting", { id: loadingToast });
    } finally {
      setIsSavingPayImmediate(false);
    }
  };

  const handleSaveCutoff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCutoff(true);
    const loadingToast = toast.loading("Saving override cut-off...");
    try {
      await api.patch("/v1/app-config/attendance_same_day_override_cutoff", {
        value: configs.attendance_same_day_override_cutoff,
      });
      invalidateOverrideCutoff();
      toast.success("Override cut-off updated successfully", { id: loadingToast });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Failed to save override cut-off", { id: loadingToast });
    } finally {
      setIsSavingCutoff(false);
    }
  };

  const handleMaintenanceToggle = (app: MobileAppTab, targetVal: boolean) => {
    if (targetVal) {
      setPendingMaintenanceTarget(app);
      setShowConfirmMaintenance(true);
    } else {
      if (app === "staff") {
        setConfigs((prev) => ({ ...prev, staff_maintenance_mode: "false" }));
      } else {
        setConfigs((prev) => ({ ...prev, parent_maintenance_mode: "false" }));
      }
    }
  };

  const confirmMaintenanceOn = () => {
    if (pendingMaintenanceTarget === "staff") {
      setConfigs((prev) => ({ ...prev, staff_maintenance_mode: "true" }));
    } else if (pendingMaintenanceTarget === "parent") {
      setConfigs((prev) => ({ ...prev, parent_maintenance_mode: "true" }));
    }
    setShowConfirmMaintenance(false);
    setPendingMaintenanceTarget(null);
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 bg-red-50 text-red-500 rounded-full">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h2 className="text-xl font-black text-zinc-800">Access Denied</h2>
        <p className="text-zinc-500 max-w-xs text-center text-sm font-medium">
          Your access does not include Developer Settings. Ask an administrator to grant the tile in People &amp; Access.
        </p>
      </div>
    );
  }

  const isStaffMaintenanceOn = configs.staff_maintenance_mode === "true";
  const isParentMaintenanceOn = configs.parent_maintenance_mode === "true";
  const isPayImmediateOn = configs.pay_immediately_enabled === "true";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-950 text-white rounded-2xl">
              <Settings className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Developer Settings</h1>
          </div>
          <p className="text-zinc-500 text-sm font-medium pl-1">
            Independent remote controls for Staff and Parent mobile applications, versions, store mappings, and maintenance.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4 bg-white rounded-[32px] border border-zinc-100 shadow-sm">
          <Loader2 className="h-10 w-10 text-zinc-900 animate-spin" />
          <p className="text-zinc-500 text-sm font-black uppercase tracking-wider animate-pulse">Loading settings...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* App Switcher Tabs */}
          <div className="flex items-center gap-3 p-1.5 bg-zinc-100/80 rounded-2xl w-fit border border-zinc-200/50">
            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 ${
                activeTab === "staff"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Staff App</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200">
                com.tafsstaff.app
              </span>
              {isStaffMaintenanceOn && (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Maintenance Mode Active" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("parent")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 ${
                activeTab === "parent"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Parent App</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200">
                com.tafs.app
              </span>
              {isParentMaintenanceOn && (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Maintenance Mode Active" />
              )}
            </button>
          </div>

          {/* STAFF APP SECTION */}
          {activeTab === "staff" && (
            <motion.div
              key="staff-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-zinc-700" />
                    Staff App Configuration
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    Controls specifically for TAFS Staff employees (<code className="font-mono">com.tafsstaff.app</code>). Does not affect parents.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Staff Version Control */}
                <form onSubmit={handleSaveStaffVersions} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-black text-zinc-800 text-lg">Staff App Version Control</h3>
                    <p className="text-xs text-zinc-400 font-medium">
                      Require minimum build versions and manage staff store deep links.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Staff Min Android Build */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                        Min Android Build
                      </label>
                      <input
                        type="number"
                        required
                        value={configs.staff_min_android_build}
                        onChange={(e) => setConfigs({ ...configs, staff_min_android_build: e.target.value })}
                        className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-bold"
                        placeholder="e.g. 51"
                      />
                    </div>

                    {/* Staff Min iOS Build */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                        Min iOS Build
                      </label>
                      <input
                        type="number"
                        required
                        value={configs.staff_min_ios_build}
                        onChange={(e) => setConfigs({ ...configs, staff_min_ios_build: e.target.value })}
                        className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-bold"
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>

                  {/* Staff Android Play Store URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5" /> Staff Android Play Store URL
                    </label>
                    <input
                      type="url"
                      required
                      value={configs.staff_android_store_url}
                      onChange={(e) => setConfigs({ ...configs, staff_android_store_url: e.target.value })}
                      className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium"
                      placeholder="https://play.google.com/store/apps/details?id=com.tafsstaff.app"
                    />
                  </div>

                  {/* Staff iOS App Store URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5" /> Staff iOS App Store URL
                    </label>
                    <input
                      type="url"
                      required
                      value={configs.staff_ios_store_url}
                      onChange={(e) => setConfigs({ ...configs, staff_ios_store_url: e.target.value })}
                      className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium"
                      placeholder="https://apps.apple.com/app/id6572338575"
                    />
                  </div>

                  <div className="pt-4 border-t border-zinc-50 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingStaffVersions || !canEdit}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSavingStaffVersions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Staff Versions
                    </button>
                  </div>
                </form>

                {/* Staff Maintenance Mode */}
                <form onSubmit={handleSaveStaffMaintenance} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-black text-zinc-800 text-lg">Staff Maintenance Mode</h3>
                    <p className="text-xs text-zinc-400 font-medium">
                      Control accessibility specifically for the Staff mobile app.
                    </p>
                  </div>

                  {/* Toggle Status Widget */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isStaffMaintenanceOn ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Staff App Status</p>
                        <p className="text-xs font-black text-zinc-700">
                          {isStaffMaintenanceOn ? "ACTIVE (STAFF BLOCKED)" : "INACTIVE (ONLINE)"}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleMaintenanceToggle("staff", !isStaffMaintenanceOn)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        isStaffMaintenanceOn ? "bg-rose-600" : "bg-zinc-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isStaffMaintenanceOn ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Staff Maintenance Message */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                      Staff Maintenance Message
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={configs.staff_maintenance_message}
                      onChange={(e) => setConfigs({ ...configs, staff_maintenance_message: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium resize-none"
                      placeholder="The staff app is currently under maintenance. Please try again later."
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-amber-800/80 text-[11px] leading-relaxed">
                      Click <strong>Save Staff Maintenance Settings</strong> after changing the toggle or message copy to apply changes.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-50 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingStaffMaintenance || !canEdit}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSavingStaffMaintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Staff Maintenance
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* PARENT APP SECTION */}
          {activeTab === "parent" && (
            <motion.div
              key="parent-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-zinc-700" />
                    Parent App Configuration
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    Controls specifically for TAFS Parent / Student families (<code className="font-mono">com.tafs.app</code>). Does not affect staff.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Parent Version Control */}
                <form onSubmit={handleSaveParentVersions} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-black text-zinc-800 text-lg">Parent App Version Control</h3>
                    <p className="text-xs text-zinc-400 font-medium">
                      Require minimum build versions and manage parent store deep links.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Parent Min Android Build */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                        Min Android Build
                      </label>
                      <input
                        type="number"
                        required
                        value={configs.parent_min_android_build}
                        onChange={(e) => setConfigs({ ...configs, parent_min_android_build: e.target.value })}
                        className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-bold"
                        placeholder="e.g. 47"
                      />
                    </div>

                    {/* Parent Min iOS Build */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                        Min iOS Build
                      </label>
                      <input
                        type="number"
                        required
                        value={configs.parent_min_ios_build}
                        onChange={(e) => setConfigs({ ...configs, parent_min_ios_build: e.target.value })}
                        className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-bold"
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>

                  {/* Parent Android Play Store URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5" /> Parent Android Play Store URL
                    </label>
                    <input
                      type="url"
                      required
                      value={configs.parent_android_store_url}
                      onChange={(e) => setConfigs({ ...configs, parent_android_store_url: e.target.value })}
                      className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium"
                      placeholder="https://play.google.com/store/apps/details?id=com.tafs.app"
                    />
                  </div>

                  {/* Parent iOS App Store URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5" /> Parent iOS App Store URL
                    </label>
                    <input
                      type="url"
                      required
                      value={configs.parent_ios_store_url}
                      onChange={(e) => setConfigs({ ...configs, parent_ios_store_url: e.target.value })}
                      className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium"
                      placeholder="https://apps.apple.com/app/id6572338575"
                    />
                  </div>

                  <div className="pt-4 border-t border-zinc-50 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingParentVersions || !canEdit}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSavingParentVersions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Parent Versions
                    </button>
                  </div>
                </form>

                {/* Parent Maintenance Mode */}
                <form onSubmit={handleSaveParentMaintenance} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-black text-zinc-800 text-lg">Parent Maintenance Mode</h3>
                    <p className="text-xs text-zinc-400 font-medium">
                      Control accessibility specifically for the Parent mobile app.
                    </p>
                  </div>

                  {/* Toggle Status Widget */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isParentMaintenanceOn ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Parent App Status</p>
                        <p className="text-xs font-black text-zinc-700">
                          {isParentMaintenanceOn ? "ACTIVE (PARENTS BLOCKED)" : "INACTIVE (ONLINE)"}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleMaintenanceToggle("parent", !isParentMaintenanceOn)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        isParentMaintenanceOn ? "bg-rose-600" : "bg-zinc-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isParentMaintenanceOn ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Parent Maintenance Message */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                      Parent Maintenance Message
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={configs.parent_maintenance_message}
                      onChange={(e) => setConfigs({ ...configs, parent_maintenance_message: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium resize-none"
                      placeholder="The parent app is currently under maintenance. Please try again later."
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-amber-800/80 text-[11px] leading-relaxed">
                      Click <strong>Save Parent Maintenance Settings</strong> after changing the toggle or message copy to apply changes.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-50 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingParentMaintenance || !canEdit}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSavingParentMaintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Parent Maintenance
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* SHARED SYSTEM CONTROLS */}
          <div className="pt-6 border-t border-zinc-200/60">
            <h2 className="text-xl font-black text-zinc-900 mb-6">Additional Developer Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Card: PAY IMMEDIATELY Vouchers */}
              <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
                <div className="space-y-2">
                  <h3 className="font-black text-zinc-800 text-lg">PAY IMMEDIATELY Vouchers</h3>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    When on, a voucher issued to a student who hasn&apos;t paid their last two vouchers
                    gets a &quot;PAY IMMEDIATELY&quot; watermark and, by default, 4 days to pay (moved to Monday
                    if that lands on a Sunday) — the issuer can choose their own dates instead. Applies to single, bulk, and split issuance.
                  </p>
                </div>

                {/* Toggle Status Widget */}
                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isPayImmediateOn ? "bg-rose-100 text-rose-700" : "bg-zinc-200 text-zinc-500"}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">PAY IMMEDIATELY</p>
                      <p className="text-xs font-black text-zinc-700">{isPayImmediateOn ? "ENFORCED" : "DISABLED"}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    disabled={isSavingPayImmediate || !canEdit}
                    onClick={() => handleSavePayImmediate(!isPayImmediateOn)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none disabled:opacity-50 ${
                      isPayImmediateOn ? "bg-rose-600" : "bg-zinc-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isPayImmediateOn ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Card: Same-day attendance override cut-off */}
              <form onSubmit={handleSaveCutoff} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
                <div className="space-y-2">
                  <h3 className="font-black text-zinc-800 text-lg">Same-Day Attendance Overrides</h3>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    From this time (Pakistan time) HR can override today&apos;s staff attendance — mark a
                    status or enter a missing clock-out — even if the day isn&apos;t complete. Before it,
                    today can only be overridden once it has both a clock-in and a clock-out.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <label className="space-y-2 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cut-off time (PKT)</span>
                    <input
                      type="time"
                      required
                      value={configs.attendance_same_day_override_cutoff}
                      onChange={(e) =>
                        setConfigs((prev) => ({ ...prev, attendance_same_day_override_cutoff: e.target.value }))
                      }
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-zinc-200"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingCutoff || !canEdit}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isSavingCutoff ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Maintenance Mode */}
      <AnimatePresence>
        {showConfirmMaintenance && pendingMaintenanceTarget && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-zinc-100 p-6 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex gap-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-zinc-900 text-lg leading-tight">
                    Activate Maintenance Mode for {pendingMaintenanceTarget === "staff" ? "Staff App" : "Parent App"}?
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    This will block access for all active {pendingMaintenanceTarget === "staff" ? "Staff mobile app users" : "Parent/Student mobile app users"} immediately. {pendingMaintenanceTarget === "staff" ? "Parents" : "Staff members"} will remain unaffected.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmMaintenance(false);
                    setPendingMaintenanceTarget(null);
                  }}
                  className="px-5 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMaintenanceOn}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-rose-100 transition-all active:scale-[0.98]"
                >
                  Enable Maintenance
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
