import { verifyToken } from "@clerk/backend";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadEnvFile = (fileName) => {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
};

loadEnvFile(".env");
loadEnvFile(".env.local");

const port = Number(process.env.LOCAL_DRAFT_API_PORT ?? 3000);

const stripTrailingSlash = (value) => value.replace(/\/+$/g, "");

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const parseAllowedParties = () => {
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

const jsonResponse = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  response.end(JSON.stringify(payload));
};

const readRequestBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const verifyClerkRequest = async (authorizationHeader) => {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing Clerk session token.");
  }

  return verifyToken(token, {
    secretKey: requireEnv("CLERK_SECRET_KEY"),
    authorizedParties: parseAllowedParties(),
  });
};

const createWordPressDraft = async ({ title, content, excerpt }) => {
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
  let payload = null;
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname !== "/api/wordpress/drafts") {
    jsonResponse(response, 404, { error: "Not found." });
    return;
  }

  if (request.method === "OPTIONS") {
    jsonResponse(response, 204, {});
    return;
  }

  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "Method not allowed." });
    return;
  }

  try {
    await verifyClerkRequest(request.headers.authorization);

    const body = JSON.parse(await readRequestBody(request));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const excerpt = typeof body?.excerpt === "string" ? body.excerpt.trim() : "";

    if (!title || !content) {
      jsonResponse(response, 400, { error: "A title and content are required." });
      return;
    }

    const draft = await createWordPressDraft({ title, content, excerpt });
    jsonResponse(response, 201, { draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create WordPress draft.";
    const statusCode = message.includes("Clerk") || message.includes("token") ? 401 : 500;
    jsonResponse(response, statusCode, { error: message });
  }
});

server.listen(port, () => {
  console.log(`Local draft API running at http://127.0.0.1:${port}/api/wordpress/drafts`);
});
