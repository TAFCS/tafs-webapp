'use client';

import { useState } from 'react';
import StudentSelectorSidebar from '../../../../../components/enrollment/StudentSelectorSidebar';
import AdmissionOrderForm from '../../../../../components/enrollment/AdmissionOrderForm';

export default function AdmissionOrderPage() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  return (
    <div className="flex h-screen bg-gray-50">
      <StudentSelectorSidebar onStudentSelect={setSelectedStudent} />
      <div className="flex-1 p-6">
        {selectedStudent ? (
          <AdmissionOrderForm student={selectedStudent} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Select a Student</h2>
              <p className="text-gray-500">Use the sidebar to search and select a student by CC to view their admission order.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}