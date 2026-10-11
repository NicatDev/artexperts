import { createArticleEditor } from "../src/lib/article-editor";

function mount(root: ParentNode = document) {
  root.querySelectorAll<HTMLTextAreaElement>("textarea[data-article-editor]").forEach(source => {
    if (source.dataset.mounted || source.id.includes("__prefix__")) return;
    source.dataset.mounted = "true";
    const host = document.createElement("div");
    source.after(host);
    const label = document.querySelector<HTMLLabelElement>(`label[for="${source.id}"]`);
    if (label && !label.id) label.id = `${source.id}-label`;
    if (label) label.htmlFor = `${source.id}-rich`;
    const instance = createArticleEditor(host, {
      value: source.value, locale: source.dataset.locale, id: `${source.id}-rich`, labelledBy: label?.id,
      onChange: html => { source.value = html; source.dispatchEvent(new Event("change", { bubbles: true })); },
      onUploading: busy => {
        host.dataset.uploading = String(busy);
        source.form?.querySelectorAll<HTMLInputElement>('input[type="submit"]').forEach(button => {
          button.disabled = !!source.form?.querySelector('.article-editor[data-uploading="true"]');
        });
      },
      uploadImage: async file => {
        const form = new FormData();
        form.append("image", file);
        const csrf = source.form?.querySelector<HTMLInputElement>('input[name="csrfmiddlewaretoken"]')?.value || "";
        const response = await fetch(source.dataset.uploadUrl!, { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": csrf, Accept: "application/json" }, body: form });
        if (!response.ok) throw new Error("Upload failed");
        return (await response.json()).url;
      },
    });
    source.hidden = true;
    source.form?.addEventListener("submit", event => {
      if (source.form?.querySelector('.article-editor[data-uploading="true"]')) { event.preventDefault(); return; }
      source.value = instance.editor.isEmpty ? "" : instance.editor.getHTML();
    });
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mount());
else mount();
document.addEventListener("formset:added", event => mount(event.target as HTMLElement));
