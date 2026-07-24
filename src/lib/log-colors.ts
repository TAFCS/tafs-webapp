export const SECTION_COLORS: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  'house-balancer': { text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  student:        { text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-500' },
  finance:        { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  communication:  { text: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  dot: 'bg-violet-500' },
  hr:             { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  attendance:     { text: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  'school-setup': { text: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  system:         { text: 'text-zinc-600',    bg: 'bg-zinc-50',    border: 'border-zinc-200',    dot: 'bg-zinc-500' },
  'parent-requests': { text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500' },
};

export function getSectionColor(section?: string | null) {
  return SECTION_COLORS[section ?? ''] ?? SECTION_COLORS['system'];
}

export const SECTION_LABELS: Record<string, string> = {
  'house-balancer': 'House Rebalancer',
  student:        'Students',
  finance:        'Finance',
  communication:  'Communications',
  hr:             'HR',
  attendance:     'Attendance',
  'school-setup': 'Setup',
  system:         'System',
  'parent-requests': 'Parent Requests',
};
