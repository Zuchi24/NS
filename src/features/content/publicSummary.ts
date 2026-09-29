import { api } from "@/services/api";

/**
 * How much the catalogue holds, as the public landing page shows it.
 *
 * Kept apart from contentService on purpose: that module is the signed-in
 * student's reading of content and their attempts, and the landing page is read
 * by people who are neither. It needs only the API client.
 */
export interface PublicSummary {
  topics: number;
  challenges: number;
}

/**
 * The released topic and challenge counts. Needs no token: the landing page is
 * read before anyone has signed in, and the endpoint says nothing but these two
 * numbers.
 */
export async function fetchPublicSummary(): Promise<PublicSummary> {
  const { data } = await api.get<{ data: PublicSummary }>("/public/summary");

  return { topics: data.topics, challenges: data.challenges };
}
