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
  students?: { cc: number; full_name: string; classes?: { description: string }; campuses?: { campus_name: string } };
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
  sender_user?: { full_name: string; role: string };
  sender_guardian?: { full_name: string };
}

export interface PendingApproval {
  id: string;
  content: string;
  status: string;
  created_at: string;
  sender_user?: { full_name: string; role: string };
  ticket?: SupportTicket & { families?: { household_name: string } };
}

export type QueueTab = 'my-queue' | 'finance-queue' | 'oversight' | 'closed';

interface SupportTicketsState {
  queueTab: QueueTab;
  queueItems: SupportTicket[];
  closedItems: SupportTicket[];
  selectedTicketId: string | null;
  selectedTicket: (SupportTicket & { messages?: TicketMessage[]; events?: unknown[] }) | null;
  pendingApprovals: PendingApproval[];
  isLoadingQueue: boolean;
  isLoadingDetail: boolean;
  isSending: boolean;
  error: string | null;
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
  isSending: false,
  error: null,
  detailRequestId: '',
};

export const fetchMyQueue = createAsyncThunk('supportTickets/fetchMyQueue', async () => {
  const res = await api.get('v1/support-tickets/my-queue');
  return res.data.items ?? res.data.data?.items ?? res.data;
});

export const fetchFinanceQueue = createAsyncThunk('supportTickets/fetchFinanceQueue', async () => {
  const res = await api.get('v1/support-tickets/finance-queue');
  return res.data.items ?? res.data.data?.items ?? res.data;
});

export const fetchOversightQueue = createAsyncThunk('supportTickets/fetchOversightQueue', async () => {
  const res = await api.get('v1/support-tickets/oversight');
  return res.data.items ?? res.data.data?.items ?? res.data;
});

export const fetchClosedTickets = createAsyncThunk('supportTickets/fetchClosedTickets', async () => {
  const res = await api.get('v1/support-tickets/closed');
  return res.data.items ?? res.data.data?.items ?? res.data;
});

export const fetchTicketDetail = createAsyncThunk(
  'supportTickets/fetchTicketDetail',
  async (ticketId: string) => {
    const res = await api.get(`v1/support-tickets/${ticketId}`);
    return res.data.data ?? res.data;
  },
);

export const fetchPendingApprovals = createAsyncThunk(
  'supportTickets/fetchPendingApprovals',
  async () => {
    const res = await api.get('v1/support-tickets/approvals/pending');
    return res.data.data ?? res.data;
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
  async ({ ticketId, content, messageType = 'TEXT', mediaMetadata }: {
    ticketId: string;
    content: string;
    messageType?: string;
    mediaMetadata?: Record<string, unknown>;
  }) => {
    const res = await api.post(`v1/support-tickets/${ticketId}/messages`, {
      messageType,
      content,
      mediaMetadata,
    });
    return { ticketId, message: res.data.data ?? res.data };
  },
);

export const reviewTicketMessage = createAsyncThunk(
  'supportTickets/reviewTicketMessage',
  async ({ messageId, status, comment }: { messageId: string; status: 'APPROVED' | 'REJECTED'; comment?: string }) => {
    const res = await api.patch(`v1/support-tickets/messages/${messageId}/review`, { status, comment });
    return res.data.data ?? res.data;
  },
);

export const claimTicket = createAsyncThunk('supportTickets/claimTicket', async (ticketId: string) => {
  const res = await api.post(`v1/support-tickets/${ticketId}/claim`);
  return res.data.data ?? res.data;
});

export const transferTicket = createAsyncThunk(
  'supportTickets/transferTicket',
  async ({ ticketId, targetUserId }: { ticketId: string; targetUserId: string }) => {
    const res = await api.post(`v1/support-tickets/${ticketId}/transfer`, { targetUserId });
    return res.data.data ?? res.data;
  },
);

export const forwardTicket = createAsyncThunk(
  'supportTickets/forwardTicket',
  async ({ ticketId, targetUserId }: { ticketId: string; targetUserId: string }) => {
    const res = await api.post(`v1/support-tickets/${ticketId}/forward`, { targetUserId });
    return res.data.data ?? res.data;
  },
);

export const closeTicket = createAsyncThunk(
  'supportTickets/closeTicket',
  async ({ ticketId, comment }: { ticketId: string; comment?: string }) => {
    const res = await api.post(`v1/support-tickets/${ticketId}/close`, { comment });
    return res.data.data ?? res.data;
  },
);

function patchQueueTicket(state: SupportTicketsState, ticket: SupportTicket) {
  const idx = state.queueItems.findIndex((t) => t.id === ticket.id);
  if (idx >= 0) state.queueItems[idx] = { ...state.queueItems[idx], ...ticket };
  else if (ticket.status !== 'CLOSED') state.queueItems.unshift(ticket);
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
      if (!action.payload) state.selectedTicket = null;
    },
    clearSupportTicketsError(state) {
      state.error = null;
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
        state.error = null;
      })
      .addCase(fetchMyQueue.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.queueItems = action.payload;
      })
      .addCase(fetchFinanceQueue.pending, (state) => {
        state.isLoadingQueue = true;
        state.error = null;
      })
      .addCase(fetchFinanceQueue.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.queueItems = action.payload;
      })
      .addCase(fetchOversightQueue.pending, (state) => {
        state.isLoadingQueue = true;
        state.error = null;
      })
      .addCase(fetchOversightQueue.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.queueItems = action.payload;
      })
      .addCase(fetchClosedTickets.pending, (state) => {
        state.isLoadingQueue = true;
        state.error = null;
      })
      .addCase(fetchClosedTickets.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        state.closedItems = action.payload;
      })
      .addCase(fetchTicketDetail.pending, (state, action) => {
        state.isLoadingDetail = true;
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
        state.error = action.error.message ?? 'Failed to load ticket';
      })
      .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
        state.pendingApprovals = action.payload;
      })
      .addCase(markTicketRead.fulfilled, (state, action) => {
        supportTicketsSlice.caseReducers.markTicketUnreadZero(state, { payload: action.payload, type: '' });
      })
      .addCase(sendTicketMessage.pending, (state) => {
        state.isSending = true;
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
        state.error = action.error.message ?? 'Send failed';
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
      })
      .addMatcher(
        (action) => action.type.startsWith('supportTickets/fetch') && action.type.endsWith('/rejected'),
        (state, action: any) => {
          state.isLoadingQueue = false;
          state.error = action.error?.message ?? 'Request failed';
        },
      );
  },
});

export const {
  setQueueTab,
  setSelectedTicketId,
  clearSupportTicketsError,
  upsertQueueTicket,
  removeOpenQueueTicket,
  appendTicketMessage,
  updateMessageReviewStatus,
  addPendingApproval,
  markTicketUnreadZero,
} = supportTicketsSlice.actions;
export default supportTicketsSlice.reducer;
