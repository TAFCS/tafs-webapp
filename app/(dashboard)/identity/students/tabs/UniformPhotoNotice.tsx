"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useStudentAccess } from "@/hooks/use-student-access";
import { studentPhotosService, UNIFORM_PHOTO_FROM_CC } from "@/lib/students.service";

/**
 * TAFSD-527. Students registered after CC 7525 keep this notice until a photo
 * in school uniform replaces the one taken at admission (usually in house
 * clothes). Uploading the new photo clears it by itself; the button is for an
 * admission photo that was already in uniform.
 */
export function UniformPhotoNotice({
    cc,
    pending,
    hasPhoto,
    onChanged,
}: {
    cc: number;
    pending: boolean;
    hasPhoto: boolean;
    onChanged: () => void;
}) {
    const access = useStudentAccess();
    const [saving, setSaving] = useState(false);
    const canManage = access.can("uniform_photo");

    if (cc < UNIFORM_PHOTO_FROM_CC) return null;

    const set = async (next: boolean) => {
        setSaving(true);
        try {
            await studentPhotosService.setUniformPhotoPending(cc, next);
            toast.success(next ? "Marked as needing a uniform photo" : "Marked as already in uniform");
            onChanged();
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || "Could not update the uniform photo flag");
        } finally {
            setSaving(false);
        }
    };

    if (!pending) {
        if (!canManage) return null;
        return (
            <button
                type="button"
                disabled={saving}
                onClick={() => set(true)}
                className="text-[11px] font-semibold text-zinc-400 hover:text-amber-700 underline-offset-2 hover:underline disabled:opacity-50"
            >
                Photo not in uniform? Mark it
            </button>
        );
    }

    return (
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1">
                    <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">
                        {hasPhoto ? "Needs a school uniform photo" : "No photo yet"}
                    </p>
                    <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                        {hasPhoto
                            ? "This is still the photo from admission. Upload one in school uniform to clear this."
                            : "Upload a photo in school uniform."}
                    </p>
                </div>
            </div>
            {canManage && hasPhoto && (
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => set(false)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50 dark:bg-transparent"
                >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Already in uniform
                </button>
            )}
        </div>
    );
}
