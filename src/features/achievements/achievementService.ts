import { api } from "@/services/api";
import type { Achievement } from "./types";

/**
 * The achievement catalogue, measured against the signed-in student.
 *
 * The API returns snake_case and answers with every active achievement,
 * locked ones included — the page needs the locked ones to show what is left
 * to unlock.
 */

interface ApiAchievement {
  id: number;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  type: Achievement["type"];
  requirement: string;
  progress: { current: number; target: number };
  earned_at: string | null;
}

function toAchievement(achievement: ApiAchievement): Achievement {
  return {
    id: achievement.id,
    key: achievement.key,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
    type: achievement.type,
    requirement: achievement.requirement,
    progress: achievement.progress,
    earnedAt: achievement.earned_at,
  };
}

/** Every active achievement, earned and locked alike. */
export async function fetchAchievements(): Promise<Achievement[]> {
  const { data } = await api.get<{ data: ApiAchievement[] }>("/achievements");

  return data.map(toAchievement);
}

/** Only the ones the student has already unlocked. */
export async function fetchEarnedAchievements(): Promise<Achievement[]> {
  const { data } = await api.get<{ data: ApiAchievement[] }>(
    "/achievements/earned",
  );

  return data.map(toAchievement);
}
