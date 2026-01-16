import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!);

async function main() {
    console.log("Starting migration from db.json to Supabase...");

    if (!fs.existsSync(DB_PATH)) {
        console.error("db.json not found!");
        process.exit(1);
    }

    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    try {
        // 1. Migrate Events
        console.log(`Migrating ${data.events.length} events...`);
        const eventIdMap = new Map<string, string>();

        for (const event of data.events) {
            // Store mapping if name matches what we see in bad references
            // Or just grab the first event's ID since we know there's only one relevant one usually
            eventIdMap.set('profile-conf-2026', event.id);
            eventIdMap.set(event.name, event.id);

            try {
                await sql`
                    INSERT INTO events (id, name, banner, created_at)
                    VALUES (${event.id}, ${event.name}, ${event.banner || null}, ${event.createdAt})
                    ON CONFLICT (id) DO NOTHING
                `;
            } catch (e) {
                console.error(`Failed to migrate event ${event.id}:`, e);
            }
        }

        // Fallback: Use the first event ID if we can't find a map
        const defaultEventId = data.events[0]?.id;

        // 2. Migrate Users
        console.log(`Migrating ${data.users.length} users...`);
        for (const user of data.users) {
            try {
                // Ensure ID is UUID
                const userId = user.id.length === 36 ? user.id : crypto.randomUUID();

                await sql`
                    INSERT INTO users (id, username, password, role, event_id, created_at)
                    VALUES (${userId}, ${user.username}, ${user.password}, ${user.role}, ${user.eventId || null}, ${user.createdAt})
                    ON CONFLICT (id) DO NOTHING
                `;
            } catch (e) {
                console.error(`Failed to migrate user ${user.id}:`, e);
            }
        }

        // 3. Migrate Photos
        console.log(`Migrating ${data.photos.length} photos...`);
        for (const photo of data.photos) {
            try {
                // Fix Event ID
                let targetEventId = photo.eventId;
                if (targetEventId && targetEventId.length !== 36) {
                    targetEventId = eventIdMap.get(targetEventId) || defaultEventId;
                }

                await sql`
                    INSERT INTO photos (id, url, event_id, is_private, created_at)
                    VALUES (${photo.id}, ${photo.url}, ${targetEventId}, ${photo.isPrivate}, ${photo.createdAt})
                    ON CONFLICT (id) DO NOTHING
                `;
            } catch (e) {
                console.error(`Failed to migrate photo ${photo.id}:`, e);
            }
        }

        // 4. Migrate Vectors
        console.log(`Migrating ${data.vectors.length} vectors...`);
        for (const vector of data.vectors) {
            try {
                let targetEventId = vector.eventId;
                if (targetEventId && targetEventId.length !== 36) {
                    targetEventId = eventIdMap.get(targetEventId) || defaultEventId;
                }

                await sql`
                    INSERT INTO vectors (id, photo_id, event_id, vector_str, face_hash)
                    VALUES (${vector.id}, ${vector.photoId}, ${targetEventId}, ${vector.vectorStr}, ${vector.faceHash || null})
                    ON CONFLICT (id) DO NOTHING
                `;
            } catch (e) {
                console.error(`Failed to migrate vector ${vector.id}:`, e);
            }
        }

        console.log("✅ Migration complete!");

    } catch (e) {
        console.error("❌ Migration failed:", e);
    }
}

main();
