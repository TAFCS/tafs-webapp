"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import {
  fetchMoveOptions,
  moveTicket,
  type MoveDesk,
  type MoveOptions,
  type MoveTicketBody,
} from "@/store/slices/supportTicketsSlice";
import { FlowIcon } from "@/features/support-tickets/flow-builder/flow-icons";
import { categoryLabel } from "@/features/support-tickets/supportTicketLabels";

interface MoveTicketModalProps {
  ticketId: string;
  onClose: () => void;
  /** `stillVisible` is false when the move took the ticket out of the caller's sight. */
  onSuccess: (stillVisible: boolean) => void;
}

type Mode = "topic" | "desk";

/**
 * TAFSD-448: send a ticket to the lane and topic it belongs to (routed as if the
 * parent had picked it) or straight to a desk, across General and Fees.
 */
export function MoveTicketModal({ ticketId, onClose, onSuccess }: MoveTicketModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [options, setOptions] = useState<MoveOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("topic");
  const [leafKey, setLeafKey] = useState<string | null>(null);
  const [deskId, setDeskId] = useState<number | null>(null);
  const [personId, setPersonId] = useState<string>("");
  const [topicSearch, setTopicSearch] = useState("");
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoadError(null);
    setOptions(null);
    fetchMoveOptions(ticketId)
      .then(setOptions)
      .catch((err) => setLoadError(err.response?.data?.message ?? "Could not load where this ticket can go"));
  };
  useEffect(load, [ticketId]);

  // A different destination needs its own confirmation.
  useEffect(() => {
    setOverride(false);
    setOverridePrompt(null);
  }, [mode, leafKey, deskId, personId]);

  const desk: MoveDesk | null = options?.desks.find((d) => d.id === deskId) ?? null;
  const person = desk?.members.find((m) => m.id === personId) ?? null;
  const deskOutOfScope = mode === "desk" && !!desk && (person ? !person.in_scope : !desk.in_scope);
  const needsOverride = deskOutOfScope || overridePrompt != null;

  const lanes = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    return (options?.lanes ?? [])
      .map((lane) => ({
        ...lane,
        topics: q
          ? lane.topics.filter(
              (t) => t.label.toLowerCase().includes(q) || t.path.some((p) => p.toLowerCase().includes(q)) || lane.name.toLowerCase().includes(q),
            )
          : lane.topics,
      }))
      .filter((lane) => lane.topics.length > 0);
  }, [options, topicSearch]);

  const desksByCategory = useMemo(() => {
    const groups = new Map<string, MoveDesk[]>();
    for (const d of options?.desks ?? []) {
      const list = groups.get(d.category) ?? [];
      list.push(d);
      groups.set(d.category, list);
    }
    return [...groups.entries()];
  }, [options]);

  const trimmedReason = reason.trim();
  const hasDestination = mode === "topic" ? !!leafKey : deskId != null;
  const canSubmit = hasDestination && trimmedReason.length >= 3 && (!needsOverride || override) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    const body: MoveTicketBody =
      mode === "topic"
        ? { leafKey: leafKey!, reason: trimmedReason, ...(override ? { overrideScope: true } : {}) }
        : {
            queueId: deskId!,
            ...(personId ? { targetUserId: personId } : {}),
            reason: trimmedReason,
            ...(override ? { overrideScope: true } : {}),
          };
    setSubmitting(true);
    try {
      const moved = await dispatch(moveTicket({ ticketId, body })).unwrap();
      const stillVisible = moved?.viewer_can_view !== false;
      toast.success(stillVisible ? "Ticket moved" : "Ticket moved. It is no longer on your desk.");
      onSuccess(stillVisible);
      onClose();
    } catch (err) {
      const e = err as { code?: string | null; message?: string };
      if (e?.code === "SCOPE_OVERRIDE_REQUIRED") {
        setOverridePrompt(e.message ?? "Nobody at that destination can see this student.");
      } else {
        toast.error(e?.message ?? "Move failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 h-9 rounded-lg text-xs font-bold transition-colors ${
      active ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-ticket-title"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h3 id="move-ticket-title" className="text-xl font-bold">Move ticket</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Send it where it belongs. The parent only sees that it is being handled, never which desk has it.
          </p>
        </div>

        <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {!options && !loadError && (
            <div className="py-10 flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <p className="text-sm text-zinc-400">Loading destinations…</p>
            </div>
          )}
          {loadError && (
            <div className="py-6 text-center">
              <p className="text-sm text-rose-600 mb-3">{loadError}</p>
              <button onClick={load} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold">
                Retry
              </button>
            </div>
          )}

          {options && (
            <>
              <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl" role="tablist" aria-label="Move by">
                <button role="tab" aria-selected={mode === "topic"} className={tabClass(mode === "topic")} onClick={() => setMode("topic")}>
                  By topic
                </button>
                <button role="tab" aria-selected={mode === "desk"} className={tabClass(mode === "desk")} onClick={() => setMode("desk")}>
                  To a desk
                </button>
              </div>

              {mode === "topic" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Routing runs again as if the parent had picked this topic{options.has_student ? " for the same child" : ""}.
                  </p>
                  <div>
                    <label htmlFor="move-topic-search" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      Find a topic
                    </label>
                    <input
                      id="move-topic-search"
                      value={topicSearch}
                      onChange={(e) => setTopicSearch(e.target.value)}
                      placeholder="e.g. refund, transport"
                      className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                    />
                  </div>
                  {lanes.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-4">
                      {topicSearch.trim() ? "No topic matches that search." : "No topics are available for this ticket."}
                    </p>
                  )}
                  {lanes.map((lane) => (
                    <fieldset key={lane.key} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      <legend className="sr-only">{lane.name}</legend>
                      <div
                        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-wide"
                        style={{ background: `${lane.color}14`, color: lane.color }}
                      >
                        <FlowIcon name={lane.icon} className="h-3.5 w-3.5" />
                        {lane.name}
                      </div>
                      {lane.topics.map((topic) => {
                        const current = topic.key === options.current.leaf_node_key;
                        return (
                          <label
                            key={topic.key}
                            className={`flex items-start gap-3 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                              leafKey === topic.key ? "bg-primary/5" : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="move-topic"
                              className="mt-0.5 accent-primary"
                              checked={leafKey === topic.key}
                              onChange={() => setLeafKey(topic.key)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">
                                {topic.label}
                                {current && <span className="ml-2 text-[10px] font-bold text-zinc-400 uppercase">Current</span>}
                              </span>
                              {topic.path.length > 0 && (
                                <span className="block text-xs text-zinc-400 truncate">{topic.path.join(" › ")}</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                </div>
              )}

              {mode === "desk" && (
                <div className="space-y-3">
                  {options.desks.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-4">
                      No desk has anyone who can see this student.
                    </p>
                  )}
                  {desksByCategory.map(([category, desks]) => (
                    <fieldset key={category} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      <legend className="sr-only">{categoryLabel(category)}</legend>
                      <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wide bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                        {categoryLabel(category)}
                      </div>
                      {desks.map((d) => (
                        <label
                          key={d.id}
                          className={`flex items-center gap-3 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                            deskId === d.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="move-desk"
                            className="accent-primary"
                            checked={deskId === d.id}
                            onChange={() => {
                              setDeskId(d.id);
                              setPersonId("");
                            }}
                          />
                          <span className="flex-1 min-w-0 text-sm font-semibold truncate">
                            {d.name}
                            {d.id === options.current.routed_queue_id && (
                              <span className="ml-2 text-[10px] font-bold text-zinc-400 uppercase">Current</span>
                            )}
                          </span>
                          <span className="text-[11px] text-zinc-400 shrink-0">
                            {d.members.length} {d.members.length === 1 ? "person" : "people"}
                          </span>
                          {!d.in_scope && <ScopeTag />}
                        </label>
                      ))}
                    </fieldset>
                  ))}

                  {desk && (
                    <div>
                      <label htmlFor="move-person" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Who takes it
                      </label>
                      <select
                        id="move-person"
                        value={personId}
                        onChange={(e) => setPersonId(e.target.value)}
                        className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      >
                        <option value="">
                          {desk.assignment === "AUTO" ? "Next available on the desk (automatic)" : "Anyone on the desk (they claim it)"}
                        </option>
                        {desk.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} · {m.role.replace(/_/g, " ")}
                            {m.in_scope ? "" : " · outside scope"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="move-reason" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="move-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Why it belongs there. Staff see this in the thread; the parent does not."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary resize-none"
                />
                <p className="text-[11px] text-zinc-400 text-right">{reason.length} / 500 characters</p>
              </div>

              {needsOverride && options.can_override_scope && (
                <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 space-y-2">
                    <p>{overridePrompt ?? "Nobody at that destination can see this student."}</p>
                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input type="checkbox" className="accent-amber-600" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                      Move anyway (super admin override, noted in the thread)
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopeTag() {
  return (
    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase">
      Outside scope
    </span>
  );
}
