"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import { forwardTicket } from "@/store/slices/supportTicketsSlice";
import { StaffPickerModal } from "./StaffPickerModal";

interface ForwardTicketModalProps {
  ticketId: string;
  currentUserId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ForwardTicketModal({
  ticketId,
  currentUserId,
  onClose,
  onSuccess,
}: ForwardTicketModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);

  const handleSelect = async (user: { id: string; full_name: string }) => {
    setLoading(true);
    try {
      await dispatch(forwardTicket({ ticketId, targetUserId: user.id })).unwrap();
      toast.success(`Forwarded to ${user.full_name}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Forward failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <StaffPickerModal
      title="Forward Ticket"
      description="Hand this ticket to another staff member. They become the sole responder."
      excludeUserId={currentUserId}
      onClose={onClose}
      onSelect={loading ? () => {} : handleSelect}
    />
  );
}
