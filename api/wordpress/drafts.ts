import { verifyToken } from "@clerk/backend";

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/g, "");

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const parseAllowedParties = (): string[] | undefined => {
  const configured = process.env.CLERK_AUTHORIZED_PARTIES;
  if (!configured) {
    return undefined;
  }

  const parties = configured
    .split(",")
    .map((party) => party.trim())
    .filter(Boolean);

  return parties.length > 0 ? parties : undefined;
};

const verifyClerkRequest = async (authorizationHeader: string | undefined) => {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing Clerk session token.");
  }

  return verifyToken(token, {
    secretKey: requireEnv("CLERK_SECRET_KEY"),
    authorizedParties: parseAllowedParties(),
  });
};

const createWordPressDraft = async ({
  title,
  content,
  excerpt,
}: {
  title: string;
  content: string;
  excerpt: string;
}) => {
  const wordpressBaseUrl = requireEnv("WP_API_BASE_URL");
  const wordpressUsername = requireEnv("WP_USERNAME");
  const wordpressApplicationPassword = requireEnv("WP_APPLICATION_PASSWORD");
  const credentials = Buffer.from(
    `${wordpressUsername}:${wordpressApplicationPassword}`,
    "utf8"
  ).toString("base64");

  const wordpressResponse = await fetch(
    `${stripTrailingSlash(wordpressBaseUrl)}/wp-json/wp/v2/posts`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        content,
        excerpt,
        status: "draft",
      }),
    }
  );

  const responseText = await wordpressResponse.text();
  let payload: any = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = { message: responseText };
  }

  if (!wordpressResponse.ok) {
    throw new Error(payload?.message ?? `WordPress returned HTTP ${wordpressResponse.status}`);
  }

  return {
    id: payload?.id,
    link: payload?.link,
    editLink: payload?.id
      ? `${stripTrailingSlash(process.env.WP_ADMIN_BASE_URL ?? wordpressBaseUrl)}/wp-admin/post.php?post=${payload.id}&action=edit`
      : undefined,
    status: payload?.status,
  };
};

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    await verifyClerkRequest(request.headers.authorization);

    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const excerpt = typeof body?.excerpt === "string" ? body.excerpt.trim() : "";

    if (!title || !content) {
      response.status(400).json({ error: "A title and content are required." });
      return;
    }

    const draft = await createWordPressDraft({ title, content, excerpt });
    response.status(201).json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create WordPress draft.";
    const statusCode =
      message.includes("Clerk") || message.includes("token") ? 401 : 500;
    response.status(statusCode).json({ error: message });
  }
}
