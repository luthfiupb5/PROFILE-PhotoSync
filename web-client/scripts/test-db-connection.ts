import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, {
    ssl: 'require',
    max: 1,
    onnotice: () => { }, // Suppress notices
    debug: (connection, query, params) => {
        console.log('DEBUG:', { connection, query, params });
    }
});

async function main() {
    console.log("Testing database connection and queries...\n");

    try {
        // Test 1: Connection
        console.log("1. Testing connection...");
        const result = await sql`SELECT NOW()`;
        console.log("   ✅ Connected:", result[0].now);

        // Test 2: Check if tables exist
        console.log("\n2. Checking tables...");
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        console.log("   Tables:", tables.map(t => t.table_name).join(', '));

        // Test 3: Count rows
        console.log("\n3. Counting rows...");
        const [events] = await sql`SELECT COUNT(*) FROM events`;
        const [photos] = await sql`SELECT COUNT(*) FROM photos`;
        const [vectors] = await sql`SELECT COUNT(*) FROM vectors`;
        console.log(`   Events: ${events.count}`);
        console.log(`   Photos: ${photos.count}`);
        console.log(`   Vectors: ${vectors.count}`);

        // Test 4: Fetch photos for the specific event
        console.log("\n4. Fetching photos for event '3a71dfc7-4949-4dbd-96ff-0d307995df06'...");
        const eventPhotos = await sql`
            SELECT * FROM photos 
            WHERE event_id = '3a71dfc7-4949-4dbd-96ff-0d307995df06' 
            ORDER BY created_at DESC
        `;
        console.log(`   Found ${eventPhotos.length} photos`);
        if (eventPhotos.length > 0) {
            console.log("   Sample photo:", {
                id: eventPhotos[0].id,
                url: eventPhotos[0].url,
                is_private: eventPhotos[0].is_private
            });
        }

        // Test 5: Check column names
        console.log("\n5. Checking photos table schema...");
        const columns = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'photos'
        `;
        console.log("   Columns:", columns.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    } catch (e) {
        console.error("\n❌ Error:", e);
    } finally {
        await sql.end();
    }
}

main();
