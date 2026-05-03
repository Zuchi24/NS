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
import { getYearlyChallengeStats } from "../../data/dashboardTransform";
import { getPerformanceColor } from "../../data/dashboardData";
import type { YearlyChallengeStats } from "../../data/dashboardTransform";

interface ChallengesChartProps {
  data?: YearlyChallengeStats[];
}

export function ChallengesChart({ data }: ChallengesChartProps) {
  const chartData = data || getYearlyChallengeStats();

  const chartDataFormatted = chartData.map((item) => ({
    name: item.yearLabel,
    "Completion %": item.completionRate,
    "Avg Score": item.avgScore,
  }));

  const getBarColor = (value: number): string => {
    if (value >= 80) return "#10b981"; // Green
    if (value >= 60) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
  };

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">Challenges Performance by Year Level</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Average completion rate and scores across all challenges per year
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
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
            />
            <Bar dataKey="Completion %" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="Avg Score" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Performance Summary */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Summary</h3>
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
