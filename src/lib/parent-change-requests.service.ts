import api from './api';

export const parentChangeRequestsService = {
  async listRequests() {
    const response = await api.get('/v1/parent-change-requests');
    return response.data;
  },

  async processRequest(id: number, data: { status: 'APPROVED' | 'REJECTED'; comment?: string }) {
    const response = await api.patch(`/v1/parent-change-requests/${id}/process`, data);
    return response.data;
  },
};
