import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { getYearlyRoadmapStats } from "../../data/dashboardTransform";
import type { YearlyRoadmapStats } from "../../data/dashboardTransform";

interface RoadmapChartProps {
  data?: YearlyRoadmapStats[];
}

export function RoadmapChart({ data }: RoadmapChartProps) {
  const chartData = data || getYearlyRoadmapStats();

  const chartDataFormatted = chartData.map((item) => ({
    name: item.yearLabel,
    "Completion %": item.completionRate,
    year: item.year,
  }));

  const getBarColor = (value: number): string => {
    if (value >= 80) return "#10b981"; // Green
    if (value >= 60) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
  };

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">Learning Roadmap Progress by Year Level</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Theoretical knowledge completion mapped to academic progression
        </p>
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
            The chart above shows the theoretical knowledge completion rate for each year level. Green indicates strong progress (80%+), yellow represents moderate progress (60-79%), and red shows areas needing attention (below 60%).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {chartData.map((item) => (
              <div key={item.year} className="space-y-2">
                <p className="text-xs font-medium text-gray-600">{item.yearLabel}</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getBarColor(item.completionRate) }}
                  />
                  <p className="text-lg font-bold text-gray-900">
                    {item.completionRate}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
