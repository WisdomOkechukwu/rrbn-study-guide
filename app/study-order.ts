/** Shuffle a study pass once, keeping each item exactly once and avoiding a boundary repeat. */
export function shuffle<T>(items: readonly T[], avoidFirst?: T): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (copy.length > 1 && copy[0] === avoidFirst) {
    const next = 1 + Math.floor(Math.random() * (copy.length - 1));
    [copy[0], copy[next]] = [copy[next], copy[0]];
  }
  // A full pass with three or more cards should not repeat the prior pass verbatim.
  if (copy.length > 2 && copy.every((item, index) => item === items[index])) {
    [copy[copy.length - 2], copy[copy.length - 1]] = [copy[copy.length - 1], copy[copy.length - 2]];
  }
  return copy;
}
