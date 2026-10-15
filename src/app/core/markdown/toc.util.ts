export interface TocItem {
  id: string;
  level: number;
  text: string;
  line: number;
}

/**
 * Extracts a hierarchical table of contents from markdown content.
 * Ignores headings inside fenced code blocks.
 */
export function extractTableOfContents(markdown: string): TocItem[] {
  if (!markdown) return [];

  const items: TocItem[] = [];
  const lines = markdown.split(/\r?\n/);
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const cleanText = rawText.replace(/[#*`_>[\]]/g, '').trim();

      const slug = cleanText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      items.push({
        id: `heading-${i + 1}-${slug}`,
        level,
        text: cleanText || 'Untitled section',
        line: i + 1,
      });
    }
  }

  return items;
}

