import api from "./api";

/**
 * TAFSD-616: System → Guide. The TAFSync user manual (tafs-software-manual,
 * LaTeX) is typeset by a GitHub Action there and published as the latest
 * release of that repo; the backend reads it and serves the PDFs to holders of
 * the Guide tile (system.user_guide). Shapes mirror manifest.json (schema 1).
 */
export const GUIDE_TILE = "system.user_guide";

export interface GuideFile {
    file: string;
    bytes: number;
    pages: number | null;
}

export interface GuideModule {
    /** `area/module`, e.g. `finance/defaulters-report`. */
    id: string;
    title: string;
    /** Where it lives in the app, e.g. `Finance → Financial Reports → Defaulters`. */
    where: string;
    summary: string | null;
    pdf: GuideFile;
    bare: GuideFile;
}

export interface GuideArea {
    id: string;
    title: string;
    pdf: GuideFile;
    modules: GuideModule[];
}

export interface GuideContents {
    tag: string;
    published_at: string | null;
    built_at: string;
    commit: string | null;
    title: string;
    manual: GuideFile;
    areas: GuideArea[];
}

export const guideService = {
    async contents(): Promise<GuideContents> {
        const { data } = await api.get("/v1/guide");
        return data.data;
    },
    /** One published PDF: the whole manual, an area or a module. */
    async file(file: string): Promise<Blob> {
        const { data } = await api.get(`/v1/guide/files/${encodeURIComponent(file)}`, { responseType: "blob" });
        return new Blob([data], { type: "application/pdf" });
    },
    /** Several modules as one PDF, in reading order, with a cover and contents. */
    async combine(moduleIds: string[]): Promise<Blob> {
        const { data } = await api.post("/v1/guide/combine", { modules: moduleIds }, { responseType: "blob" });
        return new Blob([data], { type: "application/pdf" });
    },
};

/** A readable file name: `TAFSync Guide - Defaulters Report.pdf`. */
export function guideFileName(title: string): string {
    const clean = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    return `TAFSync Guide - ${clean}.pdf`;
}

/**
 * Saves a Blob through a temporary link. Reusable by any docs page (the API
 * docs and MCP docs tabs can import it from here).
 */
export function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The server's message out of a blob error response, which axios leaves as a Blob. */
export async function blobErrorMessage(err: unknown, fallback: string): Promise<string> {
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            const m = parsed?.message;
            return Array.isArray(m) ? m.join(", ") : m || fallback;
        } catch {
            return fallback;
        }
    }
    const m = (data as { message?: string | string[] } | undefined)?.message;
    return (Array.isArray(m) ? m.join(", ") : m) || fallback;
}

export function formatBytes(n: number): string {
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
