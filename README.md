<div align="center">


**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Create WordPress drafts

WordPress draft creation uses the WordPress REST API from a small Node server so your WordPress credentials are never exposed in browser code. Access to the app is protected by WordPress OAuth login.

## WordPress OAuth login

WordPress does not include OAuth provider support by default. Install and configure a WordPress OAuth/OIDC provider plugin first, then create an OAuth client for this app.

Use this callback/redirect URL for the OAuth client:

```bash
http://localhost:8787/api/auth/callback
```

For production, replace the host with your deployed app URL:

```bash
https://your-app-domain.com/api/auth/callback
```

Add these OAuth values to your environment or `.env.local` file:

```bash
APP_SESSION_SECRET=use-a-long-random-secret-here
WP_OAUTH_AUTHORIZE_URL=https://your-wordpress-site.com/oauth/authorize
WP_OAUTH_TOKEN_URL=https://your-wordpress-site.com/oauth/token
WP_OAUTH_USERINFO_URL=https://your-wordpress-site.com/oauth/userinfo
WP_OAUTH_CLIENT_ID=your-oauth-client-id
WP_OAUTH_CLIENT_SECRET=your-oauth-client-secret
WP_OAUTH_REDIRECT_URI=http://localhost:8787/api/auth/callback
WP_OAUTH_SCOPE=openid profile email
WP_OAUTH_ALLOWED_ROLES=administrator,editor,author
```

The exact authorize, token, and userinfo URLs depend on the WordPress OAuth provider plugin you install. If your plugin uses different paths, put those exact URLs in the variables above.

`WP_OAUTH_ALLOWED_ROLES` is optional. Leave it blank to allow any WordPress user who can log in through OAuth. Set it to a comma-separated list to restrict access.

1. In WordPress, go to `Users > Profile > Application Passwords`.
2. Create a new application password for this app and copy it.
3. Add these values to your environment or `.env.local` file:

   ```bash
   WP_API_BASE_URL=https://your-wordpress-site.com
   WP_USERNAME=your-wordpress-username
   WP_APPLICATION_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
   WORDPRESS_DRAFT_SERVER_PORT=8787
   ```

4. For local development, run the draft API in one terminal:

   ```bash
   npm run draft-api
   ```

5. Run Vite in another terminal:

   ```bash
   npm run dev
   ```

After an article is generated, click `Create Draft`. The app will create a WordPress post with `status: draft`; you can then open it in WordPress, add the featured image, edit, and publish manually.

For production, build the app with `npm run build`, set the WordPress environment variables on the server, and run `npm start`. The Node server serves both the built app and `/api/wordpress/drafts`.
