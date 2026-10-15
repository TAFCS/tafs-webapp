import type { HierarchyEmployee, ReportingLine } from "@/lib/hr.service";

/**
 * Pure helpers for the Reporting Hierarchy page.
 *
 * Super admins may set any lines at all, including two people reporting to
 * each other or someone reporting to a peer, so nothing here may assume the
 * lines form a tree. The layout draws each person once, under their first
 * manager, and every other line as a dotted connector.
 */

export const NODE_W = 184;
export const NODE_H = 58;
const SLOT = 200;
const LEVEL_H = 104;
const PAD = 16;
/** A manager with more direct reports than this starts collapsed. */
export const COLLAPSE_OVER = 6;

export type PlacedNode = {
  person: HierarchyEmployee;
  x: number;
  y: number;
  /** Reports drawn below this node (those whose first manager is this person). */
  childCount: number;
  collapsed: boolean;
};

export type Edge = { from: PlacedNode; to: PlacedNode; secondary: boolean };

/** The people `employeeId` reports to, oldest line first. */
export function managersOf(lines: ReportingLine[], employeeId: number): number[] {
  return lines.filter((l) => l.employee_id === employeeId).map((l) => l.manager_id);
}

export function directReportsOf(lines: ReportingLine[], managerId: number): number[] {
  return lines.filter((l) => l.manager_id === managerId).map((l) => l.employee_id);
}

/** Everyone above `employeeId`, through every line. Safe on loops. */
export function ancestorsOf(lines: ReportingLine[], employeeId: number): Set<number> {
  const seen = new Set<number>();
  const stack = managersOf(lines, employeeId);
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...managersOf(lines, id));
  }
  seen.delete(employeeId);
  return seen;
}

/**
 * Lays out everyone who has at least one reporting line. A leaf takes the next
 * slot and a manager is centred over the reports drawn under them. People
 * caught in a loop, with no way up to a top person, are started as their own
 * roots so nobody drops off the chart.
 */
export function layoutTree(
  employees: HierarchyEmployee[],
  lines: ReportingLine[],
  expanded: Set<number>,
  collapsed: Set<number>,
): { nodes: PlacedNode[]; edges: Edge[]; width: number; height: number } {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const valid = lines.filter((l) => byId.has(l.employee_id) && byId.has(l.manager_id));
  const inTree = new Set<number>();
  for (const l of valid) {
    inTree.add(l.employee_id);
    inTree.add(l.manager_id);
  }

  // Each person hangs under their first manager (not themselves).
  const parentOf = new Map<number, number>();
  for (const l of valid) {
    if (l.employee_id !== l.manager_id && !parentOf.has(l.employee_id)) parentOf.set(l.employee_id, l.manager_id);
  }
  const kids = new Map<number, number[]>();
  for (const [child, parent] of parentOf) kids.set(parent, [...(kids.get(parent) ?? []), child]);
  const name = (id: number) => byId.get(id)?.full_name ?? "";
  const byName = (a: number, b: number) => name(a).localeCompare(name(b));
  for (const list of kids.values()) list.sort(byName);

  const isCollapsed = (id: number) => {
    const n = kids.get(id)?.length ?? 0;
    if (n === 0) return false;
    if (collapsed.has(id)) return true;
    if (expanded.has(id)) return false;
    return n > COLLAPSE_OVER;
  };

  const placed = new Map<number, PlacedNode>();
  const drawnUnder = new Map<number, number>();
  let slot = 0;
  const place = (id: number, depth: number) => {
    // Reserve the id first so a loop back to it is skipped, not followed.
    placed.set(id, { person: byId.get(id)!, x: 0, y: depth, childCount: 0, collapsed: false });
    const children = (kids.get(id) ?? []).filter((c) => !placed.has(c));
    const shown = isCollapsed(id) ? [] : children;
    for (const c of shown) {
      drawnUnder.set(c, id);
      place(c, depth + 1);
    }
    const x = shown.length === 0
      ? slot++
      : (placed.get(shown[0])!.x + placed.get(shown[shown.length - 1])!.x) / 2;
    placed.set(id, {
      person: byId.get(id)!,
      x,
      y: depth,
      childCount: children.length,
      collapsed: isCollapsed(id) && children.length > 0,
    });
  };

  const roots = [...inTree].filter((id) => !parentOf.has(id)).sort(byName);
  roots.forEach((r) => place(r, 0));
  // Anyone left is only reachable through a loop. Start each such group at
  // whoever sorts first, but skip people a collapsed manager is hiding.
  const hidden = (id: number) => {
    const seen = new Set<number>();
    let at = parentOf.get(id);
    while (at != null && !seen.has(at)) {
      if (placed.has(at)) return placed.get(at)!.collapsed;
      seen.add(at);
      at = parentOf.get(at);
    }
    return false;
  };
  for (const id of [...inTree].sort(byName)) {
    if (!placed.has(id) && !hidden(id)) place(id, 0);
  }

  const nodes = [...placed.values()].map((n) => ({
    ...n,
    x: PAD + n.x * SLOT + (SLOT - NODE_W) / 2,
    y: PAD + n.y * LEVEL_H,
  }));
  const at = new Map(nodes.map((n) => [n.person.id, n]));
  const edges: Edge[] = [];
  for (const l of valid) {
    if (l.employee_id === l.manager_id) continue;
    const from = at.get(l.manager_id);
    const to = at.get(l.employee_id);
    if (!from || !to) continue;
    edges.push({ from, to, secondary: drawnUnder.get(l.employee_id) !== l.manager_id });
  }
  const bottom = Math.max(0, ...nodes.map((n) => n.y));
  return { nodes, edges, width: PAD * 2 + Math.max(1, slot) * SLOT, height: bottom + NODE_H + PAD * 2 };
}

/**
 * SVG path for one line. A line drawn down the tree runs from the bottom of
 * the manager to the top of the report; any other line (to a peer, or upward)
 * is a gentle curve between the two boxes' sides.
 */
export function edgePath(e: Edge): string {
  const x1 = e.from.x + NODE_W / 2;
  const x2 = e.to.x + NODE_W / 2;
  if (e.to.y > e.from.y) {
    const y1 = e.from.y + NODE_H;
    const y2 = e.to.y;
    const my = y1 + (e.secondary ? 14 : 22);
    if (Math.abs(x2 - x1) < 1) return `M${x1},${y1} V${y2}`;
    const dir = Math.sign(x2 - x1);
    const r = Math.min(8, Math.abs(x2 - x1) / 2);
    return `M${x1},${y1} V${my - r} Q${x1},${my} ${x1 + dir * r},${my} H${x2 - dir * r} Q${x2},${my} ${x2},${my + r} V${y2}`;
  }
  // Same level or upward: leave from the top, arc over, enter from the top.
  const y1 = e.from.y;
  const y2 = e.to.y;
  const lift = Math.min(y1, y2) - 12;
  return `M${x1},${y1} C${x1},${lift} ${x2},${lift} ${x2},${y2}`;
}
