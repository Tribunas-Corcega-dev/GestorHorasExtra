
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const cleanLine = line.split('#')[0].trim();
            if (!cleanLine) return;
            const match = cleanLine.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                env[key] = value;
            }
        });
        return env;
    } catch (e) {
        return process.env;
    }
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to find value case-insensitive and snake/title friendly
const getValueFuzzy = (obj, key) => {
    if (!obj) return 0
    if (obj[key]) return obj[key]

    // Try to match by converting DB keys to snake_code
    const normalizedKey = key.toLowerCase().replace(/ /g, '_')
    const foundKey = Object.keys(obj).find(k => k.toLowerCase().replace(/ /g, '_') === normalizedKey)
    return foundKey ? obj[foundKey] : 0
}

async function run() {
    console.log("STARTING FORCE POPULATION...");

    // 1. Get all jornadas
    const { data: jornadas, error } = await supabase.from('jornadas').select('*');
    if (error) { console.error(error); return; }

    console.log(`Loaded ${jornadas.length} jornadas.`);

    const userTotals = {};

    jornadas.forEach(j => {
        const uid = j.empleado_id;
        if (!userTotals[uid]) userTotals[uid] = {};

        // Flatten breakdown
        const h = j.horas_extra_hhmm || {};
        let flat = { ...h };
        if (h.breakdown) {
            if (h.breakdown.overtime) Object.assign(flat, h.breakdown.overtime);
            if (h.breakdown.surcharges) Object.assign(flat, h.breakdown.surcharges);
            Object.assign(flat, h.breakdown);
        }
        if (h.flatBreakdown) Object.assign(flat, h.flatBreakdown);
        if (h.breakdown_legacy) Object.assign(flat, h.breakdown_legacy);

        // Calculate Net
        const banked = j.desglose_compensacion || {};

        // Iterate all keys in flat
        Object.keys(flat).forEach(key => {
            const val = parseInt(flat[key] || 0);
            if (val > 0 && typeof val === 'number') {
                // Normalize key? assume flat keys are mostly correct or user specific
                // We keep the key as is
                const alreadyBanked = banked[key] || 0;
                const net = val - alreadyBanked;
                if (net > 0) {
                    userTotals[uid][key] = (userTotals[uid][key] || 0) + net;
                }
            }
        });
    });

    // Upsert
    for (const [uid, totals] of Object.entries(userTotals)) {
        console.log(`User ${uid}:`, totals);
        const { error: upError } = await supabase.from('resumen_horas_extra').upsert({
            usuario_id: uid,
            acumulado_hhmm: totals,
            updated_at: new Date()
        });
        if (upError) console.error("Update failed:", upError);
    }

    console.log("DONE.");
}

run();
