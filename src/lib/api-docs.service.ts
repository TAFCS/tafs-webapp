import api from "./api";

/**
 * TAFSD-614: the API Docs tile (system.api_docs). The documents and their PDFs
 * live in the backend (src/modules/api-docs, docs/api-docs) and are served only
 * to holders of the tile, so none of it ships on the public CDN. Types mirror
 * api-docs.types.ts there.
 */

export type ApiDocBlock =
    | { type: "p"; text: string }
    | { type: "list"; items: string[]; ordered?: boolean }
    | { type: "table"; head: string[]; rows: string[][] }
    | { type: "code"; title?: string; code: string }
    | { type: "note"; tone: "info" | "warn"; text: string };

export interface ApiDocSection {
    id: string;
    title: string;
    blocks: ApiDocBlock[];
    subsections?: ApiDocSection[];
}

export interface ApiDoc {
    slug: string;
    title: string;
    subtitle: string;
    version: string;
    updated: string;
    summary: string;
    pdfFile: string;
    downloadName: string;
    sections: ApiDocSection[];
}

export interface ApiDocSummary {
    slug: string;
    title: string;
    subtitle: string;
    version: string;
    updated: string;
    summary: string;
    pdf_available: boolean;
}

/** Reads the backend's error message out of a failed blob request. */
async function blobError(err: unknown, fallback: string): Promise<string> {
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
        try {
            const body = JSON.parse(await data.text());
            if (typeof body?.message === "string") return body.message;
        } catch {
            /* not JSON */
        }
    }
    return fallback;
}

export const apiDocsService = {
    async list(): Promise<ApiDocSummary[]> {
        const { data } = await api.get("/v1/api-docs");
        return data.data;
    },

    async get(slug: string): Promise<ApiDoc> {
        const { data } = await api.get(`/v1/api-docs/${encodeURIComponent(slug)}`);
        return data.data;
    },

    async pdf(slug: string): Promise<Blob> {
        try {
            const { data } = await api.get(`/v1/api-docs/${encodeURIComponent(slug)}/pdf`, { responseType: "blob" });
            return data;
        } catch (err) {
            throw new Error(await blobError(err, "Could not download the PDF"));
        }
    },
};
