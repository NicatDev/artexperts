import { ApiError } from "./api";

export type FieldErrors = Record<string, string>;
type Translate = (key: string) => string;

export function friendlyError(message: string, t: Translate): string {
  const rules: [RegExp, string][] = [
    [/already registered|email.*already|email.*exists/i, "emailTaken"],
    [/username.*taken|username.*exists|username.*unique/i, "usernameTaken"],
    [/similar|similarity/i, "passwordSimilar"],
    [/too common|commonly used/i, "passwordCommon"],
    [/entirely numeric/i, "passwordNumeric"],
    [/password.*short|at least 8|min.*8/i, "passwordShort"],
    [/email.*valid|valid.*email/i, "emailInvalid"],
    [/slug|lowercase|username can/i, "usernameInvalid"],
    [/invalid.*category|invalid pk|object does not exist|not a valid choice/i, "choiceInvalid"],
    [/throttled|wait.*60|before requesting another/i, "waitBeforeRetry"],
    [/could not be delivered|email.*could not|email.*not.*delivered/i, "emailDelivery"],
    [/blank|required|empty/i, "required"],
    [/positive price|price.*negative/i, "positivePrice"],
    [/valid image|invalid image|corrupt|not.*image|image.*format/i, "imageInvalid"],
    [/image dimensions.*exceed/i, "imageDimensions"],
    [/25 MB|too large|file size|maximum.*size/i, "fileSize"],
    [/PDF/i, "pdfInvalid"],
    [/duplicate contributor/i, "duplicateContributor"],
    [/confirm.*rights/i, "rights"],
    [/invalid.*code|incorrect.*code|expired.*code|code.*expired/i, "codeInvalid"],
    [/no more than|at most|max.*characters/i, "tooLong"],
    [/valid integer|whole number|greater than or equal|less than or equal/i, "numberInvalid"],
    [/valid number|decimal.*places|digits in total/i, "numberInvalid"],
  ];
  for (const [pattern, key] of rules) if (pattern.test(message)) return t(key);
  return message;
}

export function readFieldErrors(error: unknown, t: Translate): FieldErrors {
  const details = error instanceof ApiError ? error.details : error;
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const result: FieldErrors = {};
  for (const [key, value] of Object.entries(details)) {
    if (["error", "detail", "message", "status", "status_code", "non_field_errors"].includes(key)) continue;
    const messages = Array.isArray(value) ? value.flat(Infinity).map(String) : [String(value)];
    result[key] = [...new Set(messages.map(message => friendlyError(message, t)))].join(" ");
  }
  return result;
}

export function focusFirstError(form: HTMLFormElement | null, errors: FieldErrors) {
  requestAnimationFrame(() => {
    const input = Array.from(form?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[name]") || [])
      .find(element => (errors[element.name] || (element.name.startsWith("authors.") && errors.authors)) && !element.disabled);
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    }
  });
}
