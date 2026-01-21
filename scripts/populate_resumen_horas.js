
const fs = require('fs');
const path = require('path');

function getEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                env[key] = value;
            }
        });
        return env;
    } catch (e) {
        return process.env;
    }
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const { createClient } = require('@supabase/supabase-js');

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    console.log("Starting migration to 'resumen_horas_extra'...");

    // 1. Fetch all jornadas
    const { data: jornadas, error: fetchError } = await supabase
        .from('jornadas')
        .select('empleado_id, horas_extra_hhmm, desglose_compensacion');

    if (fetchError) {
        console.error("Error fetching jornadas:", fetchError);
        return;
    }

    console.log(`Fetched ${jornadas.length} jornadas.`);

    // 2. Aggregate totals per user
    const userTotals = {};

    jornadas.forEach(j => {
        const eid = j.empleado_id;
        if (!userTotals[eid]) {
            userTotals[eid] = {};
        }

        // Extract breakdown
        const breakdown = j.horas_extra_hhmm?.breakdown ||
            j.horas_extra_hhmm?.flatBreakdown ||
            j.horas_extra_hhmm?.breakdown_legacy ||
            j.horas_extra_hhmm || // fallback for very old format if simple object
            {};

        // Extract what has already been banked/compensated
        // If desglose_compensacion is null, assume 0 banked.
        const banked = j.desglose_compensacion || {};

        // Helper to get minutes from nested or flat structure
        const getMinutes = (type) => {
            let total = 0;
            if (breakdown.overtime && breakdown.overtime[type]) total += breakdown.overtime[type];
            else if (breakdown.surcharges && breakdown.surcharges[type]) total += breakdown.surcharges[type];
            else if (breakdown[type]) total += breakdown[type];
            return total;
        };

        // Calculate Net (Total - Banked) for known types
        const types = [
            "extra_diurna", "extra_nocturna", "extra_diurna_festivo", "extra_nocturna_festivo",
            "recargo_nocturno", "dominical_festivo", "recargo_nocturno_festivo"
        ];

        types.forEach(type => {
            const totalLine = getMinutes(type);
            const bankedLine = banked[type] || 0;
            const net = Math.max(0, totalLine - bankedLine);

            userTotals[eid][type] = (userTotals[eid][type] || 0) + net;
        });
    });

    console.log(`Calculated totals for ${Object.keys(userTotals).length} users.`);

    // 3. Upsert into resumen_horas_extra
    for (const [userId, totals] of Object.entries(userTotals)) {
        console.log(`Updating user ${userId}:`, totals);

        const { error: upsertError } = await supabase
            .from('resumen_horas_extra')
            .upsert({
                usuario_id: userId,
                acumulado_hhmm: totals,
                updated_at: new Date()
            });

        if (upsertError) {
            console.error(`Error updating user ${userId}:`, upsertError);
        }
    }

    console.log("Migration complete.");
}

migrateData();
