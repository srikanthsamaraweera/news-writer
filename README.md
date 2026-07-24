<div align="center">

# Lankan.org News Writer

Generate current Sri Lankan news topics and articles with Gemini and optional Firebase-protected railway administration.

</div>

## Prerequisites

- Node.js 20 or newer
- A Gemini API key with access to `gemini-2.5-flash`
- Optional: a Firebase project when using Google sign-in and the protected railway area

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.

3. Add your Gemini API key:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```

   `GEMINI_API_KEY` is read only by the Express server. Do not rename it with a `VITE_` prefix, commit it to Git, or place it in client-side code.

4. To enable Firebase Google sign-in and the protected railway area, add:

   ```env
   FIREBASE_PROJECT_ID=your-project-id
   AUTHORIZED_EMAILS=you@example.com,another-admin@example.com

   VITE_FIREBASE_API_KEY=your_firebase_web_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

   Find the `VITE_FIREBASE_*` values under **Firebase Console → Project settings → Your apps → Web app**. Firebase web configuration is designed to be present in the browser; access control is enforced by the server using `FIREBASE_PROJECT_ID` and `AUTHORIZED_EMAILS`.

5. In **Firebase Console → Authentication**:

   - Enable the Google sign-in provider.
   - Add `localhost` and the production hostname under **Authorized domains**.

6. Start the Vite client and secure API server:

   ```bash
   npm run dev
   ```

## Public and administrator access

- Public visitors can generate topics, articles, and article optimizations without signing in.
- Anonymous requests are limited to 6 per minute and 50 per day per IP.
- Authorized accounts receive 12 requests per minute and 200 per day.
- The railway administration route requires a verified Google account listed in `AUTHORIZED_EMAILS`.

Firebase configuration can be omitted when the protected railway area is not needed.

## Production

Build the client and start the Express server:

```bash
npm run build
npm start
```

Deploy the Node/Express application—not only the generated `dist` directory. Express serves the frontend, verifies administrator logins, applies rate limits and security headers, and sends Gemini requests without exposing the Gemini key to browsers.

If the Node server is directly behind one trusted reverse proxy, configure:

```env
TRUST_PROXY_HOPS=1
```

Leave `TRUST_PROXY_HOPS=0` when Node is directly exposed. This setting ensures anonymous rate limits use the correct visitor IP.

## Verification and troubleshooting

Check TypeScript and create a production build:

```bash
npm run typecheck
npm run build
```

Test the configured Gemini key and default model:

```bash
npm run check:gemini
```

Test Google Search grounding:

```bash
npm run check:gemini -- --search
```

The diagnostic commands report Google response statuses without printing the API key.

## Security and billing notes

- Keep `.env.local` private. Environment files are ignored by Git.
- Rotate any Gemini key that was previously included in a browser build.
- For a public deployment, use Gemini Prepay with auto-reload disabled if you want the prepaid balance to act as a spending boundary.
- In-memory application rate limits reset when the server restarts. Use a shared Redis or database-backed limiter when running multiple server instances.
