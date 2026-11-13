export const rs = (v: number) => `Rs. ${Math.abs(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const monthOf = (iso: string | null | undefined) =>
    iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";

export const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};
