import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
    console.log("Testing Supabase connection...\n");

    try {
        // Test 1: Fetch photos
        console.log("1. Fetching photos...");
        const { data: photos, error: photosError } = await supabase
            .from('photos')
            .select('*')
            .eq('event_id', '3a71dfc7-4949-4dbd-96ff-0d307995df06');

        if (photosError) {
            console.error("❌ Photos error:", photosError);
        } else {
            console.log(`✅ Found ${photos.length} photos`);
            if (photos.length > 0) {
                console.log("Sample:", photos[0]);
            }
        }

        // Test 2: Insert test photo
        console.log("\n2. Testing insert...");
        const testPhoto = {
            id: crypto.randomUUID(),
            url: 'https://test.com/test.jpg',
            event_id: '3a71dfc7-4949-4dbd-96ff-0d307995df06',
            is_private: false
        };

        const { data: inserted, error: insertError } = await supabase
            .from('photos')
            .insert(testPhoto)
            .select()
            .single();

        if (insertError) {
            console.error("❌ Insert error:", insertError);
        } else {
            console.log("✅ Insert successful:", inserted.id);

            // Clean up
            await supabase.from('photos').delete().eq('id', inserted.id);
            console.log("✅ Cleanup done");
        }

    } catch (e) {
        console.error("\n❌ Unexpected error:", e);
    }
}

test();
