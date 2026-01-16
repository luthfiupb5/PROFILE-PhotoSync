import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
    console.log("Checking Supabase Tables...");
    try {
        const events = await sql`SELECT count(*) FROM events`;
        const users = await sql`SELECT count(*) FROM users`;
        const photos = await sql`SELECT count(*) FROM photos`;
        const vectors = await sql`SELECT count(*) FROM vectors`;

        console.log(`✅ Events: ${events[0].count}`);
        console.log(`✅ Users: ${users[0].count}`);
        console.log(`✅ Photos: ${photos[0].count}`);
        console.log(`✅ Vectors: ${vectors[0].count}`);
    } catch (e) {
        console.error("❌ Failed to query database:", e);
    } finally {
        await sql.end();
    }
}

main();
