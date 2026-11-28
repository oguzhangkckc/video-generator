// How much a drawn data line swings, read off the line itself; the trace scene reports it and qa compares it with what
// a part means (`drop`). Pure, so the Node tests import it.
type Vec = [number, number];

/**
 * The line's swing (peak to peak, screen px) in windows two cycles wide, a cycle read off the drawn line itself (its
 * turning points); `ref` is the usual swing (the median window), `windows` each window's x span and swing.
 */
export const swings = (line: Vec[]) => {
  const turns = line.filter((p, i) => i > 0 && i < line.length - 1 && (p[1] - line[i - 1][1]) * (line[i + 1][1] - p[1]) < 0);
  const gaps = turns.slice(1).map((p, i) => p[0] - turns[i][0]).sort((a, b) => a - b);
  if (gaps.length < 4) return null;
  const width = 4 * gaps[Math.floor(gaps.length / 2)];
  const windows: { x1: number; x2: number; swing: number }[] = [];
  for (let x1 = line[0][0]; x1 + width <= line[line.length - 1][0]; x1 += width / 4) {
    const ys = line.filter(([x]) => x >= x1 && x <= x1 + width).map(([, y]) => y);
    if (ys.length) windows.push({ x1, x2: x1 + width, swing: Math.max(...ys) - Math.min(...ys) });
  }
  const sorted = windows.map((w) => w.swing).sort((a, b) => a - b);
  return sorted.length ? { ref: sorted[Math.floor(sorted.length / 2)], windows } : null;
};
