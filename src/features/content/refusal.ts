/**
 * What to tell a student when the server refuses to open something.
 *
 * The server's own reason, whenever it gave one: "Take the pre-test for …
 * first", "This topic has not been released yet". Those are the server's
 * judgements, and repeating them is the only way a page can say why without
 * making a reason up.
 *
 * A refusal with no reason of its own reaches the client as Laravel's stock
 * sentence, which says nothing a student can act on — so that one, and an
 * empty message, are replaced by the page's plain fallback instead.
 */

/** Laravel's wording for a refusal given no reason of its own. */
const UNEXPLAINED_REFUSAL = "This action is unauthorized.";

export function refusalReason(
  message: string | null | undefined,
  fallback: string,
): string {
  const reason = message?.trim();

  return reason && reason !== UNEXPLAINED_REFUSAL ? reason : fallback;
}
