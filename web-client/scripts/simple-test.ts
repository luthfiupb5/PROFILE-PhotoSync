import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("Using DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");

const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    max: 1,
    prepare: false,
});

async function main() {
    try {
        console.log("\nTesting connection...");
        const result = await sql`SELECT NOW() as time, version() as version`;
        console.log("✅ SUCCESS!");
        console.log("Time:", result[0].time);
        console.log("Version:", result[0].version);

        console.log("\nFetching photos...");
        const photos = await sql`SELECT * FROM photos WHERE event_id = '3a71dfc7-4949-4dbd-96ff-0d307995df06'`;
        console.log(`Found ${photos.length} photos`);

    } catch (e: any) {
        console.error("\n❌ FAILED:");
        console.error("Message:", e.message);
        console.error("Code:", e.code);
        console.error("Detail:", e.detail);
        console.error("Full error:", JSON.stringify(e, null, 2));
    } finally {
        await sql.end();
    }
}

main();
