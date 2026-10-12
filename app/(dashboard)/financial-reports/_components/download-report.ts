import api from "@/lib/api";
import toast from "react-hot-toast";

export async function downloadReportFile(
  path: string,
  params: Record<string, string | number | undefined>,
  fallbackName: string,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );
  const response = await api.get(path, { params: clean, responseType: "blob" });
  const disposition = response.headers?.["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  toast.success("Export downloaded");
}

/**
 * The server's own message for a failed export, when it sent one. Exports are
 * fetched as blobs, so a 400 ("PDF export is limited to 2,000 rows …") arrives
 * as a Blob of JSON rather than a parsed body.
 */
export async function reportExportErrorMessage(err: unknown, fallback: string): Promise<string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  try {
    const text = data instanceof Blob ? await data.text() : typeof data === "string" ? data : null;
    const message = text ? (JSON.parse(text) as { message?: unknown }).message : undefined;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  } catch {
    // Not JSON — fall through.
  }
  return fallback;
}
