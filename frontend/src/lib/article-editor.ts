import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { articleClipboard, readArticleClipboard, recoverClipboardImages, validArticleImage } from "./article-clipboard";
import type { ClipboardImage } from "./article-clipboard";
import { importArticleWord, MAX_WORD_BYTES } from "./article-word-import";

const labels = {
  az: { toolbar: "Mətn formatı", paragraph: "Paraqraf", heading: "Başlıq", size: "Mətn ölçüsü", normal: "Standart", bold: "Qalın", italic: "Kursiv", underline: "Altıxətli", strike: "Üstündən xətt", bullets: "İşarəli siyahı", numbers: "Nömrəli siyahı", quote: "Sitat", rule: "Ayırıcı xətt", undo: "Geri al", redo: "Təkrar et", clear: "Formatı təmizlə", image: "Şəkil əlavə et", table: "Cədvəl əlavə et", tableActions: "Cədvəl əməliyyatları", row: "Sətir əlavə et", column: "Sütun əlavə et", deleteRow: "Sətiri sil", deleteColumn: "Sütunu sil", deleteTable: "Cədvəli sil", merge: "Xanaları birləşdir", split: "Xananı ayır", header: "Başlıq sətri", alignment: "Düzülüş", left: "Sola", center: "Mərkəzə", right: "Sağa", justify: "Hər iki tərəfə", uploading: "Şəkil yüklənir…", uploadError: "Şəkli yükləmək mümkün olmadı. Yenidən cəhd edin.", imageInvalid: "JPEG, PNG və ya WebP seçin, maksimum 25 MB.", alt: "Şəklin təsviri", choose: "Şəkil seçin", insert: "Əlavə et", cancel: "Ləğv et", link: "Link əlavə et", url: "Link ünvanı (https://)", linkInvalid: "Düzgün http, https və ya email linki daxil edin.", removeLink: "Linki sil" },
  en: { toolbar: "Text formatting", paragraph: "Paragraph", heading: "Heading", size: "Text size", normal: "Default", bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough", bullets: "Bullet list", numbers: "Numbered list", quote: "Quote", rule: "Horizontal rule", undo: "Undo", redo: "Redo", clear: "Clear formatting", image: "Add image", table: "Insert table", tableActions: "Table actions", row: "Add row", column: "Add column", deleteRow: "Delete row", deleteColumn: "Delete column", deleteTable: "Delete table", merge: "Merge cells", split: "Split cell", header: "Header row", alignment: "Alignment", left: "Left", center: "Center", right: "Right", justify: "Justify", uploading: "Uploading image…", uploadError: "Could not upload the image. Please try again.", imageInvalid: "Choose JPEG, PNG or WebP, up to 25 MB.", alt: "Image description", choose: "Choose image", insert: "Insert", cancel: "Cancel", link: "Add link", url: "Link address (https://)", linkInvalid: "Enter a valid http, https or email link.", removeLink: "Remove link" },
  ru: { toolbar: "Форматирование", paragraph: "Абзац", heading: "Заголовок", size: "Размер текста", normal: "Стандартный", bold: "Жирный", italic: "Курсив", underline: "Подчёркнутый", strike: "Зачёркнутый", bullets: "Маркированный список", numbers: "Нумерованный список", quote: "Цитата", rule: "Разделитель", undo: "Отменить", redo: "Повторить", clear: "Очистить формат", image: "Добавить изображение", table: "Добавить таблицу", tableActions: "Действия с таблицей", row: "Добавить строку", column: "Добавить столбец", deleteRow: "Удалить строку", deleteColumn: "Удалить столбец", deleteTable: "Удалить таблицу", merge: "Объединить ячейки", split: "Разделить ячейку", header: "Строка заголовка", alignment: "Выравнивание", left: "Слева", center: "По центру", right: "Справа", justify: "По ширине", uploading: "Загрузка изображения…", uploadError: "Не удалось загрузить изображение. Попробуйте ещё раз.", imageInvalid: "Выберите JPEG, PNG или WebP, до 25 МБ.", alt: "Описание изображения", choose: "Выберите изображение", insert: "Добавить", cancel: "Отмена", link: "Добавить ссылку", url: "Адрес ссылки (https://)", linkInvalid: "Введите корректную http, https или email ссылку.", removeLink: "Удалить ссылку" },
};

const pasteHints = {
  az: "Brauzer Word-dəki bəzi şəkilləri ötürmədi. «Word faylından əlavə et» ilə .docx faylını seçərək mətn və şəkilləri birlikdə gətirin, yaxud şəkli ayrıca kopyalayıb yapışdırın.",
  en: "The browser did not provide some Word images. Use “Import Word file” to bring in the text and images from a .docx file, or copy and paste each image separately.",
  ru: "Браузер не передал некоторые изображения Word. Используйте «Импорт из Word», чтобы добавить текст и изображения из файла .docx, или скопируйте каждое изображение отдельно.",
};

const wordLabels = {
  az: { title: "Word faylından əlavə et", choose: "Word faylı (.docx), maksimum 50 MB", hint: "Faylın bütün mətni və şəkilləri kursorun olduğu yerə əlavə ediləcək. Eyni mətni artıq yapışdırmısınızsa, təkrarlanmaması üçün əvvəlcə onu silin.", invalid: "Maksimum 50 MB ölçüdə .docx faylı seçin. Köhnə .doc faylını Word-də .docx kimi saxlayın.", reading: "Word məzmunu oxunur…", clipboard: "Clipboard-dan şəkil alınır…", error: "Word faylını oxumaq mümkün olmadı. Faylı .docx formatında saxlayıb yenidən seçin.", warning: "Bəzi Word formatları çevrilmədi. Mətnin görünüşünü redaktorda yoxlayın." },
  en: { title: "Import Word file", choose: "Word file (.docx), up to 50 MB", hint: "The entire document and its images will be inserted at the cursor. If you already pasted the same text, remove it first to avoid duplicates.", invalid: "Choose a .docx file up to 50 MB. Save older .doc files as .docx in Word.", reading: "Reading Word document…", clipboard: "Reading clipboard image…", error: "Could not read the Word file. Save it as .docx and select it again.", warning: "Some Word formatting could not be converted. Review the text in the editor." },
  ru: { title: "Импорт из Word", choose: "Файл Word (.docx), до 50 МБ", hint: "Весь документ и изображения будут добавлены в позиции курсора. Если этот текст уже вставлен, сначала удалите его, чтобы избежать повторов.", invalid: "Выберите файл .docx до 50 МБ. Старый файл .doc сохраните в Word как .docx.", reading: "Чтение документа Word…", clipboard: "Получение изображения из буфера…", error: "Не удалось прочитать файл Word. Сохраните его как .docx и выберите снова.", warning: "Некоторое форматирование Word не удалось перенести. Проверьте текст в редакторе." },
};

type PreparedImages = { container: HTMLElement; images: ClipboardImage[]; messages: string[] };

export type ArticleEditorOptions = {
  value: string; locale?: string; id: string; labelledBy?: string;
  onChange: (html: string) => void; uploadImage: (file: File) => Promise<string>;
  onUploading?: (busy: boolean) => void;
};

export function createArticleEditor(host: HTMLElement, options: ArticleEditorOptions) {
  const t = labels[options.locale?.split("-")[0] as keyof typeof labels] || labels.az;
  const word = wordLabels[options.locale?.split("-")[0] as keyof typeof wordLabels] || wordLabels.az;
  host.classList.add("article-editor");
  const toolbar = document.createElement("div");
  toolbar.className = "article-editor-toolbar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", t.toolbar);
  const body = document.createElement("div");
  body.className = "article-content article-editor-body";
  const status = document.createElement("p");
  status.className = "article-editor-status";
  status.setAttribute("role", "status");
  host.append(toolbar, body, status);
  let disposed = false;
  let uploading = false;
  let editable = true;
  const controls: HTMLButtonElement[] = [];
  const states: Array<() => void> = [];
  const editor = new Editor({
    element: body,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Image, TextStyle, FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: false } })],
    content: options.value || "<p></p>",
    editorProps: {
      attributes: { id: options.id, role: "textbox", "aria-multiline": "true", "aria-required": "true", ...(options.labelledBy ? { "aria-labelledby": options.labelledBy } : {}) },
      handlePaste: (_view, event) => {
        if (!editor.isEditable || uploading || !event.clipboardData) return false;
        const data = readArticleClipboard(event.clipboardData);
        const pasted = articleClipboard(data);
        if (!pasted.handled) return false;
        const messages = clipboardMessages(pasted);
        if (pasted.missing && !pasted.uploads.length && typeof navigator.clipboard?.read === "function" && window.isSecureContext) {
          void insertImages(pasted.body, [], messages, async () => {
            const recovered = articleClipboard(await recoverClipboardImages(data));
            return { container: recovered.body, images: recovered.uploads, messages: clipboardMessages(recovered) };
          }, word.clipboard);
        } else void insertImages(pasted.body, pasted.uploads, messages);
        return true;
      },
    },
    onUpdate: ({ editor }) => options.onChange(editor.isEmpty ? "" : editor.getHTML()),
    onTransaction: () => states.forEach(update => update()),
  });

  function clipboardMessages(pasted: ReturnType<typeof articleClipboard>) {
    const messages: string[] = [];
    if (pasted.missing) messages.push(pasteHints[options.locale?.split("-")[0] as keyof typeof pasteHints] || pasteHints.az);
    if (pasted.invalid) messages.push(t.imageInvalid);
    return messages;
  }

  function button(text: string, title: string, action: () => void, active?: () => boolean) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", action);
    if (active) states.push(() => button.setAttribute("aria-pressed", String(active())));
    toolbar.append(button);
    controls.push(button);
    return button;
  }
  function select(title: string, choices: [string, string][], action: (value: string) => void) {
    const select = document.createElement("select");
    select.title = title;
    select.setAttribute("aria-label", title);
    for (const [value, label] of choices) select.add(new Option(label, value));
    select.addEventListener("change", () => action(select.value));
    toolbar.append(select);
    return select;
  }
  const block = select(t.paragraph, [["p", t.paragraph], ...([1, 2, 3, 4, 5, 6] as const).map(level => [`h${level}`, `${t.heading} ${level}`] as [string, string])], value => {
    if (value === "p") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  });
  const size = select(t.size, [["", t.normal], ...[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72].map(size => [`${size}px`, `${size} px`] as [string, string])], value => {
    const chain = editor.chain().focus();
    if (value) chain.setFontSize(value).run(); else chain.unsetFontSize().run();
  });
  button("B", t.bold, () => editor.chain().focus().toggleBold().run(), () => editor.isActive("bold"));
  button("I", t.italic, () => editor.chain().focus().toggleItalic().run(), () => editor.isActive("italic"));
  button("U", t.underline, () => editor.chain().focus().toggleUnderline().run(), () => editor.isActive("underline"));
  button("S", t.strike, () => editor.chain().focus().toggleStrike().run(), () => editor.isActive("strike"));
  button("• ≡", t.bullets, () => editor.chain().focus().toggleBulletList().run(), () => editor.isActive("bulletList"));
  button("1. ≡", t.numbers, () => editor.chain().focus().toggleOrderedList().run(), () => editor.isActive("orderedList"));
  select(t.alignment, [["left", t.left], ["center", t.center], ["right", t.right], ["justify", t.justify]], value => editor.chain().focus().setTextAlign(value).run());
  button("❝", t.quote, () => editor.chain().focus().toggleBlockquote().run(), () => editor.isActive("blockquote"));
  button("―", t.rule, () => editor.chain().focus().setHorizontalRule().run());
  button("↶", t.undo, () => editor.chain().focus().undo().run());
  button("↷", t.redo, () => editor.chain().focus().redo().run());
  button("Tx", t.clear, () => editor.chain().focus().unsetAllMarks().clearNodes().run());
  button(t.table, t.table, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
  const table = select(t.tableActions, [["", t.tableActions], ["row", t.row], ["column", t.column], ["deleteRow", t.deleteRow], ["deleteColumn", t.deleteColumn], ["merge", t.merge], ["split", t.split], ["header", t.header], ["deleteTable", t.deleteTable]], value => {
    const chain = editor.chain().focus();
    switch (value) {
      case "row": chain.addRowAfter().run(); break;
      case "column": chain.addColumnAfter().run(); break;
      case "deleteRow": chain.deleteRow().run(); break;
      case "deleteColumn": chain.deleteColumn().run(); break;
      case "deleteTable": chain.deleteTable().run(); break;
      case "merge": chain.mergeCells().run(); break;
      case "split": chain.splitCell().run(); break;
      case "header": chain.toggleHeaderRow().run(); break;
    }
    table.value = "";
  });
  states.push(() => {
    block.value = [1, 2, 3, 4, 5, 6].map(level => editor.isActive("heading", { level }) ? `h${level}` : "").find(Boolean) || "p";
    size.value = editor.getAttributes("textStyle").fontSize || "";
    table.disabled = !editor.isActive("table") || !editor.isEditable || uploading;
  });

  function dialog(title: string) {
    const dialog = document.createElement("dialog");
    dialog.className = "article-editor-dialog";
    const heading = document.createElement("h3");
    heading.textContent = title;
    dialog.append(heading);
    dialog.setAttribute("aria-label", title);
    host.append(dialog);
    return dialog;
  }
  function input(dialog: HTMLDialogElement, title: string, type: string) {
    const label = document.createElement("label");
    label.textContent = title;
    const input = document.createElement("input");
    input.type = type;
    label.append(input);
    dialog.append(label);
    return input;
  }
  function actions(dialog: HTMLDialogElement, submit: () => void) {
    const row = document.createElement("div");
    row.className = "article-editor-dialog-actions";
    for (const [text, action] of [[t.cancel, () => dialog.close()], [t.insert, submit]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", action);
      row.append(button);
    }
    dialog.append(row);
  }
  const imageDialog = dialog(t.image);
  const imageInput = input(imageDialog, t.choose, "file");
  imageInput.accept = "image/jpeg,image/png,image/webp";
  const altInput = input(imageDialog, t.alt, "text");
  altInput.maxLength = 300;
  const imageError = document.createElement("p");
  imageError.setAttribute("role", "alert");
  imageDialog.append(imageError);
  actions(imageDialog, () => {
    const file = imageInput.files?.[0];
    if (!file || !validArticleImage(file)) { imageError.textContent = t.imageInvalid; return; }
    imageDialog.close();
    const container = document.createElement("div");
    const image = document.createElement("img");
    image.alt = altInput.value || file.name;
    container.append(image);
    void insertImages(container, [{ file, elements: [image] }]);
  });
  button(t.image, t.image, () => { imageError.textContent = ""; imageInput.value = ""; altInput.value = ""; imageDialog.showModal(); });
  const wordDialog = dialog(word.title);
  const wordHint = document.createElement("p");
  wordHint.className = "article-editor-dialog-hint";
  wordHint.textContent = word.hint;
  wordDialog.append(wordHint);
  const wordInput = input(wordDialog, word.choose, "file");
  wordInput.accept = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const wordError = document.createElement("p");
  wordError.setAttribute("role", "alert");
  wordDialog.append(wordError);
  actions(wordDialog, () => {
    const file = wordInput.files?.[0];
    if (!file || !/\.docx$/i.test(file.name) || file.size > MAX_WORD_BYTES || file.size < 22) { wordError.textContent = word.invalid; return; }
    wordDialog.close();
    void insertImages(document.createElement("div"), [], [], async () => {
      const imported = await importArticleWord(file);
      const messages = [];
      if (imported.invalidImages) messages.push(t.imageInvalid);
      if (imported.warnings) messages.push(word.warning);
      return { ...imported, messages };
    }, word.reading, word.error);
  });
  button(word.title, word.title, () => { wordError.textContent = ""; wordInput.value = ""; wordDialog.showModal(); });
  const linkDialog = dialog(t.link);
  const linkInput = input(linkDialog, t.url, "url");
  const linkError = document.createElement("p");
  linkError.setAttribute("role", "alert");
  linkDialog.append(linkError);
  actions(linkDialog, () => {
    let url: URL;
    try { url = new URL(linkInput.value.trim()); } catch { linkError.textContent = t.linkInvalid; return; }
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) { linkError.textContent = t.linkInvalid; return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.href }).run();
    linkDialog.close();
  });
  button("↗", t.link, () => { linkError.textContent = ""; linkInput.value = editor.getAttributes("link").href || ""; linkDialog.showModal(); }, () => editor.isActive("link"));
  button("↗×", t.removeLink, () => editor.chain().focus().unsetLink().run());

  function updateDisabled() {
    controls.forEach(control => { control.disabled = !editor.isEditable || uploading; });
    toolbar.querySelectorAll("select").forEach(control => { control.disabled = !editor.isEditable || uploading; });
    states.forEach(update => update());
  }
  async function insertImages(container: HTMLElement, images: ClipboardImage[], messages: string[] = [], prepare?: () => Promise<PreparedImages>, preparing = t.uploading, failureMessage = t.uploadError) {
    if (uploading || !editor.isEditable) return;
    const selection = { from: editor.state.selection.from, to: editor.state.selection.to };
    if (images.length || prepare) {
      uploading = true;
      editor.setEditable(false);
      editor.view.dom.setAttribute("aria-busy", "true");
      options.onUploading?.(true);
      updateDisabled();
      status.textContent = preparing;
    }
    try {
      if (prepare) ({ container, images, messages } = await prepare());
      let failed = false;
      for (let index = 0; index < images.length; index++) {
        if (disposed) return;
        status.textContent = `${t.uploading} (${index + 1}/${images.length})`;
        const { file, elements } = images[index];
        try {
          const url = await options.uploadImage(file);
          elements.forEach(image => {
            image.setAttribute("src", url);
            image.removeAttribute("srcset");
            image.removeAttribute("sizes");
          });
        } catch {
          elements.forEach(image => image.remove());
          failed = true;
        }
      }
      if (!disposed) {
        // Insert text and its uploaded pictures together, keeping their document order.
        if (container.innerHTML) editor.commands.insertContentAt(selection, container.innerHTML);
        if (failed) messages.push(t.uploadError);
        status.textContent = messages.join(" ");
      }
    } catch {
      if (!disposed) status.textContent = failureMessage;
    } finally {
      uploading = false;
      if (!disposed) {
        editor.setEditable(editable);
        editor.view.dom.removeAttribute("aria-busy");
        options.onUploading?.(false);
        updateDisabled();
      }
    }
  }
  updateDisabled();
  return {
    editor,
    setEditable(value: boolean) { editable = value; editor.setEditable(value && !uploading); updateDisabled(); },
    setInvalid(value: boolean, describedBy?: string) {
      editor.view.dom.setAttribute("aria-invalid", String(value));
      host.dataset.invalid = String(value);
      if (describedBy) editor.view.dom.setAttribute("aria-describedby", describedBy);
      else editor.view.dom.removeAttribute("aria-describedby");
    },
    destroy() { disposed = true; editor.destroy(); host.replaceChildren(); },
  };
}
