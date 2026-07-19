export type SectionAvailability = {
  id: number;
  description: string;
  student_capacity?: number | null;
  gender_mode?: 'COED' | 'BOYS_ONLY' | 'GIRLS_ONLY' | string;
  enrolled_count?: number;
  remaining_seats?: number | null;
  is_full?: boolean;
};

export function formatSectionOptionLabel(
  section: SectionAvailability,
  opts?: { recommendedId?: number | null; studentGender?: string | null },
): string {
  const parts = [section.description];

  if (typeof section.enrolled_count === 'number') {
    if (section.student_capacity == null) {
      parts.push(`(${section.enrolled_count} enrolled)`);
    } else {
      parts.push(`(${section.enrolled_count}/${section.student_capacity})`);
    }
  }

  if (section.gender_mode === 'BOYS_ONLY') parts.push('[Boys]');
  if (section.gender_mode === 'GIRLS_ONLY') parts.push('[Girls]');
  if (section.is_full) parts.push('FULL');

  if (opts?.recommendedId != null && opts.recommendedId === section.id) {
    parts.push('(Recommended)');
  }

  const gender = (opts?.studentGender || '').toLowerCase();
  if (section.gender_mode === 'BOYS_ONLY' && gender && !['m', 'male', 'boy', 'boys'].includes(gender)) {
    parts.push('(incompatible)');
  }
  if (section.gender_mode === 'GIRLS_ONLY' && gender && !['f', 'female', 'girl', 'girls'].includes(gender)) {
    parts.push('(incompatible)');
  }

  return parts.join(' ');
}

export function extractApiErrorMessage(err: any, fallback = 'Request failed'): string {
  const payload = err?.response?.data?.message;
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string') return payload.message;
    if (typeof payload.code === 'string') return payload.code;
  }
  if (typeof payload === 'string') return payload;
  if (typeof err?.response?.data?.error === 'string') return err.response.data.error;
  if (typeof err?.message === 'string') return err.message;
  return fallback;
}

export function isSectionSelectableForGender(
  section: SectionAvailability,
  studentGender?: string | null,
): boolean {
  if (section.is_full) return false;
  const gender = (studentGender || '').toLowerCase();
  if (!gender) return true;
  if (section.gender_mode === 'BOYS_ONLY') {
    return ['m', 'male', 'boy', 'boys'].includes(gender);
  }
  if (section.gender_mode === 'GIRLS_ONLY') {
    return ['f', 'female', 'girl', 'girls'].includes(gender);
  }
  return true;
}
