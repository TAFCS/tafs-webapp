import { redirect } from 'next/navigation';

export default function StaffLessonReschedulesRedirectPage() {
  redirect('/hr/timetables?mode=makeup');
}
