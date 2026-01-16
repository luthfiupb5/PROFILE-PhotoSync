import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!);

async function main() {
    console.log('Connecting to database...');

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS events (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL,
                banner TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('Created events table');

        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                event_id UUID REFERENCES events(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('Created users table');

        await sql`
            CREATE TABLE IF NOT EXISTS photos (
                id UUID PRIMARY KEY,
                url TEXT NOT NULL,
                event_id UUID REFERENCES events(id),
                is_private BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('Created photos table');

        await sql`
            CREATE TABLE IF NOT EXISTS vectors (
                id UUID PRIMARY KEY,
                photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
                event_id UUID REFERENCES events(id),
                vector_str TEXT NOT NULL,
                face_hash TEXT
            );
        `;
        console.log('Created vectors table');

        console.log('Database setup complete!');
    } catch (e) {
        console.error('Error setting up database:', e);
    } finally {
        await sql.end();
    }
}

main();
