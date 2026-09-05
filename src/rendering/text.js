// Preserve word order and measure the actual font, rather than counting letters.
export function wrapText(ctx, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawFittedText(ctx, text, x, y, width, size = 16, weight = 700) {
  ctx.font = `${weight} ${size}px system-ui`;
  const measured = ctx.measureText(text).width;
  if (measured > width) ctx.font = `${weight} ${size * width / measured}px system-ui`;
  ctx.fillText(text, x, y);
}

export function drawWrappedText(ctx, text, x, y, width, maxLines = 2, size = 11, weight = 400) {
  let lines;
  do {
    ctx.font = `${weight} ${size}px system-ui`;
    lines = wrapText(ctx, text, width);
    if (lines.length <= maxLines) break;
    size -= 0.5;
  } while (size > 8);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * (size + 2)));
}
