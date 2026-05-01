import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Users, ArrowLeft } from 'lucide-react';
import { SECTIONS, MOCK_STUDENTS } from '../../data/mock';

export function YearView() {
  const { year } = useParams();
  const navigate = useNavigate();

  if (!year) {
    navigate('/admin/students');
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/students')}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-sm text-gray-500">{year}</p>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {SECTIONS.map((section) => {
          const key = `${year}-${section}`;
          const sectionStudents = MOCK_STUDENTS[key] || [];
          return (
            <Card
              key={section}
              onClick={() =>
                navigate(`/admin/students/${encodeURIComponent(year)}/${encodeURIComponent(section)}`)
              }
              className="border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{section}</h3>
                <p className="text-sm text-gray-600">
                  {sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
