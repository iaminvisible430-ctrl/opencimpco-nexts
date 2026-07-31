export type ParsedMessage = {
  thinking: string;
  visible: string;
  isThinking: boolean; // currently inside an unclosed <thinking> block
};

/**
 * Split streaming text into thinking + visible parts.
 * The model is instructed to wrap chain-of-thought in <thinking>...</thinking>.
 */
export function parseThinking(text: string): ParsedMessage {
  let thinking = "";
  let visible = "";
  let isThinking = false;
  let i = 0;
  while (i < text.length) {
    if (!isThinking) {
      const open = text.indexOf("<thinking>", i);
      if (open === -1) {
        visible += text.slice(i);
        break;
      }
      visible += text.slice(i, open);
      i = open + "<thinking>".length;
      isThinking = true;
    } else {
      const close = text.indexOf("</thinking>", i);
      if (close === -1) {
        thinking += text.slice(i);
        break;
      }
      thinking += text.slice(i, close) + "\n\n";
      i = close + "</thinking>".length;
      isThinking = false;
    }
  }
  // While streaming, the opening tag can arrive in pieces ("<thi"). Don't flash
  // the partial tag as visible answer text.
  visible = visible.replace(/<(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/, "");
  return { thinking: thinking.trim(), visible: visible.trim(), isThinking };
}

/**
 * Attachments are encoded into the persisted content as:
 *   [[img:data:image/png;base64,...]]
 * so the DB stays as plain text.
 */
export function encodeAttachments(text: string, attachments: string[]): string {
  if (!attachments.length) return text;
  return text + "\n" + attachments.map((a) => `[[img:${a}]]`).join("\n");
}

export function splitAttachments(raw: string): { text: string; images: string[] } {
  const images: string[] = [];
  const text = raw.replace(/\[\[img:(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\]\]/g, (_m, url) => {
    images.push(url);
    return "";
  }).trim();
  return { text, images };
}
