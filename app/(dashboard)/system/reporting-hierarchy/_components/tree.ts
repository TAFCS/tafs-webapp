import type { HierarchyEmployee, ReportingLine } from "@/lib/hr.service";

/**
 * Pure helpers for the Reporting Hierarchy page. The backend
 * (reporting-hierarchy.rules.ts) is the authority on loops and the
 * department/campus rule; these only preview them so the picker can explain a
 * choice before it is saved.
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
  /** Direct reports via the primary line, i.e. the ones drawn below this node. */
  childCount: number;
  collapsed: boolean;
};

export type Edge = { from: PlacedNode; to: PlacedNode; secondary: boolean };

export function managersOf(lines: ReportingLine[], employeeId: number): ReportingLine[] {
  return lines
    .filter((l) => l.employee_id === employeeId)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
}

export function directReportsOf(lines: ReportingLine[], managerId: number): number[] {
  return lines.filter((l) => l.manager_id === managerId).map((l) => l.employee_id);
}

/** Everyone below `employeeId`, through every line. */
export function descendantsOf(lines: ReportingLine[], employeeId: number): Set<number> {
  const seen = new Set<number>();
  const stack = directReportsOf(lines, employeeId);
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...directReportsOf(lines, id));
  }
  return seen;
}

/** Everyone above `employeeId`, through every line. */
export function ancestorsOf(lines: ReportingLine[], employeeId: number): Set<number> {
  const seen = new Set<number>();
  const stack = managersOf(lines, employeeId).map((l) => l.manager_id);
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...managersOf(lines, id).map((l) => l.manager_id));
  }
  return seen;
}

/** Why `manager` can't manage `employee`, or null when they can. Mirrors the backend. */
export function managerProblem(
  lines: ReportingLine[],
  employee: HierarchyEmployee,
  manager: HierarchyEmployee,
): string | null {
  if (manager.id === employee.id) return "Can't report to themselves";
  if (descendantsOf(lines, employee.id).has(manager.id)) return "Already reports to this person";
  if (manager.senior_leadership) return null;
  if (employee.campus_id == null || employee.department_id == null) return "Set campus and department first";
  if (manager.campus_id !== employee.campus_id) return "Different campus";
  if (manager.department_id !== employee.department_id) return "Different department";
  return null;
}

/**
 * Lays out everyone who has at least one reporting line. Each person sits under
 * their primary manager; other managers get a dotted line. A leaf takes the
 * next slot and a manager is centred over their reports.
 */
export function layoutTree(
  employees: HierarchyEmployee[],
  lines: ReportingLine[],
  expanded: Set<number>,
  collapsed: Set<number>,
): { nodes: PlacedNode[]; edges: Edge[]; width: number; height: number } {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const inTree = new Set<number>();
  for (const l of lines) {
    if (byId.has(l.employee_id) && byId.has(l.manager_id)) {
      inTree.add(l.employee_id);
      inTree.add(l.manager_id);
    }
  }

  const primaryOf = new Map<number, number>();
  for (const id of inTree) {
    const first = managersOf(lines, id).find((l) => byId.has(l.manager_id));
    if (first) primaryOf.set(id, first.manager_id);
  }
  const kids = new Map<number, number[]>();
  for (const [child, parent] of primaryOf) kids.set(parent, [...(kids.get(parent) ?? []), child]);
  const name = (id: number) => byId.get(id)?.full_name ?? "";
  for (const list of kids.values()) list.sort((a, b) => name(a).localeCompare(name(b)));

  const isCollapsed = (id: number) => {
    const n = kids.get(id)?.length ?? 0;
    if (n === 0) return false;
    if (collapsed.has(id)) return true;
    if (expanded.has(id)) return false;
    return n > COLLAPSE_OVER;
  };

  const placed = new Map<number, PlacedNode>();
  let slot = 0;
  const place = (id: number, depth: number) => {
    const children = isCollapsed(id) ? [] : kids.get(id) ?? [];
    let x: number;
    if (children.length === 0) {
      x = slot++;
    } else {
      children.forEach((c) => place(c, depth + 1));
      x = (placed.get(children[0])!.x + placed.get(children[children.length - 1])!.x) / 2;
    }
    placed.set(id, {
      person: byId.get(id)!,
      x,
      y: depth,
      childCount: kids.get(id)?.length ?? 0,
      collapsed: isCollapsed(id),
    });
  };
  const roots = [...inTree].filter((id) => !primaryOf.has(id)).sort((a, b) => name(a).localeCompare(name(b)));
  roots.forEach((r) => place(r, 0));

  const nodes = [...placed.values()].map((n) => ({
    ...n,
    x: PAD + n.x * SLOT + (SLOT - NODE_W) / 2,
    y: PAD + n.y * LEVEL_H,
  }));
  const at = new Map(nodes.map((n) => [n.person.id, n]));
  const edges: Edge[] = [];
  for (const l of lines) {
    const from = at.get(l.manager_id);
    const to = at.get(l.employee_id);
    if (!from || !to) continue;
    edges.push({ from, to, secondary: primaryOf.get(l.employee_id) !== l.manager_id });
  }
  const depth = Math.max(0, ...nodes.map((n) => n.y));
  return { nodes, edges, width: PAD * 2 + Math.max(1, slot) * SLOT, height: depth + NODE_H + PAD * 2 };
}

/** SVG path for one line: down from the manager, across, down into the report. */
export function edgePath(e: Edge): string {
  const x1 = e.from.x + NODE_W / 2;
  const y1 = e.from.y + NODE_H;
  const x2 = e.to.x + NODE_W / 2;
  const y2 = e.to.y;
  const my = y1 + (e.secondary ? 14 : 22);
  if (Math.abs(x2 - x1) < 1) return `M${x1},${y1} V${y2}`;
  const dir = Math.sign(x2 - x1);
  const r = Math.min(8, Math.abs(x2 - x1) / 2);
  return `M${x1},${y1} V${my - r} Q${x1},${my} ${x1 + dir * r},${my} H${x2 - dir * r} Q${x2},${my} ${x2},${my + r} V${y2}`;
}
