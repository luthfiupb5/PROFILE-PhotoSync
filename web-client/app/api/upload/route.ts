import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { r2, R2_BUCKET_NAME, R2_PUBLIC_URL } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    console.log("[API] Processing local upload...");
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const eventId = formData.get('eventId') as string;
        const vectorsStr = formData.get('vectors') as string;
        const faceHashesStr = formData.get('faceHashes') as string;

        if (!file || !eventId || !vectorsStr) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeFilename = file.name.replace(/\s/g, '_');
        const key = `events/${eventId}/${timestamp}-${safeFilename}`;

        // Upload to R2
        await r2.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: file.type || 'image/jpeg',
        }));

        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        const vectors = JSON.parse(vectorsStr);
        const faceHashes = faceHashesStr ? JSON.parse(faceHashesStr) : undefined;
        const isPrivate = formData.get('isPrivate') === 'true';
        const photo = await db.addPhotoWithVectors(publicUrl, eventId, vectors, faceHashes, isPrivate);

        console.log(`[API] Uploaded to R2: ${publicUrl}`);
        return NextResponse.json({ success: true, photo });

    } catch (e: any) {
        console.error("[API] Upload Error:", {
            message: e.message,
            code: e.code,
            details: e.details,
            hint: e.hint,
            stack: e.stack
        });
        return NextResponse.json({
            error: "Internal Server Error",
            details: e.message,
            code: e.code
        }, { status: 500 });
    }
}
