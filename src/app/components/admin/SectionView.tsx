import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { User, ArrowLeft } from 'lucide-react';
import { MOCK_STUDENTS } from '../../data/mock';

export function SectionView() {
  const { year, sectionId } = useParams();
  const navigate = useNavigate();

  if (!year || !sectionId) {
    navigate('/admin/students');
    return null;
  }

  const key = `${year}-${sectionId}`;
  const students = MOCK_STUDENTS[key] || [];

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/students/${encodeURIComponent(year)}`)}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-sm text-gray-500">
          {year} / {sectionId}
        </p>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Student ID
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{student.studentId}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          student.status === 'Passed'
                            ? 'bg-green-100 text-green-700'
                            : student.status === 'Needs Improvement'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/admin/students/${encodeURIComponent(year)}/${encodeURIComponent(
                              sectionId
                            )}/${student.id}`
                          )
                        }
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && (
              <p className="text-gray-500 text-center py-8">No students in this section</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
