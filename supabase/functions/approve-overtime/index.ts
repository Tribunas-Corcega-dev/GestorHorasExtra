// supabase/functions/approve-overtime/index.ts
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
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileErr) return json({ error: profileErr.message }, 400);
    if (profile?.role !== "boss") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const overtimeId = Number(body?.overtimeId);
    if (!overtimeId) return json({ error: "Missing overtimeId" }, 400);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE")!
    );
    const approvedAt = new Date().toISOString();

    const { error: updErr } = await service
      .from("overtime")
      .update({ approved_by: user.id, approved_at: approvedAt })
      .eq("id", overtimeId);
    if (updErr) return json({ error: updErr.message }, 400);

    await service.from("audit_log").insert({
      actor: user.id,
      action: "approve_overtime",
      entity: "overtime",
      entity_id: String(overtimeId),
      payload: { approved_at: approvedAt },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
