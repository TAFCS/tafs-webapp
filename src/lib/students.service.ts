import api from './api';
import { StudentListItem } from '../store/slices/studentsSlice';

export const studentsService = {
    async getById(id: number): Promise<StudentListItem> {
        const { data } = await api.get(`/v1/students/${id}`);
        return data.data;
    },
};
