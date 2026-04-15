'use client';

import React, { useState, useEffect } from 'react';
import { Download, FileText } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AdmissionOrderPDF } from './AdmissionOrderPDF';

interface Student {
  cc: number;
  gr_number?: string;
  reg_number?: string;
  link_gr_number?: string;
  full_name: string;
  dob?: string;
  gender?: string;
  doa?: string;
  scholastic_year?: string;
  academic_year?: string;
  campus_name?: string;
  class_name?: string;
  section_name?: string;
  segment_head?: string;
  address?: string;
  home_phone?: string;
  father_name?: string;
  father_cell?: string;
  mother_cell?: string;
  nearest_relationship?: string;
  nearest_name?: string;
  nearest_phone?: string;
  email?: string;
  fax?: string;
  day?: string;
  date?: string;
}

interface AdmissionOrderFormProps {
  student: Student;
}

// Separate component for the remarks field to isolate re-renders
function RemarksField({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [localValue, onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
      <textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        rows={4}
        placeholder="Enter any additional remarks..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

// Separate component for the PDF button to further isolate heavy logic
const MemoizedPDFButton = React.memo(({ student, remarks }: { student: Student; remarks: string }) => {
  return (
    <PDFDownloadLink
      document={<AdmissionOrderPDF data={{
        cc: student.cc,
        gr_number: student.gr_number,
        reg_number: student.reg_number,
        link_gr_number: student.link_gr_number,
        full_name: student.full_name,
        father_name: student.father_name,
        dob: student.dob,
        gender: student.gender,
        doa: student.doa,
        academic_year: student.academic_year,
        campus_name: student.campus_name,
        class_name: student.class_name,
        section_name: student.section_name,
        remarks: remarks,
        address: student.address,
        home_phone: student.home_phone,
        fax: student.fax,
        father_cell: student.father_cell,
        mother_cell: student.mother_cell,
        nearest_phone: student.nearest_phone,
        nearest_name: student.nearest_name,
        relationship: student.nearest_relationship,
        email: student.email,
        day: student.day,
        date: student.date,
      }} />}
      fileName={`admission-order-${student.cc}.pdf`}
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      {({ loading }) => (
        <>
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Generating...' : 'Download PDF'}
        </>
      )}
    </PDFDownloadLink>
  );
});

export default function AdmissionOrderForm({ student }: AdmissionOrderFormProps) {
  const [remarks, setRemarks] = useState('');

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-100">TAFS School System</h1>
            <p className="text-red-200 mt-1">Admission Order Form</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-red-200">Computer Code: {student.cc}</p>
            <p className="text-sm text-red-200">GR Number: {student.gr_number || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 space-y-6">
        {/* Student Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={student.full_name}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="text"
              value={student.dob ? new Date(student.dob).toLocaleDateString() : ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <input
              type="text"
              value={student.gender || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
            <input
              type="text"
              value={student.reg_number || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link GR Number</label>
            <input
              type="text"
              value={student.link_gr_number || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scholastic Year</label>
            <input
              type="text"
              value={student.scholastic_year || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
            <input
              type="text"
              value={student.day || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="text"
              value={student.date || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>

        {/* Academic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campus</label>
            <input
              type="text"
              value={student.campus_name || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <input
              type="text"
              value={student.class_name || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <input
              type="text"
              value={student.section_name || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={student.address || ''}
                readOnly
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Home Phone</label>
                <input
                  type="text"
                  value={student.home_phone || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={student.email || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Guardian Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Guardian Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Father Name</label>
              <input
                type="text"
                value={student.father_name || ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Father Cell</label>
              <input
                type="text"
                value={student.father_cell || ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mother Cell</label>
              <input
                type="text"
                value={student.mother_cell || ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nearest Contact</label>
              <input
                type="text"
                value={`${student.nearest_name || ''} (${student.nearest_relationship || ''}) - ${student.nearest_phone || ''}`}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Remarks */}
        <RemarksField value={remarks} onChange={setRemarks} />

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <MemoizedPDFButton student={student} remarks={remarks} />
        </div>
      </div>
    </div>
  );
}