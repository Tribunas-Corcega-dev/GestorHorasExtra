
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking 'usuarios' table for 'bolsa_horas_minutos'...");
    const { data: user, error: userError } = await supabase
        .from('usuarios')
        .select('bolsa_horas_minutos')
        .limit(1);

    if (userError) {
        console.error("Error checking 'usuarios':", userError.message);
    } else {
        console.log("✓ 'bolsa_horas_minutos' column likely exists (Query success).");
    }

    console.log("\nChecking 'jornadas' table for 'desglose_compensacion'...");
    const { data: jornada, error: jornadaError } = await supabase
        .from('jornadas')
        .select('desglose_compensacion')
        .limit(1);

    if (jornadaError) {
        console.error("Error checking 'jornadas':", jornadaError.message);
    } else {
        console.log("✓ 'desglose_compensacion' column likely exists (Query success).");
    }

    console.log("\nChecking 'historial_bolsa' table existence...");
    const { data: hist, error: histError } = await supabase
        .from('historial_bolsa')
        .select('id, minutos')
        .limit(1);

    if (histError) {
        console.error("Error checking 'historial_bolsa':", histError.message);
    } else {
        console.log("✓ 'historial_bolsa' table likely exists.");
    }
}

checkSchema();
