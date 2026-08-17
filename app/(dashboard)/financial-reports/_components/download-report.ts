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
