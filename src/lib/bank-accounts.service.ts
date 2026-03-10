import api from "./api";

export interface BankAccount {
    id: number;
    account_title: string;
    account_number: string;
    bank_name: string;
    branch_code?: string;
    bank_address?: string;
    iban?: string;
}

interface ApiEnvelope<T> {
    data: T;
    status: number;
    message: string;
}

export const bankAccountsService = {
    async getAll(): Promise<BankAccount[]> {
        const { data } = await api.get<ApiEnvelope<BankAccount[]>>("/v1/bank-accounts");
        return data.data;
    },

    async getOne(id: number): Promise<BankAccount> {
        const { data } = await api.get<ApiEnvelope<BankAccount>>(`/v1/bank-accounts/${id}`);
        return data.data;
    },

    async create(payload: Omit<BankAccount, "id">): Promise<BankAccount> {
        const { data } = await api.post<ApiEnvelope<BankAccount>>("/v1/bank-accounts", payload);
        return data.data;
    },

    async update(id: number, payload: Partial<Omit<BankAccount, "id">>): Promise<BankAccount> {
        const { data } = await api.patch<ApiEnvelope<BankAccount>>(`/v1/bank-accounts/${id}`, payload);
        return data.data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/v1/bank-accounts/${id}`);
    },
};
