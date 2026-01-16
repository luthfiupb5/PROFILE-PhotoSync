import { createClient } from '@supabase/supabase-js';
import { r2, R2_BUCKET_NAME, R2_PUBLIC_URL } from './r2';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface User {
    id: string;
    username: string;
    password: string;
    role: 'super_admin' | 'program_admin';
    eventId?: string | null;
    createdAt: Date;
}

export interface Event {
    id: string;
    name: string;
    banner?: string | null;
    createdAt: Date;
}

export interface Photo {
    id: string;
    url: string;
    eventId: string;
    isPrivate: boolean;
    createdAt: Date;
}

export interface FaceVector {
    id: string;
    photoId: string;
    eventId: string;
    vectorStr: string;
    faceHash?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[DB] Initializing Supabase client...');
console.log('[DB] URL:', supabaseUrl?.substring(0, 30) + '...');
console.log('[DB] Key:', supabaseKey ? 'Present (' + supabaseKey.substring(0, 20) + '...)' : 'MISSING!');

if (!supabaseUrl || !supabaseKey) {
    throw new Error('[DB] Missing Supabase credentials!');
}

const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

console.log('[DB] Supabase client initialized');

class Database {
    async getUser(username: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error) return null;
        return data as User;
    }

    async getUserById(id: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data as User;
    }

    async createUser(username: string, password: string, role: string, eventId?: string) {
        const id = crypto.randomUUID();
        const { data, error } = await supabase
            .from('users')
            .insert({
                id,
                username,
                password,
                role,
                event_id: eventId || null
            })
            .select()
            .single();

        if (error) throw error;
        return data as User;
    }

    async getEvents() {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Event[];
    }

    async createEvent(name: string, banner?: string) {
        const eventId = crypto.randomUUID();
        const { data: event, error } = await supabase
            .from('events')
            .insert({
                id: eventId,
                name,
                banner: banner || null
            })
            .select()
            .single();

        if (error) throw error;

        const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const username = `${sanitized}.admin`;
        const password = Math.random().toString(36).slice(-8);

        await this.createUser(username, password, 'program_admin', eventId);

        return { event: event as Event, credentials: { username, password } };
    }

    async deleteEvent(id: string) {
        console.log(`[DB] Deleting event: ${id}`);

        const photos = await this.getPhotos(id, true);

        for (const photo of photos) {
            try {
                if (photo.url.includes(R2_PUBLIC_URL)) {
                    const key = photo.url.replace(`${R2_PUBLIC_URL}/`, '');
                    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
                }
            } catch (e) {
                console.error(`Failed to delete R2 object for photo ${photo.id}`, e);
            }
        }

        const { data, error } = await supabase
            .from('events')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) return null;
        return data as Event;
    }

    async getEventAdmin(eventId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('event_id', eventId)
            .eq('role', 'program_admin')
            .single();

        if (error || !data) return null;
        return { username: data.username, password: data.password };
    }

    async deletePhoto(id: string) {
        const { data: photo, error } = await supabase
            .from('photos')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (photo) {
            try {
                if (photo.url.includes(R2_PUBLIC_URL)) {
                    const key = photo.url.replace(`${R2_PUBLIC_URL}/`, '');
                    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
                }
            } catch (e) {
                console.error(`Failed to delete R2 object for photo ${id}`, e);
            }
        }

        if (error) return null;
        return photo as Photo;
    }

    async addPhotoWithVectors(url: string, eventId: string, vectors: number[][], hashes?: string[], isPrivate: boolean = false) {
        const photoId = crypto.randomUUID();

        const { data: photo, error: photoError } = await supabase
            .from('photos')
            .insert({
                id: photoId,
                url,
                event_id: eventId,
                is_private: isPrivate
            })
            .select()
            .single();

        if (photoError) throw photoError;

        if (vectors.length > 0) {
            const vectorRecords = vectors.map((vector, i) => ({
                id: crypto.randomUUID(),
                photo_id: photoId,
                event_id: eventId,
                vector_str: JSON.stringify(vector),
                face_hash: hashes ? hashes[i] : null
            }));

            const { error: vectorError } = await supabase
                .from('vectors')
                .insert(vectorRecords);

            if (vectorError) throw vectorError;
        }

        return photo as Photo;
    }

    async getPhotos(eventId: string, includePrivate: boolean = false) {
        console.log('[DB] getPhotos called for event:', eventId, 'includePrivate:', includePrivate);
        let query = supabase
            .from('photos')
            .select('*')
            .eq('event_id', eventId);

        if (!includePrivate) {
            query = query.eq('is_private', false);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('[DB] getPhotos error:', error.message, error.code, error.details);
            throw error;
        }
        console.log('[DB] getPhotos result:', data.length, 'photos');
        return data as Photo[];
    }

    async findMatches(eventId: string, queryVectors: number[][]): Promise<string[]> {
        const { data: candidates, error } = await supabase
            .from('vectors')
            .select('*')
            .eq('event_id', eventId);

        if (error) throw error;

        const matches = new Set<string>();
        const threshold = 0.5;

        for (const queryVector of queryVectors) {
            for (const item of candidates) {
                try {
                    const dbVector = JSON.parse(item.vector_str) as number[];
                    if (this.euclideanDistance(queryVector, dbVector) < threshold) {
                        const { data: photo } = await supabase
                            .from('photos')
                            .select('url')
                            .eq('id', item.photo_id)
                            .single();

                        if (photo) matches.add(photo.url);
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        return Array.from(matches);
    }

    private euclideanDistance(descriptors1: number[], descriptors2: number[]): number {
        return Math.sqrt(
            descriptors1
                .map((val, i) => val - descriptors2[i])
                .reduce((res, diff) => res + Math.pow(diff, 2), 0)
        );
    }
}

export const db = new Database();
