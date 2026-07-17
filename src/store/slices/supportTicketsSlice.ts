import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

export interface SupportTicket {
  id: string;
  family_id: number;
  category: 'GENERAL' | 'FINANCIAL';
  subtopic?: string | null;
  description: string;
  status: 'OPEN' | 'ASSIGNED' | 'CLOSED';
  routed_role: string;
  current_assignee_id?: string | null;
  last_message_at: string;
  last_message_snippet?: string | null;
  unread_by_staff: number;
  unread_by_parent: number;
  families?: { id: number; household_name: string };
  students?: {
    cc: number;
    full_name: string;
    photograph_url?: string | null;
    photo_blue_bg_url?: string | null;
    gr_number?: string | null;
    primary_phone?: string | null;
    whatsapp_number?: string | null;
    whatsapp_country_code?: string | null;
    classes?: { description: string };
    sections?: { description: string };
    campuses?: { campus_name: string };
  };
  current_assignee?: { id: string; full_name: string; role: string };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: 'GUARDIAN' | 'STAFF';
  message_type: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_comment?: string | null;
  media_metadata?: Record<string, unknown> | null;
  created_at: string;
  sender_user?: { id: string; full_name: string; role: string };
  sender_guardian?: { full_name: string };
}

export interface PendingApproval {
  id: string;
  content: string;
  status: string;
  created_at: string;
  sender_user?: { id: string; full_name: string; role: string };
  ticket?: SupportTicket & { families?: { household_name: string } };
}

export type QueueTab = 'my-queue' | 'finance-queue' | 'oversight' | 'approvals' | 'closed';

interface SupportTicketsState {
  queueTab: QueueTab;
  queueItems: SupportTicket[];
  closedItems: SupportTicket[];
  selectedTicketId: string | null;
  selectedTicket: (SupportTicket & { messages?: TicketMessage[]; events?: unknown[] }) | null;
  pendingApprovals: PendingApproval[];
  isLoadingQueue: boolean;
  isLoadingDetail: boolean;
  isLoadingApprovals: boolean;
  isSending: boolean;
  queueError: string | null;
  detailError: string | null;
  actionError: string | null;
  detailRequestId: string;
}

const initialState: SupportTicketsState = {
  queueTab: 'my-queue',
  queueItems: [],
  closedItems: [],
  selectedTicketId: null,
  selectedTicket: null,
  pendingApprovals: [],
  isLoadingQueue: false,
  isLoadingDetail: false,
  isLoadingApprovals: false,
  isSending: false,
  queueError: null,
  detailError: null,
  actionError: null,
  detailRequestId: '',
};

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e.response?.data?.message || e.message || fallback;
}

export const fetchMyQueue = createAsyncThunk(
  'supportTickets/fetchMyQueue',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('v1/support-tickets/my-queue');
      return res.data.items ?? res.data.data?.items ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to load queue'));
    }
  },
);

export const fetchFinanceQueue = createAsyncThunk(
  'supportTickets/fetchFinanceQueue',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('v1/support-tickets/finance-queue');
      return res.data.items ?? res.data.data?.items ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to load finance queue'));
    }
  },
);

export const fetchOversightQueue = createAsyncThunk(
  'supportTickets/fetchOversightQueue',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('v1/support-tickets/oversight');
      return res.data.items ?? res.data.data?.items ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to load oversight queue'));
    }
  },
);

export const fetchClosedTickets = createAsyncThunk(
  'supportTickets/fetchClosedTickets',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('v1/support-tickets/closed');
      return res.data.items ?? res.data.data?.items ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to load closed tickets'));
    }
  },
);

export const fetchTicketDetail = createAsyncThunk(
  'supportTickets/fetchTicketDetail',
  async (ticketId: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`v1/support-tickets/${ticketId}`);
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to load ticket'));
    }
  },
);

export const fetchPendingApprovals = createAsyncThunk(
  'supportTickets/fetchPendingApprovals',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('v1/support-tickets/approvals/pending');
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to load pending approvals'));
    }
  },
);

export const markTicketRead = createAsyncThunk(
  'supportTickets/markTicketRead',
  async (ticketId: string) => {
    await api.post('v1/support-tickets/mark-read', { ticketId });
    return ticketId;
  },
);

export const sendTicketMessage = createAsyncThunk(
  'supportTickets/sendTicketMessage',
  async (
    { ticketId, content, messageType = 'TEXT', mediaMetadata }: {
      ticketId: string;
      content: string;
      messageType?: string;
      mediaMetadata?: Record<string, unknown>;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await api.post(`v1/support-tickets/${ticketId}/messages`, {
        messageType,
        content,
        mediaMetadata,
      });
      return { ticketId, message: res.data.data ?? res.data };
    } catch (err) {
      return rejectWithValue(apiError(err, 'Send failed'));
    }
  },
);

export const reviewTicketMessage = createAsyncThunk(
  'supportTickets/reviewTicketMessage',
  async (
    { messageId, status, comment }: { messageId: string; status: 'APPROVED' | 'REJECTED'; comment?: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await api.patch(`v1/support-tickets/messages/${messageId}/review`, { status, comment });
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Review failed'));
    }
  },
);

export const claimTicket = createAsyncThunk(
  'supportTickets/claimTicket',
  async (ticketId: string, { rejectWithValue }) => {
    try {
      const res = await api.post(`v1/support-tickets/${ticketId}/claim`);
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Could not claim ticket'));
    }
  },
);

export const transferTicket = createAsyncThunk(
  'supportTickets/transferTicket',
  async (
    { ticketId, targetUserId }: { ticketId: string; targetUserId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await api.post(`v1/support-tickets/${ticketId}/transfer`, { targetUserId });
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Transfer failed'));
    }
  },
);

export const forwardTicket = createAsyncThunk(
  'supportTickets/forwardTicket',
  async (
    { ticketId, targetUserId }: { ticketId: string; targetUserId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await api.post(`v1/support-tickets/${ticketId}/forward`, { targetUserId });
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Forward failed'));
    }
  },
);

export const closeTicket = createAsyncThunk(
  'supportTickets/closeTicket',
  async ({ ticketId, note }: { ticketId: string; note?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post(`v1/support-tickets/${ticketId}/close`, { note });
      return res.data.data ?? res.data;
    } catch (err) {
      return rejectWithValue(apiError(err, 'Failed to close ticket'));
    }
  },
);

function patchQueueTicket(state: SupportTicketsState, ticket: SupportTicket) {
  const isClosed = ticket.status === 'CLOSED';
  const targetArray = isClosed ? 'closedItems' : 'queueItems';
  const otherArray = isClosed ? 'queueItems' : 'closedItems';

  state[otherArray] = state[otherArray].filter((t) => t.id !== ticket.id);

  const idx = state[targetArray].findIndex((t) => t.id === ticket.id);
  if (idx >= 0) {
    state[targetArray][idx] = { ...state[targetArray][idx], ...ticket };
  } else {
    state[targetArray].unshift(ticket);
  }

  // Sort both arrays descending by last_message_at
  state.queueItems.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
  state.closedItems.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  if (state.selectedTicket?.id === ticket.id) {
    state.selectedTicket = { ...state.selectedTicket, ...ticket };
  }
}

const supportTicketsSlice = createSlice({
  name: 'supportTickets',
  initialState,
  reducers: {
    setQueueTab(state, action: PayloadAction<QueueTab>) {
      state.queueTab = action.payload;
    },
    setSelectedTicketId(state, action: PayloadAction<string | null>) {
      state.selectedTicketId = action.payload;
      state.selectedTicket = null;
      state.detailError = null;
    },
    clearQueueError(state) {
      state.queueError = null;
    },
    clearDetailError(state) {
      state.detailError = null;
    },
    clearActionError(state) {
      state.actionError = null;
    },
    upsertQueueTicket(state, action: PayloadAction<SupportTicket>) {
      patchQueueTicket(state, action.payload);
    },
    removeOpenQueueTicket(state, action: PayloadAction<string>) {
      state.queueItems = state.queueItems.filter((t) => t.id !== action.payload);
    },
    appendTicketMessage(state, action: PayloadAction<{ ticketId: string; message: TicketMessage }>) {
      const { ticketId, message } = action.payload;
      if (state.selectedTicket?.id === ticketId && state.selectedTicket.messages) {
        const exists = state.selectedTicket.messages.some((m) => m.id === message.id);
        if (!exists) state.selectedTicket.messages.unshift(message);
      }
      const snippet = message.message_type === 'TEXT' ? message.content.slice(0, 50) : `[${message.message_type}]`;
      patchQueueTicket(state, {
        id: ticketId,
        last_message_at: message.created_at,
        last_message_snippet: snippet,
      } as SupportTicket);
    },
    updateMessageReviewStatus(
      state,
      action: PayloadAction<{ messageId: string; status: string; reviewComment?: string }>,
    ) {
      const { messageId, status, reviewComment } = action.payload;
      if (state.selectedTicket?.messages) {
        const msg = state.selectedTicket.messages.find((m) => m.id === messageId);
        if (msg) {
          msg.status = status as TicketMessage['status'];
          if (reviewComment) msg.review_comment = reviewComment;
        }
      }
      state.pendingApprovals = state.pendingApprovals.filter((p) => p.id !== messageId);
    },
    addPendingApproval(state, action: PayloadAction<PendingApproval>) {
      if (!state.pendingApprovals.some((p) => p.id === action.payload.id)) {
        state.pendingApprovals.unshift(action.payload);
      }
    },
    markTicketUnreadZero(state, action: PayloadAction<string>) {
      const id = action.payload;
      const q = state.queueItems.find((t) => t.id === id);
      if (q) q.unread_by_staff = 0;
      if (state.selectedTicket?.id === id) state.selectedTicket.unread_by_staff = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyQueue.pending, (state) => {
        state.isLoadingQueue = true;
        state.queueError = null;
      })
      .addCase(fetchMyQueue.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.queueItems = action.payload.slice().sort(
          (a: SupportTicket, b: SupportTicket) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
      })
      .addCase(fetchMyQueue.rejected, (state, action) => {
        state.isLoadingQueue = false;
        state.queueError = (action.payload as string) ?? 'Failed to load queue';
      })
      .addCase(fetchFinanceQueue.pending, (state) => {
        state.isLoadingQueue = true;
        state.queueError = null;
      })
      .addCase(fetchFinanceQueue.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.queueItems = action.payload.slice().sort(
          (a: SupportTicket, b: SupportTicket) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
      })
      .addCase(fetchFinanceQueue.rejected, (state, action) => {
        state.isLoadingQueue = false;
        state.queueError = (action.payload as string) ?? 'Failed to load finance queue';
      })
      .addCase(fetchOversightQueue.pending, (state) => {
        state.isLoadingQueue = true;
        state.queueError = null;
      })
      .addCase(fetchOversightQueue.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.queueItems = action.payload.slice().sort(
          (a: SupportTicket, b: SupportTicket) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
      })
      .addCase(fetchOversightQueue.rejected, (state, action) => {
        state.isLoadingQueue = false;
        state.queueError = (action.payload as string) ?? 'Failed to load oversight queue';
      })
      .addCase(fetchClosedTickets.pending, (state) => {
        state.isLoadingQueue = true;
        state.queueError = null;
      })
      .addCase(fetchClosedTickets.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.closedItems = action.payload.slice().sort(
          (a: SupportTicket, b: SupportTicket) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
      })
      .addCase(fetchClosedTickets.rejected, (state, action) => {
        state.isLoadingQueue = false;
        state.queueError = (action.payload as string) ?? 'Failed to load closed tickets';
      })
      .addCase(fetchTicketDetail.pending, (state, action) => {
        state.isLoadingDetail = true;
        state.detailError = null;
        state.detailRequestId = action.meta.requestId;
      })
      .addCase(fetchTicketDetail.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.detailRequestId) return;
        state.isLoadingDetail = false;
        state.selectedTicket = action.payload;
      })
      .addCase(fetchTicketDetail.rejected, (state, action) => {
        if (action.meta.requestId !== state.detailRequestId) return;
        state.isLoadingDetail = false;
        state.detailError = (action.payload as string) ?? 'Failed to load ticket';
      })
      .addCase(fetchPendingApprovals.pending, (state) => {
        state.isLoadingApprovals = true;
      })
      .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
        state.isLoadingApprovals = false;
        state.pendingApprovals = action.payload;
      })
      .addCase(fetchPendingApprovals.rejected, (state, action) => {
        state.isLoadingApprovals = false;
        state.actionError = (action.payload as string) ?? 'Failed to load approvals';
      })
      .addCase(markTicketRead.fulfilled, (state, action) => {
        supportTicketsSlice.caseReducers.markTicketUnreadZero(state, { payload: action.payload, type: '' });
      })
      .addCase(sendTicketMessage.pending, (state) => {
        state.isSending = true;
        state.actionError = null;
      })
      .addCase(sendTicketMessage.fulfilled, (state, action) => {
        state.isSending = false;
        const { ticketId, message } = action.payload;
        supportTicketsSlice.caseReducers.appendTicketMessage(state, {
          payload: { ticketId, message },
          type: '',
        });
      })
      .addCase(sendTicketMessage.rejected, (state, action) => {
        state.isSending = false;
        state.actionError = (action.payload as string) ?? 'Send failed';
      })
      .addCase(claimTicket.fulfilled, (state, action) => {
        patchQueueTicket(state, action.payload);
      })
      .addCase(transferTicket.fulfilled, (state, action) => {
        patchQueueTicket(state, action.payload);
      })
      .addCase(forwardTicket.fulfilled, (state, action) => {
        patchQueueTicket(state, action.payload);
      })
      .addCase(closeTicket.fulfilled, (state, action) => {
        state.queueItems = state.queueItems.filter((t) => t.id !== action.payload.id);
        
        // Add to closedItems if not already present
        if (!state.closedItems.some((t) => t.id === action.payload.id)) {
          state.closedItems.unshift(action.payload);
        } else {
          const idx = state.closedItems.findIndex((t) => t.id === action.payload.id);
          state.closedItems[idx] = { ...state.closedItems[idx], ...action.payload };
        }
        state.closedItems.sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );

        if (state.selectedTicket?.id === action.payload.id) {
          state.selectedTicket = { ...state.selectedTicket, ...action.payload, status: 'CLOSED' };
        }
      })
      .addCase(reviewTicketMessage.fulfilled, (state, action) => {
        supportTicketsSlice.caseReducers.updateMessageReviewStatus(state, {
          payload: {
            messageId: action.payload.id,
            status: action.payload.status,
            reviewComment: action.payload.review_comment,
          },
          type: '',
        });
      });
  },
});

export const {
  setQueueTab,
  setSelectedTicketId,
  clearQueueError,
  clearDetailError,
  clearActionError,
  upsertQueueTicket,
  removeOpenQueueTicket,
  appendTicketMessage,
  updateMessageReviewStatus,
  addPendingApproval,
  markTicketUnreadZero,
} = supportTicketsSlice.actions;
export default supportTicketsSlice.reducer;
