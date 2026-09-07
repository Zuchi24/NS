import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { completionColor } from "@/features/admin/format";
import type { Rate, YearLevelCompletion } from "@/features/admin/types";

/**
 * Completion by year level, for either half of the platform.
 *
 * One component rather than a chart per measure: the two read the same figure
 * off different fields, and the only real difference is the wording.
 */
export function CompletionChart({
  title,
  description,
  data,
  measure,
  unit,
}: {
  title: string;
  description: string;
  data: YearLevelCompletion[];
  /** Which completion figure to plot. */
  measure: "challengeCompletion";
  /** What the counts under each bar are counting. */
  unit: string;
}) {
  const points = data.map((year) => ({
    name: year.name,
    students: year.students,
    rate: year[measure] as Rate,
  }));

  const plotted = points.map((point) => ({
    name: point.name,
    "Completion %": point.rate.percent,
  }));

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={plotted}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              style={{ fontSize: "14px", fontWeight: "500" }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#6b7280"
              style={{ fontSize: "14px" }}
              label={{
                value: "Percentage (%)",
                angle: -90,
                position: "insideLeft",
              }}
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
              {plotted.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={completionColor(entry["Completion %"])}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {points.map((point) => (
              <div key={point.name} className="space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  {point.name}
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: completionColor(point.rate.percent) }}
                  />
                  <p className="text-lg font-bold text-gray-900">
                    {point.rate.percent}%
                  </p>
                </div>
                {/* The counts behind the bar, so the percentage is not the
                    only thing on offer — 0 of 0 reads very differently. */}
                <p className="text-xs text-gray-500">
                  {point.rate.count}/{point.rate.possible} {unit}
                </p>
                <p className="text-xs text-gray-400">
                  {point.students} student{point.students === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
