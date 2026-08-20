import type { Request, Response } from "express";

let appPromise: ReturnType<typeof loadApp> | undefined;

const loadApp = async () => {
  const module = await import("../server/index");
  return module.default;
};

export default async function handler(request: Request, response: Response) {
  try {
    appPromise ??= loadApp();
    const app = await appPromise;
    app(request, response);
  } catch (error) {
    console.error("Vercel API initialization failed", error);
    if (!response.headersSent) {
      response.status(500).json({
        error: "The authorization service failed to start on Vercel. Check the Function logs.",
      });
    }
  }
}
