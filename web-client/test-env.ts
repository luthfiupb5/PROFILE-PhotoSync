console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 80) + "...");
console.log("DIRECT_URL:", process.env.DIRECT_URL?.substring(0, 80) + "...");

import { db } from './lib/db.js';

async function test() {
    try {
        console.log("\nTesting db.getPhotos...");
        const photos = await db.getPhotos('3a71dfc7-4949-4dbd-96ff-0d307995df06', true);
        console.log(`✅ Success! Found ${photos.length} photos`);
        console.log("Sample:", photos[0]);
    } catch (e: any) {
        console.error("❌ Failed:", e.message);
        console.error("Code:", e.code);
        console.error("Full:", e);
    }
    process.exit(0);
}

test();
