'use client';

import { useState } from 'react';
import { Search, User } from 'lucide-react';

interface Student {
  cc: number;
  full_name: string;
  gr_number?: string;
}

interface StudentSelectorSidebarProps {
  onStudentSelect: (student: Student | null) => void;
}

export default function StudentSelectorSidebar({ onStudentSelect }: StudentSelectorSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/students/search-simple?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data.data || []);
        // Don't auto-select, let user choose from results
        onStudentSelect(null);
      } else {
        setStudents([]);
        onStudentSelect(null);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setStudents([]);
      onStudentSelect(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = async (student: Student) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/enrollments/${student.cc}/admission-order`);
      if (response.ok) {
        const data = await response.json();
        onStudentSelect(data.data);
      } else {
        console.error('Failed to fetch admission order data');
        onStudentSelect(null);
      }
    } catch (error) {
      console.error('Failed to fetch admission order data:', error);
      onStudentSelect(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Search</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Enter CC, name, or GR number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {students.length > 0 ? (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Search Results</h3>
            {students.map((student) => (
              <div
                key={student.cc}
                className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleStudentSelect(student)}
              >
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{student.full_name}</p>
                    <p className="text-sm text-gray-600">CC: {student.cc}</p>
                    {student.gr_number && (
                      <p className="text-sm text-gray-500">GR: {student.gr_number}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            {loading ? 'Searching...' : 'No students found. Enter a CC number to search.'}
          </div>
        )}
      </div>
    </div>
  );
}