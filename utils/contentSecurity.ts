import DOMPurify from "dompurify";

const ARTICLE_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "br",
];

export const toSafeExternalUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

export const sanitizeGeneratedHtml = (rawHtml: string): string => {
  const sanitized = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ARTICLE_TAGS,
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ["svg", "math", "iframe", "object", "embed", "form", "input", "button"],
  });

  const template = document.createElement("template");
  template.innerHTML = sanitized;
  template.content.querySelectorAll("a").forEach((anchor) => {
    const safeUrl = toSafeExternalUrl(anchor.getAttribute("href") || "");
    if (!safeUrl) {
      anchor.removeAttribute("href");
      return;
    }
    anchor.setAttribute("href", safeUrl);
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
  return template.innerHTML.trim();
};
