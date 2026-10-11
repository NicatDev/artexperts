import { normalizeWordBullets } from "./word-lists";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validArticleImage(file: File) {
  return file.size > 0 && file.size <= MAX_IMAGE_BYTES && IMAGE_TYPES.includes(file.type);
}

function embeddedImage(source: string): File | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/i.exec(source);
  if (!match || match[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 1024) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2].replace(/\s/g, "")), char => char.charCodeAt(0));
    const type = match[1].toLowerCase();
    return new File([bytes], `clipboard.${type.split("/")[1]}`, { type });
  } catch { return null; }
}

// Desktop Word can provide image bytes in RTF even when its HTML only has file:// links.
// Only supported raster pictures are decoded; nested metadata and binary RTF are ignored.
function rtfImages(rtf: string): File[] {
  if (!rtf || rtf.length > 100 * 1024 * 1024) return [];
  const files: File[] = [];
  const pictures = /\{\\pict\b/g;
  let match: RegExpExecArray | null;
  while ((match = pictures.exec(rtf))) {
    let depth = 1;
    let position = pictures.lastIndex;
    let type = "";
    let hex = "";
    let invalid = false;
    while (position < rtf.length && depth > 0) {
      const char = rtf[position];
      if (char === "{") { depth++; position++; continue; }
      if (char === "}") { depth--; position++; continue; }
      if (char === "\\") {
        const control = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(position, position + 80));
        if (control) {
          if (depth === 1) {
            if (control[1] === "pngblip") type = "image/png";
            if (control[1] === "jpegblip") type = "image/jpeg";
          }
          if (control[1] === "bin") {
            const length = Number(control[2]);
            invalid = true;
            position += control[0].length + (Number.isSafeInteger(length) && length > 0 ? length : 0);
          } else position += control[0].length;
          continue;
        }
        position += 2;
        continue;
      }
      if (depth === 1 && !invalid && type) {
        const chunk = /^[0-9a-f\s]+/i.exec(rtf.slice(position, position + 65536));
        if (chunk) {
          hex += chunk[0].replace(/\s/g, "");
          position += chunk[0].length;
          if (hex.length > MAX_IMAGE_BYTES * 2) invalid = true;
          continue;
        }
        invalid = true;
        if (hex.length > MAX_IMAGE_BYTES * 2) invalid = true;
      }
      position++;
    }
    pictures.lastIndex = position;
    if (!invalid && depth === 0 && type && hex && hex.length % 2 === 0) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      files.push(new File([bytes], `word-${files.length + 1}.${type === "image/png" ? "png" : "jpg"}`, { type }));
    }
  }
  return files;
}

export type ClipboardImage = { file: File; elements: HTMLImageElement[] };

export type ArticleClipboardData = { html: string; text: string; rtf: string; files: File[] };

export function readArticleClipboard(data: DataTransfer): ArticleClipboardData {
  const files = Array.from(data.files);
  for (const item of Array.from(data.items || [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && !files.some(existing => existing.name === file.name && existing.size === file.size && existing.type === file.type)) files.push(file);
  }
  return {
    html: data.getData("text/html"), text: data.getData("text/plain"), files,
    rtf: data.getData("text/rtf") || data.getData("application/rtf") || data.getData("application/x-rtf") || data.getData("text/richtext"),
  };
}

// Called only during a user paste when the event has local image links but no bytes.
// Some browsers expose PNG data through the async API rather than DataTransfer.files.
export async function recoverClipboardImages(original: ArticleClipboardData): Promise<ArticleClipboardData> {
  if (!navigator.clipboard?.read || !window.isSecureContext) return original;
  try {
    const items = await navigator.clipboard.read();
    let text = "";
    const files: File[] = [];
    for (const item of items) {
      if (item.types.includes("text/plain")) text += await (await item.getType("text/plain")).text();
      const type = item.types.find(type => IMAGE_TYPES.includes(type));
      if (type) {
        const blob = await item.getType(type);
        files.push(new File([blob], `clipboard-${files.length + 1}.${type.split("/")[1]}`, { type }));
      }
    }
    // Do not combine newly copied content with the paste that started this request.
    if (original.text && text && original.text !== text) return original;
    return files.length ? { ...original, files } : original;
  } catch { return original; }
}

export function articleClipboard(data: ArticleClipboardData) {
  const { html } = data;
  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;
  const normalizedLists = normalizeWordBullets(body);
  // Older Word versions can put all VML image markup inside conditional comments.
  // Read those picture nodes only when there are no normal HTML image fallbacks.
  if (!body.querySelector("img")) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
    const comments: Comment[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) comments.push(node as Comment);
    for (const comment of comments) {
      if (!/<v:imagedata\b/i.test(comment.data)) continue;
      const fragment = new DOMParser().parseFromString(comment.data.replace(/^\s*\[if[^\]]*\]>/i, "").replace(/<!\[endif\]\s*$/i, ""), "text/html");
      const pictures = Array.from(fragment.getElementsByTagName("v:imagedata"));
      const images = pictures.map(picture => {
        const image = document.createElement("img");
        image.setAttribute("src", picture.getAttribute("src") || "");
        image.alt = picture.getAttribute("o:title") || "";
        return image;
      });
      if (images.length) comment.replaceWith(...images);
    }
  }
  // Convert Word's legacy VML picture nodes when a normal image fallback is absent.
  for (const picture of Array.from(body.getElementsByTagName("v:imagedata"))) {
    const shape = picture.parentElement;
    if (shape?.querySelector("img")) { picture.remove(); continue; }
    const image = document.createElement("img");
    image.src = picture.getAttribute("src") || "";
    image.alt = picture.getAttribute("o:title") || "";
    if (shape?.tagName.toLowerCase() === "v:shape") shape.replaceWith(image);
    else picture.replaceWith(image);
  }
  const images = Array.from(body.querySelectorAll("img"));
  const files = data.files.filter(file => file.type.startsWith("image/"));
  const local = images.filter(image => !/^(?:https?:\/\/|\/[^/]|data:)/i.test(image.getAttribute("src") || ""));
  const wordFiles = local.length || !images.length ? rtfImages(data.rtf) : [];
  const localSources = new Set(local.map(image => image.getAttribute("src") || ""));
  const available = wordFiles.length >= localSources.size && wordFiles.length ? wordFiles : files;
  const uploads: ClipboardImage[] = [];
  const mapped = new Map<string, ClipboardImage>();
  let missing = false;
  let invalid = false;
  const handled = normalizedLists || images.length > 0 || files.length > 0 || wordFiles.length > 0;
  let nextFile = 0;
  for (const image of images) {
    const source = image.getAttribute("src") || "";
    // Remote and same-site pictures can be kept as ordinary image links.
    if (/^(?:https?:\/\/|\/[^/])/i.test(source)) continue;
    const previous = mapped.get(source);
    if (previous) { previous.elements.push(image); continue; }
    const file = /^data:/i.test(source) ? embeddedImage(source) : available[nextFile++];
    if (!file) {
      image.remove();
      if (/^data:/i.test(source)) invalid = true;
      else missing = true;
      continue;
    }
    if (!validArticleImage(file)) { image.remove(); invalid = true; continue; }
    const upload = { file, elements: [image] };
    uploads.push(upload);
    mapped.set(source, upload);
  }
  if (!images.length) {
    // A directly copied picture may supply files/RTF without any HTML.
    if (!html && data.text) {
      const paragraph = document.createElement("p");
      paragraph.textContent = data.text;
      body.append(paragraph);
    }
    for (const file of available) {
      if (!validArticleImage(file)) { invalid = true; continue; }
      const image = document.createElement("img");
      image.alt = file.name;
      body.append(image);
      uploads.push({ file, elements: [image] });
    }
  }
  // Use standard paste when neither Word bullet normalization nor image uploads are needed.
  return { body, uploads, missing, invalid, handled };
}
