import { ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars BEFORE importing r2
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    // Dynamic import to ensure process.env is populated
    const { r2 } = await import('../lib/r2');

    console.log(`Testing R2 Connection for bucket: ${process.env.R2_BUCKET_NAME}...`);

    try {
        // 1. List Objects (Read permission)
        console.log("1. Testing ListObjects...");
        const listCmd = new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, MaxKeys: 1 });
        await r2.send(listCmd);
        console.log("   ✅ ListObjects successful.");

        // 2. Upload (Write permission)
        console.log("2. Testing PutObject...");
        const testKey = 'test-connection.txt';
        const putCmd = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: testKey,
            Body: "Connection verified!",
            ContentType: "text/plain"
        });
        await r2.send(putCmd);
        console.log("   ✅ PutObject successful.");

        // 3. Delete (Delete permission) - Optional but good check
        console.log("3. Testing DeleteObject...");
        const delCmd = new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: testKey });
        await r2.send(delCmd);
        console.log("   ✅ DeleteObject successful.");

        console.log("\n🎉 R2 Connection Fully Verified!");
    } catch (e) {
        console.error("\n❌ R2 Connection Failed:", e);
    }
}

main();
