import { useNavigate } from 'react-router';
import { Card, CardContent } from '../ui/card';
import { Users } from 'lucide-react';
import { YEARS, SECTIONS, MOCK_STUDENTS } from '../../data/mock';

export function StudentsOverview() {
  const navigate = useNavigate();

  const getYearTotal = (year: string) => {
    let total = 0;
    SECTIONS.forEach((section) => {
      const key = `${year}-${section}`;
      total += MOCK_STUDENTS[key]?.length || 0;
    });
    return total;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">Select a year level to view students</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {YEARS.map((yearLevel) => {
          const totalStudents = getYearTotal(yearLevel);
          return (
            <Card
              key={yearLevel}
              onClick={() => navigate(`/admin/students/${encodeURIComponent(yearLevel)}`)}
              className="border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{yearLevel}</h3>
                <p className="text-sm text-gray-600">
                  {totalStudents} student{totalStudents !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
