
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
            if (match) env[match[1].trim()] = match[2].trim();
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
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    // Try to select one row
    const { data, error } = await supabase.from('jornadas').select('*').limit(1);

    if (error) {
        console.error("Error fetching jornadas:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found in 'jornadas' table:");
        console.log(Object.keys(data[0]));
    } else {
        console.log("Table 'jornadas' is empty. Cannot infer columns easily via select *.");
        // Try creating a dummy record with only required fields to see if it fails? No, that's risky.
        // We will just assume if data is empty we can't check keys.
        // But usually there is data involved.
    }
}

checkColumns();
