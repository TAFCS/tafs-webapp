"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  AlertTriangle, 
  Smartphone, 
  ShieldAlert, 
  Save, 
  Loader2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";

interface ConfigItem {
  key: string;
  value: string;
}

export default function DeveloperSettingsPage() {
  const { user } = useAuthState();
  const [configs, setConfigs] = useState<Record<string, string>>({
    maintenance_mode: "false",
    maintenance_message: "The app is currently under maintenance. Please try again later.",
    min_android_build: "1",
    min_ios_build: "1",
    android_store_url: "",
    ios_store_url: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingVersions, setIsSavingVersions] = useState(false);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [showConfirmMaintenance, setShowConfirmMaintenance] = useState(false);
  const [pendingMaintenanceVal, setPendingMaintenanceVal] = useState<boolean>(false);

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
    } catch (error: any) {
      toast.error("Failed to load developer configurations");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSaveVersions = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingVersions(true);
    const loadingToast = toast.loading("Saving version settings...");
    try {
      const keysToSave = [
        "min_android_build",
        "min_ios_build",
        "android_store_url",
        "ios_store_url",
      ];
      
      for (const key of keysToSave) {
        await api.patch(`/v1/app-config/${key}`, { value: configs[key] });
      }
      
      toast.success("Version settings updated successfully", { id: loadingToast });
    } catch (error: any) {
      toast.error("Failed to save version settings", { id: loadingToast });
    } finally {
      setIsSavingVersions(false);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMaintenance(true);
    const loadingToast = toast.loading("Saving maintenance settings...");
    try {
      await api.patch("/v1/app-config/maintenance_mode", { value: configs.maintenance_mode });
      await api.patch("/v1/app-config/maintenance_message", { value: configs.maintenance_message });
      toast.success("Maintenance settings updated successfully", { id: loadingToast });
    } catch (error: any) {
      toast.error("Failed to save maintenance settings", { id: loadingToast });
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  const handleMaintenanceToggle = (targetVal: boolean) => {
    if (targetVal) {
      setPendingMaintenanceVal(true);
      setShowConfirmMaintenance(true);
    } else {
      setConfigs((prev) => ({ ...prev, maintenance_mode: "false" }));
    }
  };

  const confirmMaintenanceOn = () => {
    setShowConfirmMaintenance(false);
    setConfigs((prev) => ({ ...prev, maintenance_mode: "true" }));
  };

  if (user && user.role !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 bg-red-50 text-red-500 rounded-full">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h2 className="text-xl font-black text-zinc-800">Access Denied</h2>
        <p className="text-zinc-500 max-w-xs text-center text-sm font-medium">
          Only Super Administrator accounts are authorized to access developer system configurations.
        </p>
      </div>
    );
  }

  const isMaintenanceOn = configs.maintenance_mode === "true";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
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
            Global remote controls for mobile applications, maintenance windows, and store mappings.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4 bg-white rounded-[32px] border border-zinc-100 shadow-sm">
          <Loader2 className="h-10 w-10 text-zinc-900 animate-spin" />
          <p className="text-zinc-500 text-sm font-black uppercase tracking-wider animate-pulse">Loading settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* Card 1: App Version Control */}
          <form onSubmit={handleSaveVersions} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <h3 className="font-black text-zinc-800 text-lg">App Version Control</h3>
              <p className="text-xs text-zinc-400 font-medium">Manage minimum required build versions and store links.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Min Android Build */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                  Min Android Build
                </label>
                <input
                  type="number"
                  required
                  value={configs.min_android_build}
                  onChange={(e) => setConfigs({ ...configs, min_android_build: e.target.value })}
                  className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-bold"
                  placeholder="e.g. 1"
                />
              </div>

              {/* Min iOS Build */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                  Min iOS Build
                </label>
                <input
                  type="number"
                  required
                  value={configs.min_ios_build}
                  onChange={(e) => setConfigs({ ...configs, min_ios_build: e.target.value })}
                  className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-bold"
                  placeholder="e.g. 1"
                />
              </div>
            </div>

            {/* Android Play Store URL */}
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Android Play Store URL
              </label>
              <input
                type="url"
                required
                value={configs.android_store_url}
                onChange={(e) => setConfigs({ ...configs, android_store_url: e.target.value })}
                className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium"
                placeholder="https://play.google.com/store/apps/details?id=..."
              />
            </div>

            {/* iOS App Store URL */}
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> iOS App Store URL
              </label>
              <input
                type="url"
                required
                value={configs.ios_store_url}
                onChange={(e) => setConfigs({ ...configs, ios_store_url: e.target.value })}
                className="w-full h-11 px-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium"
                placeholder="https://apps.apple.com/app/..."
              />
            </div>

            <div className="pt-4 border-t border-zinc-50 flex justify-end">
              <button
                type="submit"
                disabled={isSavingVersions}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSavingVersions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save App Versions
              </button>
            </div>
          </form>

          {/* Card 2: Maintenance Mode */}
          <form onSubmit={handleSaveMaintenance} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <h3 className="font-black text-zinc-800 text-lg">Maintenance Mode</h3>
              <p className="text-xs text-zinc-400 font-medium">Control global system accessibility and notification copy.</p>
            </div>

            {/* Toggle Status Widget */}
            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isMaintenanceOn ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Maintenance Mode</p>
                  <p className="text-xs font-black text-zinc-700">{isMaintenanceOn ? "ACTIVE (BLOCKED)" : "INACTIVE (ONLINE)"}</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => handleMaintenanceToggle(!isMaintenanceOn)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  isMaintenanceOn ? "bg-rose-600" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isMaintenanceOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Maintenance Message */}
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                Maintenance Message
              </label>
              <textarea
                rows={4}
                required
                value={configs.maintenance_message}
                onChange={(e) => setConfigs({ ...configs, maintenance_message: e.target.value })}
                className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-white focus:border-zinc-200 text-zinc-800 text-sm font-medium resize-none"
                placeholder="The app is currently under maintenance. Please try again later."
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800/80 text-[11px] leading-relaxed">
                Remember to click <strong>Save Maintenance Settings</strong> after changing the toggle status or the message copy to apply changes.
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-50 flex justify-end">
              <button
                type="submit"
                disabled={isSavingMaintenance}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSavingMaintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Maintenance Settings
              </button>
            </div>
          </form>

        </div>
      )}

      {/* Confirmation Modal for Maintenance Mode */}
      <AnimatePresence>
        {showConfirmMaintenance && (
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
                  <h3 className="font-black text-zinc-900 text-lg leading-tight">Activate Maintenance Mode?</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    This will block access for all active mobile app users immediately. Are you absolutely sure you want to proceed?
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmMaintenance(false)}
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
