import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { bankAccountsService, BankAccount } from '../../lib/bank-accounts.service';

// ─── State ────────────────────────────────────────────────────────────────────

export interface BanksState {
    items: BankAccount[];
    isLoading: boolean;
    error: string | null;
}

const initialState: BanksState = {
    items: [],
    isLoading: false,
    error: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchBanks = createAsyncThunk(
    'banks/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            return await bankAccountsService.getAll();
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch bank accounts.'
            );
        }
    }
);

export const createBank = createAsyncThunk(
    'banks/create',
    async (payload: Omit<BankAccount, 'id'>, { rejectWithValue }) => {
        try {
            return await bankAccountsService.create(payload);
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to create bank account.'
            );
        }
    }
);

export const updateBank = createAsyncThunk(
    'banks/update',
    async (
        { id, payload }: { id: number; payload: Partial<Omit<BankAccount, 'id'>> },
        { rejectWithValue }
    ) => {
        try {
            return await bankAccountsService.update(id, payload);
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to update bank account.'
            );
        }
    }
);

export const deleteBank = createAsyncThunk(
    'banks/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            await bankAccountsService.delete(id);
            return id;
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to delete bank account.'
            );
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const banksSlice = createSlice({
    name: 'banks',
    initialState,
    reducers: {
        clearBanks(state) {
            state.items = [];
            state.error = null;
            state.isLoading = false;
        },
    },
    extraReducers: (builder) => {
        // fetchBanks
        builder
            .addCase(fetchBanks.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchBanks.fulfilled, (state, action: PayloadAction<BankAccount[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchBanks.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });

        // createBank — optimistic append
        builder
            .addCase(createBank.fulfilled, (state, action: PayloadAction<BankAccount>) => {
                state.items.push(action.payload);
            })
            .addCase(createBank.rejected, (state, action) => {
                state.error = action.payload as string;
            });

        // updateBank — replace in list
        builder
            .addCase(updateBank.fulfilled, (state, action: PayloadAction<BankAccount>) => {
                const idx = state.items.findIndex((b) => b.id === action.payload.id);
                if (idx !== -1) state.items[idx] = action.payload;
            })
            .addCase(updateBank.rejected, (state, action) => {
                state.error = action.payload as string;
            });

        // deleteBank — remove from list
        builder
            .addCase(deleteBank.fulfilled, (state, action: PayloadAction<number>) => {
                state.items = state.items.filter((b) => b.id !== action.payload);
            })
            .addCase(deleteBank.rejected, (state, action) => {
                state.error = action.payload as string;
            });
    },
});

export const { clearBanks } = banksSlice.actions;
export default banksSlice.reducer;
