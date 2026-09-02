import { redirect } from 'next/navigation';

export default function ClassReschedulesRedirectPage() {
  redirect('/hr/timetables?mode=makeup');
}
