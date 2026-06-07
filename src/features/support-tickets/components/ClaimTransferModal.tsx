"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import { transferTicket } from "@/store/slices/supportTicketsSlice";
import { StaffPickerModal } from "./StaffPickerModal";

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
      title="Transfer to Finance Clerk"
      description="Select another finance clerk to take over this ticket."
      roleFilter="FINANCE_CLERK"
      excludeUserId={currentUserId}
      onClose={onClose}
      onSelect={loading ? () => {} : handleSelect}
    />
  );
}
