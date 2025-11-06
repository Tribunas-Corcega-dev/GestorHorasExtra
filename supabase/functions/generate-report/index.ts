// supabase/functions/generate-report/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles").select("role, area, full_name").eq("id", user.id).single();
    if (profileErr) return json({ error: profileErr.message }, 400);

    if (!['boss','hr','coordinator'].includes(profile.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const { startDate, endDate, userId, area } = await req.json();

    let query = supabase.from("shifts")
      .select("id, user_id, work_date, total_minutes")
      .gte("work_date", startDate)
      .lte("work_date", endDate);

    if (profile.role === "coordinator") {
      const { data: usersInArea } = await supabase.from("profiles").select("id").eq("area", profile.area);
      const ids = (usersInArea ?? []).map(r => r.id);
      query = query.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }

    if (userId) query = query.eq("user_id", userId);
    if (area && profile.role !== "coordinator") {
      const { data: usersInArea } = await supabase.from("profiles").select("id").eq("area", area);
      const ids = (usersInArea ?? []).map(r => r.id);
      query = query.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 400);

    return json({
      ok: true,
      report: {
        range: { startDate, endDate },
        count: rows?.length ?? 0,
        items: rows ?? [],
        report_url: null
      }
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
