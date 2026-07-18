import { clearSessionCookie } from "../../../lib/session.js";

export const prerender = false;

export async function POST({ cookies }) {
  clearSessionCookie(cookies);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
