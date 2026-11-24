// Trim only empty preview staff tails, never timing, musical ink or current measure.
export function compactPreview(svg) {
  const measures = [...svg.querySelectorAll('g.measure')], common = svg.querySelector('g.page-margin');
  if (measures.length !== 2 || !common) throw Error('Unsupported compact preview structure');
  const paths = [...measures[1].querySelectorAll('g.staff > path')];
  if (paths.length !== 10) throw Error('Preview requires two five-line staves');
  const lines = paths.map(path => ({ path, start: path.getPointAtLength(0), end: path.getPointAtLength(path.getTotalLength()) }));
  const start = lines[0].start.x, originalEnd = lines[0].end.x;
  if (lines.some(line => Math.abs(line.start.y - line.end.y) > 0.1 || Math.abs(line.start.x - start) > 0.1
    || Math.abs(line.end.x - originalEnd) > 0.1)) throw Error('Unsupported preview staff geometry');
  const space = Math.abs(lines[1].start.y - lines[0].start.y);
  const ignored = new Set(svg.querySelectorAll('g.staff > path')), ink = [start];
  const toCommon = common.getScreenCTM().inverse();
  for (const node of svg.querySelectorAll('path, use, text, rect, ellipse, circle, polygon, polyline, line')) {
    if (ignored.has(node) || node.closest('defs, g.barLine, [data-note-targets], [visibility="hidden"], [display="none"]')) continue;
    const box = node.getBBox(), matrix = toCommon.multiply(node.getScreenCTM());
    if (!box.width && !box.height) continue;
    const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
    ink.push(...points.map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix).x));
  }
  const end = Math.min(originalEnd, Math.max(start + 2 * space, Math.max(...ink) + 2 * space));
  for (const line of lines) line.path.setAttribute('d', `M${line.start.x} ${line.start.y} L${end} ${line.start.y}`);
  const bar = measures[1].querySelector(':scope > g.barLine');
  if (!bar || bar.hasAttribute('transform')) throw Error('Unsupported preview boundary');
  bar.setAttribute('transform', `translate(${end - originalEnd} 0)`);
  const original = svg.viewBox.baseVal;
  for (const nested of svg.querySelectorAll(':scope > svg')) {
    nested.setAttribute('width', String(original.width)); nested.setAttribute('height', String(original.height));
  }
  const matrix = svg.getScreenCTM().inverse().multiply(common.getScreenCTM());
  if (matrix.a <= 0 || Math.abs(matrix.b) > 0.001 || Math.abs(matrix.c) > 0.001) throw Error('Unsupported rotated score');
  svg.setAttribute('viewBox', [original.x, original.y, original.width - (originalEnd - end) * matrix.a, original.height].join(' '));
}
