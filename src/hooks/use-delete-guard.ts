import { useState, useCallback } from "react";
import api from "@/lib/api";

export type DependencyMap = Record<string, number>;

export function useDeleteGuard(entityPath: string) {
  const [dependencies, setDependencies] = useState<DependencyMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkedId, setCheckedId] = useState<number | null>(null);

  const check = useCallback(async (id: number) => {
    if (checkedId === id && dependencies !== null) return;
    setIsLoading(true);
    setDependencies(null);
    setCheckedId(id);
    try {
      const { data } = await api.get(`/v1/${entityPath}/${id}/dependencies`);
      setDependencies(data);
    } catch {
      setDependencies({});
    } finally {
      setIsLoading(false);
    }
  }, [entityPath, checkedId, dependencies]);

  const reset = useCallback(() => {
    setDependencies(null);
    setCheckedId(null);
  }, []);

  const canDelete = dependencies !== null && Object.values(dependencies).every(v => v === 0);
  const totalDeps = dependencies ? Object.values(dependencies).reduce((s, v) => s + v, 0) : 0;

  return { dependencies, isLoading, canDelete, totalDeps, check, reset };
}
