// Data transformation utilities for dashboard analytics

import { challengeStats, roadmapData, categoryToYearLevel } from "./dashboardData";
import type { ChallengeData, RoadmapNode } from "./dashboardData";

export interface YearlyChallengeStats {
  year: number;
  yearLabel: string;
  completionRate: number;
  avgScore: number;
  completed: number;
  total: number;
}

export interface CategoryProgress {
  category: string;
  completed: number;
  total: number;
  completionRate: number;
}

export interface YearlyRoadmapStats {
  year: number;
  yearLabel: string;
  completionRate: number;
  categories: CategoryProgress[];
}

export interface DashboardInsights {
  weakestYear: { year: number; rate: number };
  strongestYear: { year: number; rate: number };
  weakestCategory: { category: string; rate: number; year: number };
  theoryPracticGap: { challenges: number; roadmap: number; gap: number };
  overallChallengeRate: number;
  overallRoadmapRate: number;
}

/**
 * Transform challenge stats into yearly aggregated data
 */
export function getYearlyChallengeStats(): YearlyChallengeStats[] {
  const yearlyData: Record<number, { completed: number; total: number; scores: number[] }> = {
    1: { completed: 0, total: 0, scores: [] },
    2: { completed: 0, total: 0, scores: [] },
    3: { completed: 0, total: 0, scores: [] },
    4: { completed: 0, total: 0, scores: [] },
  };

  challengeStats.forEach((challenge) => {
    const year = challenge.yearLevel;
    if (yearlyData[year]) {
      yearlyData[year].completed += challenge.completed;
      yearlyData[year].total += challenge.total;
      yearlyData[year].scores.push(challenge.avgScore);
    }
  });

  return Object.entries(yearlyData).map(([yearStr, data]) => {
    const year = parseInt(yearStr);
    const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    const avgScore = data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0;

    return {
      year,
      yearLabel: `Year ${year}`,
      completionRate,
      avgScore,
      completed: data.completed,
      total: data.total,
    };
  });
}

/**
 * Transform roadmap data into yearly and category-based aggregation
 */
export function getYearlyRoadmapStats(): YearlyRoadmapStats[] {
  const yearlyData: Record<number, Record<string, { completed: number; total: number }>> = {
    1: {},
    2: {},
    3: {},
    4: {},
  };

  // Initialize all categories for all years
  Object.values(categoryToYearLevel).forEach((year) => {
    Object.keys(categoryToYearLevel).forEach((category) => {
      if (!yearlyData[year]) yearlyData[year] = {};
      if (!yearlyData[year][category]) {
        yearlyData[year][category] = { completed: 0, total: 0 };
      }
    });
  });

  // Aggregate roadmap data
  roadmapData.forEach((node) => {
    const year = node.yearLevel;
    const category = node.category;

    if (yearlyData[year] && !yearlyData[year][category]) {
      yearlyData[year][category] = { completed: 0, total: 0 };
    }

    if (yearlyData[year] && yearlyData[year][category]) {
      yearlyData[year][category].total += 1;
      if (node.completed) {
        yearlyData[year][category].completed += 1;
      }
    }
  });

  return Object.entries(yearlyData).map(([yearStr, categories]) => {
    const year = parseInt(yearStr);
    const categoryList: CategoryProgress[] = Object.entries(categories)
      .filter(([_, data]) => data.total > 0)
      .map(([category, data]) => ({
        category,
        completed: data.completed,
        total: data.total,
        completionRate: Math.round((data.completed / data.total) * 100),
      }));

    const totalCompleted = categoryList.reduce((sum, c) => sum + c.completed, 0);
    const totalCount = categoryList.reduce((sum, c) => sum + c.total, 0);
    const completionRate = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

    return {
      year,
      yearLabel: `Year ${year}`,
      completionRate,
      categories: categoryList,
    };
  });
}

/**
 * Generate analytical insights from dashboard data
 */
export function generateDashboardInsights(): DashboardInsights {
  const yearlyChallenges = getYearlyChallengeStats();
  const yearlyRoadmap = getYearlyRoadmapStats();

  // Find weakest and strongest years for challenges
  const weakestYear = yearlyChallenges.reduce((min, curr) =>
    curr.completionRate < min.completionRate ? curr : min
  );
  const strongestYear = yearlyChallenges.reduce((max, curr) =>
    curr.completionRate > max.completionRate ? curr : max
  );

  // Find weakest category
  let weakestCategory: { category: string; rate: number; year: number } = {
    category: "",
    rate: 100,
    year: 1,
  };
  yearlyRoadmap.forEach((yearData) => {
    yearData.categories.forEach((cat) => {
      if (cat.completionRate < weakestCategory.rate) {
        weakestCategory = {
          category: cat.category,
          rate: cat.completionRate,
          year: yearData.year,
        };
      }
    });
  });

  // Calculate overall rates
  const overallChallengeRate = Math.round(
    yearlyChallenges.reduce((sum, y) => sum + y.completionRate, 0) / yearlyChallenges.length
  );
  const overallRoadmapRate = Math.round(
    yearlyRoadmap.reduce((sum, y) => sum + y.completionRate, 0) / yearlyRoadmap.length
  );
  const gap = overallChallengeRate - overallRoadmapRate;

  return {
    weakestYear: { year: weakestYear.year, rate: weakestYear.completionRate },
    strongestYear: { year: strongestYear.year, rate: strongestYear.completionRate },
    weakestCategory,
    theoryPracticGap: {
      challenges: overallChallengeRate,
      roadmap: overallRoadmapRate,
      gap: gap,
    },
    overallChallengeRate,
    overallRoadmapRate,
  };
}
