
import postgres from 'postgres';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("❌ DATABASE_URL is not defined in environment variables.");
    process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

async function migrate() {
    console.log("🔌 Connecting to Database...");

    try {
        console.log("🛠️  Setting up Schema...");

        // 1. Enable pgvector
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;

        // 2. Events Table
        await sql`
            CREATE TABLE IF NOT EXISTS events (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                name text NOT NULL,
                banner_url text,
                created_at timestamptz DEFAULT now()
            )
        `;

        // 3. Application Users Table (Renamed to app_users)
        await sql`
            CREATE TABLE IF NOT EXISTS app_users (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                username text UNIQUE NOT NULL,
                password_hash text NOT NULL,
                role text CHECK (role IN ('super_admin', 'program_admin')) NOT NULL,
                event_id uuid REFERENCES events(id) ON DELETE CASCADE,
                created_at timestamptz DEFAULT now()
            )
        `;

        // 4. Photos Table
        await sql`
            CREATE TABLE IF NOT EXISTS photos (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
                url text NOT NULL,
                is_private boolean DEFAULT false,
                created_at timestamptz DEFAULT now()
            )
        `;

        // Index for filtering
        await sql`CREATE INDEX IF NOT EXISTS idx_photos_event_privacy ON photos(event_id, is_private)`;

        // 5. Face Vectors Table
        await sql`
            CREATE TABLE IF NOT EXISTS face_vectors (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
                event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
                embedding vector(128),
                face_hash text,
                created_at timestamptz DEFAULT now()
            )
        `;

        // Index for Vector Search
        // Note: 'vector_l2_ops' is for Euclidean distance (L2 distance), which matches our previous logic.
        // HNSW is the standard good performing index.
        await sql`CREATE INDEX IF NOT EXISTS idx_face_vectors_embedding ON face_vectors USING hnsw (embedding vector_l2_ops)`;

        console.log("✅ Schema Migration Complete!");

    } catch (e) {
        console.error("❌ Migration Failed:", e);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

migrate();
