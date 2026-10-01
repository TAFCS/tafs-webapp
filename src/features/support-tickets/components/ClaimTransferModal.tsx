"use client";

import { useCallback, useState } from "react";
import api from "@/lib/api";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import { transferTicket } from "@/store/slices/supportTicketsSlice";
import { StaffPickerModal, type StaffOption } from "./StaffPickerModal";

interface ClaimTransferModalProps {
  ticketId: string;
  currentUserId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ClaimTransferModal({
  ticketId,
  currentUserId,
  onClose,
  onSuccess,
}: ClaimTransferModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  // Transfer stays inside the ticket's queue; the backend lists who qualifies.
  const loadTargets = useCallback(async (): Promise<StaffOption[]> => {
    const res = await api.get(`v1/support-tickets/${ticketId}/transfer-targets`);
    return res.data?.data ?? res.data ?? [];
  }, [ticketId]);

  const handleSelect = async (user: { id: string; full_name: string }) => {
    setLoading(true);
    try {
      await dispatch(transferTicket({ ticketId, targetUserId: user.id })).unwrap();
      toast.success(`Transferred to ${user.full_name}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <StaffPickerModal
      title="Transfer ticket"
      description="Select another member of this ticket's queue to take it over."
      loadOptions={loadTargets}
      excludeUserId={currentUserId}
      onClose={onClose}
      onSelect={loading ? () => {} : handleSelect}
    />
  );
}
