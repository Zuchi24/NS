import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { getYearlyRoadmapStats } from "../../data/dashboardTransform";
import type { YearlyRoadmapStats } from "../../data/dashboardTransform";
import { MOCK_STUDENTS, SECTIONS } from "../../data/mock";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface RoadmapChartProps {
  data?: YearlyRoadmapStats[];
}

interface ChartDataPoint {
  id: string;
  name: string;
  completionRate: number;
  completed: number;
  total: number;
}

const ROADMAP_TOTAL = 28;

const yearFilters = [
  { label: "Overall Students", value: "all" },
  { label: "1st Year", value: "1" },
  { label: "2nd Year", value: "2" },
  { label: "3rd Year", value: "3" },
  { label: "4th Year", value: "4" },
];

export function RoadmapChart({ data }: RoadmapChartProps) {
  const [selectedYear, setSelectedYear] = useState("all");
  const allChartData: ChartDataPoint[] = (data || getYearlyRoadmapStats()).map(
    (item) => {
      const completed = item.categories.reduce(
        (sum, category) => sum + category.completed,
        0
      );
      const total = item.categories.reduce((sum, category) => sum + category.total, 0);

      return {
        id: String(item.year),
        name: item.yearLabel,
        completionRate: item.completionRate,
        completed,
        total,
      };
    }
  );
  const sectionChartData: ChartDataPoint[] = SECTIONS.map((section) => {
    const yearLabel = yearFilters.find((filter) => filter.value === selectedYear)?.label;
    const students = MOCK_STUDENTS[`${yearLabel}-${section}`] || [];
    const completed = students.reduce(
      (sum, student) => sum + Math.min(student.completedRoadmapItems, ROADMAP_TOTAL),
      0
    );
    const total = students.length * ROADMAP_TOTAL;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      id: section,
      name: section,
      completionRate,
      completed,
      total,
    };
  });
  const chartData =
    selectedYear === "all"
      ? allChartData
      : sectionChartData;

  const chartDataFormatted = chartData.map((item) => ({
    name: item.name,
    "Completion %": item.completionRate,
  }));

  const getBarColor = (value: number): string => {
    if (value >= 80) return "#10b981"; // Green
    if (value >= 60) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
  };

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-lg">
              Learning Roadmap Progress {selectedYear === "all" ? "by Year Level" : "by Section"}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              {selectedYear === "all"
                ? "Theoretical knowledge completion mapped to academic progression"
                : "Roadmap completion rate for each section in the selected year"}
            </p>
          </div>
          <div className="w-full md:w-52">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {yearFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartDataFormatted}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              style={{ fontSize: "14px", fontWeight: "500" }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: "14px" }}
              label={{ value: "Percentage (%)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value) => `${value}%`}
            />
            <Bar dataKey="Completion %" radius={[8, 8, 0, 0]}>
              {chartDataFormatted.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry["Completion %"])}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Performance Summary */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Summary</h3>
          <p className="text-xs text-gray-600 mb-4">
            The chart above shows the theoretical knowledge completion rate for each {selectedYear === "all" ? "year level" : "section"}. Green indicates strong progress (80%+), yellow represents moderate progress (60-79%), and red shows areas needing attention (below 60%).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {chartData.map((item) => (
              <div key={item.id} className="space-y-2">
                <p className="text-xs font-medium text-gray-600">{item.name}</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getBarColor(item.completionRate) }}
                  />
                  <p className="text-lg font-bold text-gray-900">
                    {item.completionRate}%
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {item.completed}/{item.total} completed
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
