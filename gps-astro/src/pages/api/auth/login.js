import bcrypt from "bcryptjs";
import { supabase } from "../../../lib/supabase.js";
import { setSessionCookie } from "../../../lib/session.js";

export const prerender = false;

export async function POST({ request, cookies }) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, 400);
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, username, password_hash, role, full_name")
      .eq("username", username)
      .single();

    // Same error message whether the user doesn't exist or password is wrong —
    // avoids leaking which usernames are valid.
    if (error || !user) {
      return json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
    }

    setSessionCookie(cookies, {
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
    });

    return json({ success: true, role: user.role });
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
