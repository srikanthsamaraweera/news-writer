export interface CreateDraftParams {
  title: string;
  content: string;
  excerpt?: string;
  token: string;
}

export interface CreatedWordPressDraft {
  id?: number;
  link?: string;
  editLink?: string;
  status?: string;
}

const endpoint =
  import.meta.env.VITE_WORDPRESS_DRAFT_API_URL?.trim() || "/api/wordpress/drafts";

export const createWordPressDraft = async ({
  title,
  content,
  excerpt,
  token,
}: CreateDraftParams): Promise<CreatedWordPressDraft> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, content, excerpt }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Failed to create draft. HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload?.draft ?? {};
};
