import * as faceapi from 'face-api.js';

export interface FaceRecord {
    image: string;
    vectors: number[][];
    faceHashes?: string[];
}

export class FaceMatcher {
    private static instance: FaceMatcher;
    private modelsLoaded = false;
    private index: FaceRecord[] = [];

    private constructor() { }

    public static getInstance(): FaceMatcher {
        if (!FaceMatcher.instance) {
            FaceMatcher.instance = new FaceMatcher();
        }
        return FaceMatcher.instance;
    }

    public async loadModels() {
        if (this.modelsLoaded) return;
        try {
            const MODEL_URL = '/models';
            // Load the most accurate model (SSD Mobilenet v1)
            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            this.modelsLoaded = true;
            console.log("AI Models loaded: SSD MobileNet v1 (High Accuracy)");
        } catch (e) {
            console.error("Failed to load AI models", e);
        }
    }

    public async loadIndex(indexData: FaceRecord[]) {
        this.index = indexData;
        console.log(`Face Index loaded: ${this.index.length} images`);
    }

    // Generate a deterministic hash for a face descriptor
    public static generateFaceHash(descriptor: Float32Array | number[]): string {
        const arr = Array.from(descriptor);
        // unique hash based on descriptor values
        let hash = 0;
        for (const val of arr) {
            const v = Math.floor(val * 1000000);
            hash = ((hash << 5) - hash) + v;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    public async findMatches(selfieUrl: string): Promise<string[]> {
        if (!this.modelsLoaded) await this.loadModels();

        const img = await faceapi.fetchImage(selfieUrl);
        // Use SSD MobileNet for selfie as well for consistency
        const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.warn("No face detected in selfie");
            return [];
        }

        const selfieVector = detection.descriptor;
        const matches: string[] = [];
        // Stricter threshold for "Pro Level" accuracy
        // 0.6 is typical, 0.5 is strict. 0.55 is a good balance. 
        // User requested "sooo accurate", so let's stick to 0.5 to avoid false positives, 
        // or slightly loose (0.55) to ensure we find them? 
        // Euclidean Distance: LOWER is better match. 
        // < 0.6 is usually same person. < 0.4 is very strict.
        // Let's use 0.5 for high precision as requested.
        const threshold = 0.5;

        for (const entry of this.index) {
            for (const vector of entry.vectors) {
                const dist = faceapi.euclideanDistance(selfieVector, vector);
                if (dist < threshold) {
                    matches.push(entry.image);
                    break;
                }
            }
        }

        return matches;
    }
}
