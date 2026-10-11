import { validArticleImage } from "./article-clipboard";
import type { ClipboardImage } from "./article-clipboard";

export const MAX_WORD_BYTES = 50 * 1024 * 1024;

// Bound decompression before handing the ZIP to the document converter.
function validateWordArchive(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = buffer.byteLength - 22;
  const minimum = Math.max(0, end - 65535);
  for (; end >= minimum; end--) if (view.getUint32(end, true) === 0x06054b50) break;
  if (end < minimum || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error("Invalid Word archive");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  let size = 0;
  if (!count || count > 10000 || offset === 0xffffffff) throw new Error("Unsupported Word archive");
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50 || (view.getUint16(offset + 8, true) & 1)) throw new Error("Invalid Word archive");
    size += view.getUint32(offset + 24, true);
    if (size > 150 * 1024 * 1024) throw new Error("Word document is too large");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset > end) throw new Error("Invalid Word archive");
}

export async function importArticleWord(file: File) {
  if (!/\.docx$/i.test(file.name) || file.size > MAX_WORD_BYTES || file.size < 22) throw new Error("Invalid Word document");
  const buffer = await file.arrayBuffer();
  validateWordArchive(buffer);
  const mammoth = await import("mammoth/mammoth.browser");
  const files = new Map<string, File>();
  let invalidImages = false;
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
    externalFileAccess: false, includeEmbeddedStyleMap: false,
    styleMap: ["u => u", "strike => s"],
    convertImage: mammoth.images.imgElement(async image => {
      try {
        const bytes = await image.readAsArrayBuffer();
        const type = image.contentType === "image/jpg" ? "image/jpeg" : image.contentType;
        const file = new File([bytes], `word-${files.size + 1}.${type.split("/")[1]}`, { type });
        if (!validArticleImage(file)) throw new Error("Unsupported image");
        const source = `docx-image:${files.size + 1}`;
        files.set(source, file);
        return { src: source };
      } catch {
        invalidImages = true;
        return { src: "" };
      }
    }),
  });
  const container = new DOMParser().parseFromString(result.value, "text/html").body;
  const images: ClipboardImage[] = [];
  for (const image of Array.from(container.querySelectorAll("img"))) {
    const file = files.get(image.getAttribute("src") || "");
    if (file) images.push({ file, elements: [image] });
    else image.remove();
  }
  // Strip unsafe links before the imported HTML enters the interactive editor.
  for (const link of Array.from(container.querySelectorAll("a[href]"))) {
    const href = link.getAttribute("href") || "";
    try {
      if (!["http:", "https:", "mailto:"].includes(new URL(href, window.location.href).protocol)) link.removeAttribute("href");
    } catch { link.removeAttribute("href"); }
  }
  return { container, images, invalidImages, warnings: result.messages.length > 0 };
}
