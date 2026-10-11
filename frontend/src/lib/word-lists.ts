// Word sometimes encodes a bullet as § in a symbol font. Only list markers are
// converted: section signs in ordinary paragraphs (for example § 5) are preserved.
export function normalizeWordBullets(body: HTMLElement): boolean {
  const entries = new Map<HTMLParagraphElement, { level: number; id: string }>();
  let changed = false;
  for (const paragraph of Array.from(body.querySelectorAll("p"))) {
    const style = paragraph.getAttribute("style") || "";
    const spans = Array.from(paragraph.querySelectorAll("span"));
    const marker = spans.find(span =>
      /mso-list\s*:\s*ignore/i.test(span.getAttribute("style") || "") && /^[\s\u200b]*§[\s\u200b]*$/.test(span.textContent || ""));
    const wordList = /mso-list\s*:/i.test(style) || /\bMsoListParagraph\w*\b/i.test(paragraph.className);
    const symbol = spans.find(span => /font-family\s*:[^;]*Wingdings/i.test(span.getAttribute("style") || "") && /^[\s\u200b]*§[\s\u200b]*$/.test(span.textContent || ""));
    const text = paragraph.textContent || "";
    const prefix = /^[\s\u200b]*§(?:[\s\u200b]+|$)/.exec(text);
    if (!/^[\s\u200b]*§/.test(text) || (!marker && !wordList && !symbol) || (!marker && !symbol && !prefix)) continue;

    if (marker || symbol) (marker || symbol)!.remove();
    else if (prefix) {
      const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let remaining = prefix[0].length;
      let node: Node | null;
      while (remaining && (node = walker.nextNode())) {
        const content = node.textContent || "";
        const count = Math.min(remaining, content.length);
        node.textContent = content.slice(count);
        remaining -= count;
      }
    }
    const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      node.textContent = (node.textContent || "").replace(/^[\s\u200b]+/, "");
      if (node.textContent) break;
    }
    changed = true;
    // An existing HTML list already supplies the dot; remove the extra Word marker.
    if (paragraph.closest("li")) continue;
    entries.set(paragraph, {
      level: Math.min(9, Math.max(1, Number(/\blevel(\d+)\b/i.exec(style)?.[1] || 1))),
      id: /mso-list\s*:\s*([^;]+)/i.exec(style)?.[1]?.replace(/\blevel\d+\b/i, "").trim() || "word-bullets",
    });
  }

  const parents = new Set(Array.from(entries.keys()).map(paragraph => paragraph.parentElement).filter((parent): parent is HTMLElement => !!parent));
  for (const parent of parents) {
    let id = "";
    const stack: Array<{ level: number; list: HTMLUListElement; item?: HTMLLIElement }> = [];
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE || (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim())) continue;
      const entry = entries.get(child as HTMLParagraphElement);
      if (!entry) { stack.length = 0; id = ""; continue; }
      if (entry.id !== id) { stack.length = 0; id = entry.id; }
      while (stack.length > 1 && entry.level < stack[stack.length - 1].level) stack.pop();
      if (!stack.length || entry.level < stack[0].level) {
        const list = body.ownerDocument.createElement("ul");
        parent.insertBefore(list, child);
        stack.length = 0;
        stack.push({ level: entry.level, list });
      } else if (entry.level > stack[stack.length - 1].level) {
        const previous = stack[stack.length - 1];
        const list = body.ownerDocument.createElement("ul");
        previous.item!.append(list);
        stack.push({ level: entry.level, list });
      }
      const current = stack[stack.length - 1];
      const item = body.ownerDocument.createElement("li");
      current.list.append(item);
      item.append(child);
      current.item = item;
    }
  }
  return changed;
}
