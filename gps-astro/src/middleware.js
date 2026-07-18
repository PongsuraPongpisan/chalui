import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/session.js";

// Route -> required role. Traveler and landing page stay public (no auth).
const PROTECTED_ROUTES = {
  "/admin": "admin",
  "/contractor": "contractor",
};

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  const requiredRole = Object.entries(PROTECTED_ROUTES).find(([route]) =>
    pathname === route || pathname.startsWith(`${route}/`)
  )?.[1];

  if (!requiredRole) {
    return next();
  }

  const session = getSession(context.cookies);

  if (!session || session.role !== requiredRole) {
    const redirectTo = encodeURIComponent(pathname);
    return context.redirect(`/login?role=${requiredRole}&redirect=${redirectTo}`);
  }

  context.locals.user = session;
  return next();
});
