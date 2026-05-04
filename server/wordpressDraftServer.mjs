import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");

const loadEnvFile = (fileName) => {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
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
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env");
loadEnvFile(".env.local");

const port = Number(process.env.WORDPRESS_DRAFT_SERVER_PORT ?? process.env.PORT ?? 8787);
const wordpressBaseUrl = process.env.WP_API_BASE_URL;
const wordpressUsername = process.env.WP_USERNAME;
const wordpressApplicationPassword = process.env.WP_APPLICATION_PASSWORD;
const oauthAuthorizeUrl = process.env.WP_OAUTH_AUTHORIZE_URL;
const oauthTokenUrl = process.env.WP_OAUTH_TOKEN_URL;
const oauthUserInfoUrl = process.env.WP_OAUTH_USERINFO_URL;
const oauthClientId = process.env.WP_OAUTH_CLIENT_ID;
const oauthClientSecret = process.env.WP_OAUTH_CLIENT_SECRET;
const oauthRedirectUri =
  process.env.WP_OAUTH_REDIRECT_URI ??
  `http://localhost:${port}/api/auth/callback`;
const sessionSecret = process.env.APP_SESSION_SECRET;
const sessionCookieName = "news_writer_session";
const stateCookieName = "news_writer_oauth_state";
const sessionMaxAgeSeconds = Number(process.env.APP_SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 8);
const cookieSecure = process.env.NODE_ENV === "production";

const jsonResponse = (response, statusCode, payload, headers = {}) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.WORDPRESS_DRAFT_ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    ...headers,
  });
  response.end(JSON.stringify(payload));
};

const redirectResponse = (response, location, headers = {}) => {
  response.writeHead(302, { Location: location, ...headers });
  response.end();
};

const readRequestBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const requireWordPressConfig = () => {
  const missing = [
    ["WP_API_BASE_URL", wordpressBaseUrl],
    ["WP_USERNAME", wordpressUsername],
    ["WP_APPLICATION_PASSWORD", wordpressApplicationPassword],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing WordPress configuration: ${missing.join(", ")}`);
  }
};

const stripTrailingSlash = (value) => value.replace(/\/+$/g, "");

const requireAuthConfig = () => {
  const missing = [
    ["APP_SESSION_SECRET", sessionSecret],
    ["WP_OAUTH_AUTHORIZE_URL", oauthAuthorizeUrl],
    ["WP_OAUTH_TOKEN_URL", oauthTokenUrl],
    ["WP_OAUTH_USERINFO_URL", oauthUserInfoUrl],
    ["WP_OAUTH_CLIENT_ID", oauthClientId],
    ["WP_OAUTH_CLIENT_SECRET", oauthClientSecret],
    ["WP_OAUTH_REDIRECT_URI", oauthRedirectUri],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing OAuth configuration: ${missing.join(", ")}`);
  }
};

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (value) => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
};

const signValue = (value) =>
  createHmac("sha256", sessionSecret).update(value).digest("base64url");

const createSignedCookieValue = (payload) => {
  if (!sessionSecret) {
    throw new Error("APP_SESSION_SECRET is required.");
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signValue(encodedPayload)}`;
};

const verifySignedCookieValue = (cookieValue) => {
  if (!sessionSecret || !cookieValue) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const parseCookies = (request) => {
  const header = request.headers.cookie ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) {
          return [cookie, ""];
        }
        return [
          decodeURIComponent(cookie.slice(0, separatorIndex)),
          decodeURIComponent(cookie.slice(separatorIndex + 1)),
        ];
      })
  );
};

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (cookieSecure) {
    parts.push("Secure");
  }
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  return parts.join("; ");
};

const getSession = (request) => {
  const cookies = parseCookies(request);
  return verifySignedCookieValue(cookies[sessionCookieName]);
};

const buildPublicUser = (session) =>
  session
    ? {
        id: session.id,
        name: session.name,
        email: session.email,
        roles: session.roles ?? [],
      }
    : null;

const fetchOAuthUser = async (accessToken) => {
  const userInfoResponse = await fetch(oauthUserInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const userInfoText = await userInfoResponse.text();
  let userInfo = null;
  try {
    userInfo = userInfoText ? JSON.parse(userInfoText) : null;
  } catch {
    userInfo = { message: userInfoText };
  }

  if (!userInfoResponse.ok) {
    throw new Error(userInfo?.message ?? "Unable to fetch WordPress OAuth user.");
  }

  return {
    id: userInfo.id ?? userInfo.ID ?? userInfo.sub ?? userInfo.user_id,
    name: userInfo.name ?? userInfo.display_name ?? userInfo.user_nicename ?? userInfo.login,
    email: userInfo.email ?? userInfo.user_email,
    roles: Array.isArray(userInfo.roles) ? userInfo.roles : [],
  };
};

const assertAllowedUser = (user) => {
  const allowedRoles = (process.env.WP_OAUTH_ALLOWED_ROLES ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (allowedRoles.length === 0) {
    return;
  }

  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  const hasAllowedRole = userRoles.some((role) => allowedRoles.includes(role));
  if (!hasAllowedRole) {
    throw new Error("Your WordPress account is not allowed to use this app.");
  }
};

const handleAuthLogin = (response) => {
  requireAuthConfig();

  const state = randomBytes(32).toString("base64url");
  const authorizationUrl = new URL(oauthAuthorizeUrl);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", oauthClientId);
  authorizationUrl.searchParams.set("redirect_uri", oauthRedirectUri);
  authorizationUrl.searchParams.set("scope", process.env.WP_OAUTH_SCOPE ?? "openid profile email");
  authorizationUrl.searchParams.set("state", state);

  const stateCookie = serializeCookie(
    stateCookieName,
    createSignedCookieValue({ state, expiresAt: Date.now() + 10 * 60 * 1000 }),
    { maxAge: 10 * 60 }
  );

  redirectResponse(response, authorizationUrl.toString(), { "Set-Cookie": stateCookie });
};

const handleAuthCallback = async (request, response, url) => {
  requireAuthConfig();

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateSession = verifySignedCookieValue(parseCookies(request)[stateCookieName]);
  const clearStateCookie = serializeCookie(stateCookieName, "", { maxAge: 0 });

  if (!code || !state || !stateSession || stateSession.state !== state) {
    redirectResponse(response, "/?auth=failed", { "Set-Cookie": clearStateCookie });
    return;
  }

  const tokenResponse = await fetch(oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthRedirectUri,
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
    }),
  });

  const tokenText = await tokenResponse.text();
  let tokenPayload = null;
  try {
    tokenPayload = tokenText ? JSON.parse(tokenText) : null;
  } catch {
    tokenPayload = { message: tokenText };
  }

  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(tokenPayload?.message ?? "WordPress OAuth token exchange failed.");
  }

  const user = await fetchOAuthUser(tokenPayload.access_token);
  assertAllowedUser(user);

  const sessionCookie = serializeCookie(
    sessionCookieName,
    createSignedCookieValue({
      ...user,
      expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
    }),
    { maxAge: sessionMaxAgeSeconds }
  );

  response.writeHead(302, {
    Location: "/",
    "Set-Cookie": [sessionCookie, clearStateCookie],
  });
  response.end();
};

const handleAuthLogout = (response) => {
  redirectResponse(response, "/", {
    "Set-Cookie": serializeCookie(sessionCookieName, "", { maxAge: 0 }),
  });
};

const createWordPressDraft = async ({ title, content, excerpt }) => {
  requireWordPressConfig();

  const credentials = Buffer.from(
    `${wordpressUsername}:${wordpressApplicationPassword}`,
    "utf8"
  ).toString("base64");

  const apiUrl = `${stripTrailingSlash(wordpressBaseUrl)}/wp-json/wp/v2/posts`;
  const wordpressResponse = await fetch(apiUrl, {
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
  });

  const responseText = await wordpressResponse.text();
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = { message: responseText };
  }

  if (!wordpressResponse.ok) {
    const message =
      payload?.message ?? `WordPress returned HTTP ${wordpressResponse.status}`;
    throw new Error(message);
  }

  return {
    id: payload?.id,
    link: payload?.link,
    editLink: payload?.id
      ? `${stripTrailingSlash(process.env.WP_ADMIN_BASE_URL ?? wordpressBaseUrl)}/wp-admin/post.php?post=${payload.id}&action=edit`
      : payload?._links?.["wp:action-edit"]?.[0]?.href,
    status: payload?.status,
  };
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const serveStaticFile = async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(
    distDir,
    normalizedPath === "/" ? "index.html" : normalizedPath.slice(1)
  );

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(file);
  } catch {
    try {
      const fallback = await readFile(join(distDir, "index.html"));
      response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
      response.end(fallback);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Build the app with `npm run build` before using this server.");
    }
  }
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname === "/api/auth/status") {
    if (request.method === "OPTIONS") {
      jsonResponse(response, 204, {});
      return;
    }

    if (request.method !== "GET") {
      jsonResponse(response, 405, { error: "Method not allowed." });
      return;
    }

    const session = getSession(request);
    jsonResponse(response, 200, {
      authenticated: Boolean(session),
      user: buildPublicUser(session),
    });
    return;
  }

  if (url.pathname === "/api/auth/login") {
    if (request.method !== "GET") {
      jsonResponse(response, 405, { error: "Method not allowed." });
      return;
    }

    try {
      handleAuthLogin(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start WordPress login.";
      jsonResponse(response, 500, { error: message });
    }
    return;
  }

  if (url.pathname === "/api/auth/callback") {
    if (request.method !== "GET") {
      jsonResponse(response, 405, { error: "Method not allowed." });
      return;
    }

    try {
      await handleAuthCallback(request, response, url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "WordPress login failed.";
      jsonResponse(response, 500, { error: message });
    }
    return;
  }

  if (url.pathname === "/api/auth/logout") {
    if (request.method !== "POST" && request.method !== "GET") {
      jsonResponse(response, 405, { error: "Method not allowed." });
      return;
    }

    handleAuthLogout(response);
    return;
  }

  if (url.pathname === "/api/wordpress/drafts") {
    if (request.method === "OPTIONS") {
      jsonResponse(response, 204, {});
      return;
    }

    if (request.method !== "POST") {
      jsonResponse(response, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const session = getSession(request);
      if (!session) {
        jsonResponse(response, 401, { error: "Please log in with WordPress first." });
        return;
      }

      const rawBody = await readRequestBody(request);
      const body = JSON.parse(rawBody);
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const content = typeof body.content === "string" ? body.content.trim() : "";
      const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";

      if (!title || !content) {
        jsonResponse(response, 400, { error: "A title and content are required." });
        return;
      }

      const draft = await createWordPressDraft({ title, content, excerpt });
      jsonResponse(response, 201, { draft });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create WordPress draft.";
      jsonResponse(response, 500, { error: message });
    }
    return;
  }

  await serveStaticFile(request, response);
});

server.listen(port, () => {
  console.log(`WordPress draft server running at http://localhost:${port}`);
});
