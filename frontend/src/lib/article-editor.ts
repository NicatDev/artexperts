import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";

const labels = {
  az: { toolbar: "Mətn formatı", paragraph: "Paraqraf", heading: "Başlıq", size: "Mətn ölçüsü", normal: "Standart", bold: "Qalın", italic: "Kursiv", underline: "Altıxətli", strike: "Üstündən xətt", bullets: "İşarəli siyahı", numbers: "Nömrəli siyahı", quote: "Sitat", rule: "Ayırıcı xətt", undo: "Geri al", redo: "Təkrar et", clear: "Formatı təmizlə", image: "Şəkil əlavə et", table: "Cədvəl əlavə et", tableActions: "Cədvəl əməliyyatları", row: "Sətir əlavə et", column: "Sütun əlavə et", deleteRow: "Sətiri sil", deleteColumn: "Sütunu sil", deleteTable: "Cədvəli sil", merge: "Xanaları birləşdir", split: "Xananı ayır", header: "Başlıq sətri", alignment: "Düzülüş", left: "Sola", center: "Mərkəzə", right: "Sağa", justify: "Hər iki tərəfə", uploading: "Şəkil yüklənir…", uploadError: "Şəkli yükləmək mümkün olmadı. Yenidən cəhd edin.", imageInvalid: "JPEG, PNG və ya WebP seçin, maksimum 25 MB.", alt: "Şəklin təsviri", choose: "Şəkil seçin", insert: "Əlavə et", cancel: "Ləğv et", link: "Link əlavə et", url: "Link ünvanı (https://)", linkInvalid: "Düzgün http, https və ya email linki daxil edin.", removeLink: "Linki sil" },
  en: { toolbar: "Text formatting", paragraph: "Paragraph", heading: "Heading", size: "Text size", normal: "Default", bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough", bullets: "Bullet list", numbers: "Numbered list", quote: "Quote", rule: "Horizontal rule", undo: "Undo", redo: "Redo", clear: "Clear formatting", image: "Add image", table: "Insert table", tableActions: "Table actions", row: "Add row", column: "Add column", deleteRow: "Delete row", deleteColumn: "Delete column", deleteTable: "Delete table", merge: "Merge cells", split: "Split cell", header: "Header row", alignment: "Alignment", left: "Left", center: "Center", right: "Right", justify: "Justify", uploading: "Uploading image…", uploadError: "Could not upload the image. Please try again.", imageInvalid: "Choose JPEG, PNG or WebP, up to 25 MB.", alt: "Image description", choose: "Choose image", insert: "Insert", cancel: "Cancel", link: "Add link", url: "Link address (https://)", linkInvalid: "Enter a valid http, https or email link.", removeLink: "Remove link" },
  ru: { toolbar: "Форматирование", paragraph: "Абзац", heading: "Заголовок", size: "Размер текста", normal: "Стандартный", bold: "Жирный", italic: "Курсив", underline: "Подчёркнутый", strike: "Зачёркнутый", bullets: "Маркированный список", numbers: "Нумерованный список", quote: "Цитата", rule: "Разделитель", undo: "Отменить", redo: "Повторить", clear: "Очистить формат", image: "Добавить изображение", table: "Добавить таблицу", tableActions: "Действия с таблицей", row: "Добавить строку", column: "Добавить столбец", deleteRow: "Удалить строку", deleteColumn: "Удалить столбец", deleteTable: "Удалить таблицу", merge: "Объединить ячейки", split: "Разделить ячейку", header: "Строка заголовка", alignment: "Выравнивание", left: "Слева", center: "По центру", right: "Справа", justify: "По ширине", uploading: "Загрузка изображения…", uploadError: "Не удалось загрузить изображение. Попробуйте ещё раз.", imageInvalid: "Выберите JPEG, PNG или WebP, до 25 МБ.", alt: "Описание изображения", choose: "Выберите изображение", insert: "Добавить", cancel: "Отмена", link: "Добавить ссылку", url: "Адрес ссылки (https://)", linkInvalid: "Введите корректную http, https или email ссылку.", removeLink: "Удалить ссылку" },
};

export type ArticleEditorOptions = {
  value: string; locale?: string; id: string; labelledBy?: string;
  onChange: (html: string) => void; uploadImage: (file: File) => Promise<string>;
  onUploading?: (busy: boolean) => void;
};

export function createArticleEditor(host: HTMLElement, options: ArticleEditorOptions) {
  const t = labels[options.locale?.split("-")[0] as keyof typeof labels] || labels.az;
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
  const controls: HTMLButtonElement[] = [];
  const states: Array<() => void> = [];
  const editor = new Editor({
    element: body,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Image, TextStyle, FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: false } })],
    content: options.value || "<p></p>",
    editorProps: { attributes: { id: options.id, role: "textbox", "aria-multiline": "true", "aria-required": "true", ...(options.labelledBy ? { "aria-labelledby": options.labelledBy } : {}) } },
    onUpdate: ({ editor }) => options.onChange(editor.isEmpty ? "" : editor.getHTML()),
    onTransaction: () => states.forEach(update => update()),
  });

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
    if (!file || file.size > 25 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { imageError.textContent = t.imageInvalid; return; }
    imageDialog.close();
    void upload(file, altInput.value || file.name);
  });
  button(t.image, t.image, () => { imageError.textContent = ""; imageInput.value = ""; altInput.value = ""; imageDialog.showModal(); });
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
  async function upload(file: File, alt: string) {
    if (uploading || !editor.isEditable) return;
    uploading = true;
    options.onUploading?.(true);
    updateDisabled();
    status.textContent = t.uploading;
    try {
      const url = await options.uploadImage(file);
      if (!disposed) { editor.chain().focus().setImage({ src: url, alt }).run(); status.textContent = ""; }
    } catch {
      if (!disposed) status.textContent = t.uploadError;
    } finally {
      uploading = false;
      if (!disposed) { options.onUploading?.(false); updateDisabled(); }
    }
  }
  updateDisabled();
  return {
    editor,
    setEditable(value: boolean) { editor.setEditable(value); updateDisabled(); },
    setInvalid(value: boolean, describedBy?: string) {
      editor.view.dom.setAttribute("aria-invalid", String(value));
      host.dataset.invalid = String(value);
      if (describedBy) editor.view.dom.setAttribute("aria-describedby", describedBy);
      else editor.view.dom.removeAttribute("aria-describedby");
    },
    destroy() { disposed = true; editor.destroy(); host.replaceChildren(); },
  };
}
