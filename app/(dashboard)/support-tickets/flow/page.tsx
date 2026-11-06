"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  History,
  Loader2,
  Pencil,
  Redo2,
  Route,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
  Undo2,
} from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import {
  allKeys,
  flowErrorCode,
  flowErrorMessage,
  ticketFlowService,
  type FlowIssue,
  type FlowNode,
  type FlowNodeType,
  type FlowOverview,
  type FlowTree,
} from "@/lib/ticket-flow.service";
import { FlowCanvas } from "@/features/support-tickets/flow-builder/FlowCanvas";
import { NodeEditor } from "@/features/support-tickets/flow-builder/NodeEditor";
import { PreviewPhone } from "@/features/support-tickets/flow-builder/PreviewPhone";
import { HistoryModal, IssuesList, PublishModal, RouteAllModal } from "@/features/support-tickets/flow-builder/FlowPanels";
import {
  addChild,
  duplicateNode,
  moveNode,
  relabelNode,
  removeNode,
  updateConditions,
  updateNode,
  updateSettings,
} from "@/features/support-tickets/flow-builder/flow-editor";
import { card, dangerBtn, ghostBtn, primaryBtn } from "@/features/support-tickets/flow-builder/styles";

// TAFSD-447: the parent ticket flow builder. Lanes are the first choice in the
// app; under each lane a tree of questions ends in a ticket (or a screen). Edits
// autosave to a draft; publishing makes the draft what parents see.

type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
const AUTOSAVE_MS = 1200;
const HISTORY_LIMIT = 60;

export default function TicketFlowPage() {
  const { user } = useAuthState();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [overview, setOverview] = useState<FlowOverview | null>(null);
  // Keys parents can reach today: these never change (relabelNode).
  const liveKeys = useMemo(() => (overview ? allKeys(overview.published_tree) : new Set<string>()), [overview]);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<FlowTree | null>(null);
  const [editing, setEditing] = useState(false);
  const [lockVersion, setLockVersion] = useState(0);
  const [issues, setIssues] = useState<FlowIssue[]>([]);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [undo, setUndo] = useState<FlowTree[]>([]);
  const [redo, setRedo] = useState<FlowTree[]>([]);
  const [modal, setModal] = useState<"preview" | "publish" | "history" | "route" | "issues" | null>(null);

  const saving = useRef(false);
  const pending = useRef<FlowTree | null>(null);
  const lockRef = useRef(0);
  lockRef.current = lockVersion;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await ticketFlowService.overview();
      setOverview(o);
      if (o.draft) {
        setTree(o.draft.tree);
        setLockVersion(o.draft.lock_version);
        setDraftVersion(o.draft.version);
        setEditing(true);
        const v = await ticketFlowService.validate();
        setIssues(v.issues);
      } else {
        setTree(o.published_tree);
        setEditing(false);
        setDraftVersion(null);
        setIssues([]);
      }
      setUndo([]);
      setRedo([]);
      setSaveState("saved");
    } catch (e) {
      toast.error(flowErrorMessage(e, "Could not load the ticket flow"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load();
    else setLoading(false);
  }, [isSuperAdmin, load]);

  // ─── Saving ────────────────────────────────────────────────────────────────

  const flush = useCallback(async () => {
    if (saving.current || !pending.current) return;
    const toSave = pending.current;
    pending.current = null;
    saving.current = true;
    setSaveState("saving");
    try {
      const res = await ticketFlowService.saveDraft(toSave, lockRef.current);
      setLockVersion(res.lock_version);
      lockRef.current = res.lock_version;
      setIssues(res.issues);
      setSaveState(pending.current ? "dirty" : "saved");
    } catch (e) {
      if (flowErrorCode(e) === "DRAFT_CHANGED") {
        setSaveState("conflict");
        pending.current = null;
        toast.error(flowErrorMessage(e, "Someone else changed this draft"));
      } else {
        setSaveState("error");
        pending.current = pending.current ?? toSave;
        toast.error(flowErrorMessage(e, "Could not save the draft"));
      }
    } finally {
      saving.current = false;
      if (pending.current) setTimeout(() => void flush(), AUTOSAVE_MS);
    }
  }, []);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const h = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(h);
  }, [saveState, tree, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const apply = useCallback(
    (next: FlowTree | null) => {
      if (!next || !tree || !editing || saveState === "conflict") return;
      setUndo((u) => [...u.slice(-HISTORY_LIMIT + 1), tree]);
      setRedo([]);
      setTree(next);
      pending.current = next;
      setSaveState("dirty");
    },
    [tree, editing, saveState],
  );

  const stepHistory = useCallback(
    (dir: "undo" | "redo") => {
      if (!tree || !editing) return;
      const from = dir === "undo" ? undo : redo;
      if (from.length === 0) return;
      const prev = from[from.length - 1];
      if (dir === "undo") {
        setUndo(from.slice(0, -1));
        setRedo((r) => [...r, tree]);
      } else {
        setRedo(from.slice(0, -1));
        setUndo((u) => [...u, tree]);
      }
      setTree(prev);
      pending.current = prev;
      setSaveState("dirty");
    },
    [tree, editing, undo, redo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        stepHistory(e.shiftKey ? "redo" : "undo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepHistory]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const startEditing = async (fromVersion?: number) => {
    try {
      const d = await ticketFlowService.openDraft(fromVersion);
      setTree(d.tree);
      setLockVersion(d.lock_version);
      setDraftVersion(d.version);
      setIssues(d.issues);
      setEditing(true);
      setUndo([]);
      setRedo([]);
      setSaveState("saved");
      if (fromVersion) toast.success(`Draft started from version ${fromVersion}`);
    } catch (e) {
      toast.error(flowErrorMessage(e, "Could not open a draft"));
    }
  };

  const discard = async () => {
    if (!window.confirm("Throw away every change in this draft? The published flow stays as it is.")) return;
    try {
      await ticketFlowService.discardDraft();
      toast.success("Draft discarded");
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(flowErrorMessage(e, "Could not discard the draft"));
    }
  };

  const onAdd = (parentKey: string | null, type: FlowNodeType) => {
    if (!tree || !overview) return;
    const used = new Set(tree.lanes.map((l) => l.settings?.color as string));
    const color = overview.options.colors.find((c) => !used.has(c)) ?? overview.options.colors[0];
    const res = addChild(tree, parentKey, type, { color, minLength: overview.options.default_min_length });
    if (!res) {
      toast.error("That kind of step cannot go there");
      return;
    }
    apply(res.tree);
    setSelected(res.key);
  };

  if (!isSuperAdmin) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-10 text-center space-y-3`}>
        <ShieldAlert className="h-10 w-10 mx-auto text-zinc-400" />
        <p className="font-bold text-zinc-900 dark:text-zinc-50">Super admins only</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">The ticket flow can only be changed by a super admin.</p>
      </div>
    );
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const readOnly = !editing || saveState === "conflict";

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 pb-20">
      <div className={`${card} p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <Link href="/support-tickets" className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Support Tickets
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-950 text-white rounded-2xl">
              <GitBranch className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Ticket Flow</h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium pl-1 max-w-2xl">
            What parents choose when they open a ticket in the app. Lanes come first; under each, steps lead to a ticket. Drag a step onto
            another to move it there, or onto a gap to reorder. Changes save to a draft and reach parents only when you publish.
          </p>
        </div>
        {overview && (
          <div className="flex flex-col items-start xl:items-end gap-2">
            <p className="text-xs text-zinc-500">
              Live: <span className="font-bold text-zinc-900 dark:text-zinc-50">version {overview.published.version}</span>
              {overview.published.published_by && <> · published by {overview.published.published_by}</>}
              {editing && draftVersion && (
                <>
                  {" "}
                  · editing <span className="font-bold">draft v{draftVersion}</span>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <SaveBadge state={saveState} onReload={load} />
                  <button type="button" className={ghostBtn} disabled={undo.length === 0 || readOnly} onClick={() => stepHistory("undo")} title="Undo (Ctrl+Z)">
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={ghostBtn} disabled={redo.length === 0 || readOnly} onClick={() => stepHistory("redo")} title="Redo (Ctrl+Shift+Z)">
                    <Redo2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={ghostBtn} onClick={() => setModal("issues")}>
                    {errors > 0 ? (
                      <span className="text-red-700">{errors} problem(s)</span>
                    ) : warnings > 0 ? (
                      <span className="text-amber-700">{warnings} warning(s)</span>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Valid
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button type="button" className={primaryBtn} onClick={() => startEditing()}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              <button type="button" className={ghostBtn} onClick={() => setModal("preview")}>
                <Smartphone className="h-3.5 w-3.5" /> Preview
              </button>
              <button type="button" className={ghostBtn} onClick={() => setModal("route")}>
                <Route className="h-3.5 w-3.5" /> Test routing
              </button>
              <button type="button" className={ghostBtn} onClick={() => setModal("history")}>
                <History className="h-3.5 w-3.5" /> History
              </button>
              {editing && (
                <>
                  <button type="button" className={dangerBtn} onClick={discard}>
                    <Trash2 className="h-3.5 w-3.5" /> Discard draft
                  </button>
                  <button
                    type="button"
                    className={primaryBtn}
                    disabled={saveState !== "saved"}
                    title={saveState !== "saved" ? "Wait for the draft to save" : undefined}
                    onClick={() => setModal("publish")}
                  >
                    <Send className="h-4 w-4" /> Publish
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {loading || !overview || !tree ? (
        <div className={`${card} py-32 flex items-center justify-center`}>
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className={`${card} p-4 flex-1 min-w-0 w-full`} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
            {!editing && (
              <p className="mb-3 text-xs font-semibold text-zinc-500">Viewing the live flow. Press Edit to start a draft.</p>
            )}
            <FlowCanvas
              tree={tree}
              options={overview.options}
              issues={issues}
              selectedKey={selected}
              readOnly={readOnly}
              onSelect={setSelected}
              onMove={(key, parent, index) => apply(moveNode(tree, key, parent, index))}
              onAdd={onAdd}
            />
          </div>
          <div className="w-full xl:w-[380px] shrink-0 xl:sticky xl:top-4">
            {selected ? (
              <NodeEditor
                tree={tree}
                nodeKey={selected}
                options={overview.options}
                issues={issues}
                readOnly={readOnly}
                onPatch={(patch: Partial<FlowNode>) => {
                  if (patch.label === undefined) return apply(updateNode(tree, selected, patch));
                  const res = relabelNode(tree, selected, patch.label, liveKeys);
                  apply(res.tree);
                  if (res.key !== selected) setSelected(res.key);
                }}
                onSettings={(patch) => apply(updateSettings(tree, selected, patch))}
                onConditions={(patch) => apply(updateConditions(tree, selected, patch))}
                onAdd={(type) => onAdd(selected, type)}
                onDuplicate={() => {
                  const res = duplicateNode(tree, selected);
                  if (res) {
                    apply(res.tree);
                    setSelected(res.key);
                  }
                }}
                onDelete={() => {
                  apply(removeNode(tree, selected));
                  setSelected(null);
                }}
              />
            ) : (
              <div className={`${card} p-5 text-sm text-zinc-500 space-y-2`}>
                <p className="font-bold text-zinc-900 dark:text-zinc-50">Select a step to edit it</p>
                <p>Lane → Question / Pick a child / Info → … → Open a ticket (or Go to a screen).</p>
                <p>Tickets go to the step&apos;s own queue unless a routing rule claims them first; otherwise the lane&apos;s fallback, then the category fallback.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {modal === "preview" && overview && tree && (
        <PreviewPhone tree={tree} options={overview.options} useDraft={editing} onClose={() => setModal(null)} />
      )}
      {modal === "route" && <RouteAllModal useDraft={editing} onClose={() => setModal(null)} onPick={setSelected} />}
      {modal === "history" && (
        <HistoryModal
          hasDraft={editing}
          onClose={() => setModal(null)}
          onRestore={(v) => {
            setModal(null);
            void startEditing(v);
          }}
        />
      )}
      {modal === "publish" && (
        <PublishModal
          lockVersion={lockVersion}
          onClose={() => setModal(null)}
          onPick={setSelected}
          onPublished={() => {
            setModal(null);
            setSelected(null);
            void load();
          }}
        />
      )}
      {modal === "issues" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 flex items-start justify-center p-4 md:p-10" onClick={() => setModal(null)}>
          <div className={`${card} w-full max-w-xl p-6 space-y-3`} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black">Checks</h2>
            <p className="text-xs text-zinc-500">Problems block publishing; warnings do not. Click one to jump to its step.</p>
            <IssuesList
              issues={issues}
              onPick={(k) => {
                setSelected(k);
                setModal(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SaveBadge({ state, onReload }: { state: SaveState; onReload: () => void }) {
  if (state === "conflict") {
    return (
      <button type="button" className={dangerBtn} onClick={onReload}>
        Changed elsewhere: reload
      </button>
    );
  }
  const text = { saved: "Saved", dirty: "Unsaved…", saving: "Saving…", error: "Not saved, retrying" }[state];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 h-9 text-xs font-bold rounded-xl ${state === "error" ? "text-red-700" : "text-zinc-500"}`}>
      {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {text}
    </span>
  );
}
