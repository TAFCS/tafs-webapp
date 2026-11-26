/**
 * TAFSD-615: plain-language wording for a generated MCP tool (its inputs and
 * who may use it), shared by the MCP Docs page and the PDF build. No imports:
 * the PDF build loads this file with plain Node.
 */

export type GeneratedSchema = {
    type?: string;
    description?: string;
    pattern?: string;
    enum?: readonly string[];
    minimum?: number;
    maximum?: number;
    items?: { type?: string };
};

export type GeneratedTool = {
    name: string;
    title: string;
    description: string;
    inputSchema: { properties?: Record<string, GeneratedSchema>; required?: readonly string[] };
    access: null | {
        route: string;
        mode: "all" | "any" | "tile" | null;
        actions: { key: string; tile: string; tileLabel: string; action: string; actionLabel: string }[];
        tiles: { id: string; label: string }[];
        policies: string[];
    };
};

const PATTERN_HINT: Record<string, string> = {
    "^\\d{4}-\\d{2}-\\d{2}$": "date, YYYY-MM-DD",
    "^\\d{4}-\\d{4}$": "academic year, YYYY-YYYY",
};

/** The type column and the meaning column for one input. */
export function describeArg(s: GeneratedSchema): { type: string; meaning: string } {
    let type = s.type === "integer" ? "whole number" : s.type === "boolean" ? "true / false" : s.type === "array" ? "list of whole numbers" : "text";
    if (s.pattern && PATTERN_HINT[s.pattern]) type = PATTERN_HINT[s.pattern];
    const extra: string[] = [];
    if (s.enum) extra.push(`One of: ${s.enum.join(", ")}.`);
    if (s.type === "integer" && s.maximum !== undefined) extra.push(`${s.minimum ?? 1} to ${s.maximum}.`);
    return { type, meaning: [s.description, ...extra].filter(Boolean).join(" ") || "—" };
}

/** “Who gets it”: the page permission the tool's route checks, in words. */
export function describeAccess(t: GeneratedTool): string {
    const a = t.access;
    if (!a) return "Everyone who can connect the AI Assistant.";
    const act = (x: NonNullable<GeneratedTool["access"]>["actions"][number]) => `${x.tileLabel} tile with “${x.actionLabel}”`;
    if (a.mode === "all" && a.actions.length) return a.actions.map(act).join(", and ") + ".";
    if (a.mode === "any" && a.actions.length) return `Either the ${a.actions.map(act).join(", or the ")}.`;
    if (a.mode === "tile" && a.tiles.length) {
        if (a.tiles.length === 1) return `The ${a.tiles[0].label} tile.`;
        return `Any one of these ${a.tiles.length} tiles (every page with this search box): ${a.tiles.map((x) => x.label).join(", ")}.`;
    }
    return "Super Admins only.";
}
