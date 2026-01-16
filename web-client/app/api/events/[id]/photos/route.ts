import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const searchParams = req.nextUrl.searchParams;
        const includePrivate = searchParams.get('includePrivate') === 'true';

        if (includePrivate) {
            const cookieStore = await cookies();
            const session = cookieStore.get('auth_session');
            if (!session) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const photos = await db.getPhotos(id, includePrivate);
        console.log(`[API] Fetched ${photos.length} photos for event ${id}`);
        return NextResponse.json(photos);
    } catch (e: any) {
        console.error('[API] Error fetching photos:', {
            message: e.message,
            code: e.code,
            details: e.details,
            hint: e.hint
        });
        return NextResponse.json({
            error: 'Failed to fetch photos',
            details: e.message,
            code: e.code
        }, { status: 500 });
    }
}
