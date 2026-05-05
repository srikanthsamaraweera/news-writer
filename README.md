<div align="center">

**Prerequisites:** Node.js

</div>

## Local setup

1. Install dependencies:
   `npm install`
2. Set the app environment variables in `.env.local`.
3. Run the frontend:
   `npm run dev`

## Environment variables

The browser only receives the public Clerk key. Keep all WordPress and Clerk secret values in Vercel environment variables or `.env.local`.

```bash
GEMINI_API_KEY=your-gemini-api-key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_or_pk_live...

CLERK_SECRET_KEY=sk_test_or_sk_live...
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,https://your-vercel-domain.vercel.app,https://your-custom-domain.com

WP_API_BASE_URL=https://your-wordpress-site.com
WP_USERNAME=your-wordpress-username
WP_APPLICATION_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

`CLERK_AUTHORIZED_PARTIES` is optional but recommended. It should contain the allowed origins that can send Clerk tokens to your API.

## Clerk setup

1. Create a Clerk application at https://dashboard.clerk.com.
2. Copy the Publishable Key into `VITE_CLERK_PUBLISHABLE_KEY`.
3. Copy the Secret Key into `CLERK_SECRET_KEY`.
4. In production, add the same variables in your Vercel project settings.

The app uses Clerk to protect the UI and sends a Clerk session token to `/api/wordpress/drafts`. The Vercel API route verifies that token before creating a WordPress draft.

## WordPress draft setup

1. In WordPress, go to `Users > Profile > Application Passwords`.
2. Create a new application password for this app and copy it.
3. Set `WP_API_BASE_URL`, `WP_USERNAME`, and `WP_APPLICATION_PASSWORD`.

After an article is generated, click `Create Draft`. The app will create a WordPress post with `status: draft`; you can then open it in WordPress, add the featured image, edit, and publish manually.

## Vercel

This project uses Vercel serverless functions from the `api/` directory. For local testing of both the frontend and API together, use Vercel CLI:

```bash
npx vercel dev
```

For local testing without Vercel CLI, run the API and frontend in separate terminals:

```bash
npm run api-dev
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:3000` by default through `VITE_LOCAL_API_PROXY_TARGET`.
