
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

async function debug() {
    console.log("--- DEBUGGING DATA (ALL USERS) ---");

    const { data: users, error: uError } = await supabase.from('usuarios').select('id, nombre, bolsa_horas_minutos');
    if (uError) { console.error("Error fetching users:", uError); return; }
    if (!users || users.length === 0) { console.log("No users."); return; }

    console.log(`Found ${users.length} users. Checking stats...`);

    for (const user of users) {
        const { count, error } = await supabase
            .from('jornadas')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', user.id);

        const { data: resumen } = await supabase.from('resumen_horas_extra').select('*').eq('usuario_id', user.id);
        const hasResumen = resumen && resumen.length > 0;
        const resumenData = hasResumen ? JSON.stringify(resumen[0].acumulado_hhmm) : "NONE";

        console.log(`User: ${user.nombre || 'Unknown'} | Jornadas: ${count} | Bag: ${user.bolsa_horas_minutos} | Resumen: ${hasResumen ? 'YES' : 'NO'} (${resumenData})`);

        if (count > 0 && !hasResumen) {
            console.log("  !!! WARNING: User has Jornadas but NO Resumen. Migration needed.");
        }
    }
}

debug();
