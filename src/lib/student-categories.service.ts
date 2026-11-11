import api from "./api";
import type { CategoryTone } from "./student-benefits";

/** TAFSD-475: School Setup → Special Categories. */
export interface StudentCategoryInput {
    label: string;
    description?: string | null;
    tone?: CategoryTone;
    display_order?: number;
}

export const studentCategoriesService = {
    async create(data: StudentCategoryInput) {
        const res = await api.post("/v1/student-categories", data);
        return res.data?.data ?? res.data;
    },
    async update(id: number, data: Partial<StudentCategoryInput> & { is_active?: boolean }) {
        const res = await api.patch(`/v1/student-categories/${id}`, data);
        return res.data?.data ?? res.data;
    },
    async remove(id: number) {
        await api.delete(`/v1/student-categories/${id}`);
    },
};
