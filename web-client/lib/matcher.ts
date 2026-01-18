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
            // Load TinyFaceDetector (Faster, optimized for web)
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            // Pre-load SSD MobileNet just in case legacy code needs it, but we prefer Tiny
            // await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL); 

            this.modelsLoaded = true;
            console.log("AI Models loaded: TinyFaceDetector (Performance Optimized)");
        } catch (e) {
            console.error("Failed to load AI models", e);
        }
    }

    public static getDetectorOptions() {
        // Input size 512 is a good balance for TinyFaceDetector
        return new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 });
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

        const detection = await faceapi.detectSingleFace(img, FaceMatcher.getDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.warn("No face detected in selfie");
            return [];
        }

        const selfieVector = detection.descriptor;
        const matches: string[] = [];

        // Threshold for TinyFaceDetector might differ. 
        // 0.5 is standard, but sometimes 0.45 or 0.55 works better.
        // Keeping 0.5 for now.
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
