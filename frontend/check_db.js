const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const envPath = path.resolve('d:/projects/office/DSL E-com/frontend/.env');
let dbUrl = '';

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
            dbUrl = trimmed.substring('DATABASE_URL='.length).trim();
            if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
                dbUrl = dbUrl.slice(1, -1);
            }
            break;
        }
    }
}

try {
    const parsed = new URL(dbUrl);
    const env = {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || '5432',
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGDATABASE: parsed.pathname.replace(/^\//, ''),
    };
    const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
    const out = execFileSync(
        psqlPath,
        ['-c', 'SELECT current_database(), current_user, version(); SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = \'public\';'],
        { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    console.log('PostgreSQL Native Connection: SUCCESSFUL!');
    console.log(out.trim());
} catch (e) {
    console.error('PostgreSQL Native Connection: FAILED');
    const safeErr = (e.stderr || e.message || '').replace(/:[^:@]+@/, ':***@');
    console.error(safeErr);
}
