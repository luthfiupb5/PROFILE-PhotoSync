"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";
import {
    LayoutDashboard, Upload, Image as ImageIcon, Settings,
    LogOut, ExternalLink, QrCode, X, Check,
    LayoutGrid, Zap, Wand2, Trash2, Loader2, Menu, Lock, Globe
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import imageCompression from 'browser-image-compression';
import { RefreshCw } from "lucide-react";

interface Photo {
    id: string;
    url: string;
    isPrivate?: boolean;
}

interface AuthUser {
    id: string;
    role: 'super_admin' | 'program_admin';
    eventId: string | null;
}

// Hardcoded for the single event instance
const PROFILE_EVENT_ID = "3a71dfc7-4949-4dbd-96ff-0d307995df06";
const PROFILE_EVENT_NAME = "PROFILE Conference 2026";

export default function AdminDashboard() {
    const router = useRouter();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [modelStatus, setModelStatus] = useState("Initializing AI...");
    const [reindexing, setReindexing] = useState(false);
    const [reindexProgress, setReindexProgress] = useState({ current: 0, total: 0 });

    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);

    const [uploadMode, setUploadMode] = useState<'public' | 'private'>('public');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [processingStatus, setProcessingStatus] = useState("");



    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (!data.user) {
                router.push('/admin/login');
                return;
            }
            setUser(data.user);

            // Auto-load photos for the main event
            fetchPhotos(PROFILE_EVENT_ID);

            try {
                await FaceMatcher.getInstance().loadModels();
                setModelStatus("AI Engine Ready");
            } catch (e) {
                console.error(e);
                setModelStatus("AI Engine Offline");
            }
        } catch (e) {
            router.push('/admin/login');
        } finally {
            setAuthLoading(false);
        }
    };

    const fetchPhotos = async (eventId: string) => {
        setLoadingPhotos(true);
        try {
            const res = await fetch(`/api/events/${eventId}/photos?includePrivate=true`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setPhotos(data);
            } else {
                console.error("Invalid photos response:", data);
                setPhotos([]);
            }
        } catch (e) {
            console.error(e);
            setPhotos([]);
        }
        finally { setLoadingPhotos(false); }
    };

    const deletePhoto = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Delete this photo permanently?")) return;

        try {
            const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setPhotos(photos.filter(p => p.id !== id));
            } else {
                alert("Failed to delete photo");
            }
        } catch (e) { console.error(e); }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
    };

    const downloadQR = () => {
        const canvas = document.getElementById('event-qr-code') as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `profile-conf-qr.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        setUploadQueue(imageFiles);
        processBatch(imageFiles);
    };

    const processBatch = async (files: File[]) => {
        setUploading(true);
        setUploadProgress({ current: 0, total: files.length });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProcessingStatus(`Processing ${file.name}...`);

            try {
                const imgUrl = URL.createObjectURL(file);
                const img = await faceapi.fetchImage(imgUrl);

                const detectionScale = 800 / Math.max(img.width, img.height);
                const useScale = detectionScale < 1 ? detectionScale : 1;

                let detectionInput: HTMLCanvasElement | HTMLImageElement = img;

                if (useScale < 1) {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width * useScale;
                    canvas.height = img.height * useScale;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        detectionInput = canvas;
                    }
                }

                // Use centralized detector options
                const detections = await faceapi.detectAllFaces(detectionInput, FaceMatcher.getDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                const vectors = detections.map(d => Array.from(d.descriptor));
                const faceHashes = detections.map(d => FaceMatcher.generateFaceHash(d.descriptor));

                let blobToUpload = file;
                try {
                    const options = {
                        maxSizeMB: 2,
                        maxWidthOrHeight: 1920,
                        useWebWorker: true
                    };
                    blobToUpload = await imageCompression(file, options);
                } catch (error) {
                    console.warn("Compression failed, uploading original", error);
                }



                const formData = new FormData();
                formData.append('file', blobToUpload);
                formData.append('eventId', PROFILE_EVENT_ID);
                formData.append('vectors', JSON.stringify(vectors));
                formData.append('faceHashes', JSON.stringify(faceHashes));
                formData.append('isPrivate', (uploadMode === 'private').toString());

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error('Upload failed');

                URL.revokeObjectURL(imgUrl);

            } catch (e) {
                console.error(`Failed to process ${file.name}`, e);
            }

            setUploadProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setUploading(false);
        setUploadQueue([]);
        setProcessingStatus("");
        fetchPhotos(PROFILE_EVENT_ID);
        fetchPhotos(PROFILE_EVENT_ID);
    };

    const handleReindex = async () => {
        if (!confirm("This will re-scan all photos in the gallery with the new AI model. This process takes time and must not be interrupted. Continue?")) return;

        setReindexing(true);
        try {
            const allPhotos = await fetch(`/api/events/${PROFILE_EVENT_ID}/photos?includePrivate=true`).then(r => r.json());
            setReindexProgress({ current: 0, total: allPhotos.length });

            for (let i = 0; i < allPhotos.length; i++) {
                const photo = allPhotos[i];
                try {
                    // Fetch image as blob
                    // Fetch image as blob via PROXY to avoid CORS
                    const imgBlob = await fetch(`/api/proxy?url=${encodeURIComponent(photo.url)}`).then(r => r.blob());
                    const imgUrl = URL.createObjectURL(imgBlob);
                    const img = await faceapi.fetchImage(imgUrl);

                    // Detect using NEW model
                    const detections = await faceapi.detectAllFaces(img, FaceMatcher.getDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptors();

                    const vectors = detections.map(d => Array.from(d.descriptor));
                    const faceHashes = detections.map(d => FaceMatcher.generateFaceHash(d.descriptor));

                    URL.revokeObjectURL(imgUrl);

                    // Send update to server
                    await fetch('/api/admin/reindex', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            photoId: photo.id,
                            eventId: PROFILE_EVENT_ID,
                            vectors,
                            faceHashes
                        })
                    });

                } catch (e) {
                    console.error(`Failed to reindex ${photo.id}`, e);
                }
                setReindexProgress(prev => ({ ...prev, current: i + 1 }));
            }
            alert("Gallery Re-indexing Complete!");
        } catch (e) {
            console.error("Reindex failed", e);
            alert("Re-indexing failed: " + e);
        } finally {
            setReindexing(false);
        }
    };



    if (authLoading) return (
        <div className="h-screen bg-[var(--background)] flex flex-col items-center justify-center gap-4 text-[var(--muted)]">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            <p className="text-sm font-mono uppercase tracking-widest text-red-500">Authenticating Secure Session</p>
        </div>
    );

    return (
        <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)] font-sans overflow-hidden">

            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-50 md:relative flex-shrink-0 bg-black/90 md:bg-black/40 backdrop-blur-xl border-r border-red-900/20 transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-20 items-center' : 'w-72'} ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>

                <div className="flex-1 overflow-y-auto px-4 space-y-2 py-6">
                    <div className="px-2 pb-4 pt-2 text-sm font-bold text-red-500 uppercase tracking-widest border-b border-red-500/10 mb-6 flex justify-between items-center">
                        Admin Console
                        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/50 hover:text-white"><X size={16} /></button>
                    </div>

                    <div className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-gradient-to-r from-red-900/20 to-transparent text-white border border-red-500/10 shadow-sm ${sidebarCollapsed ? 'justify-center px-0' : ''}`}>
                        <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                        {!sidebarCollapsed && <span className="truncate flex-1 text-left font-semibold text-sm">{PROFILE_EVENT_NAME}</span>}
                    </div>

                    {/* Mobile Only: Navigation Items moved from Header */}
                    {!sidebarCollapsed && (
                        <div className="md:hidden space-y-2 pt-4 border-t border-white/5 mt-4">
                            <button onClick={() => window.open(`/`, '_blank')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors">
                                <ExternalLink size={16} /> Open Public View
                            </button>
                            <button onClick={() => setShowQRModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors">
                                <QrCode size={16} /> Show Event QR
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-red-900/20 bg-black/30">
                    <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-900 to-black border border-red-500/20 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                            {user?.role === 'super_admin' ? 'A' : 'P'}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-semibold text-white truncate">Administrator</p>
                                <button onClick={handleLogout} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 mt-1 transition-colors">
                                    <LogOut size={10} /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--background)]">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-red-900/10 to-transparent pointer-events-none"></div>

                <header className="h-24 border-b border-red-900/20 px-4 md:px-8 flex items-center justify-between flex-shrink-0 bg-black/20 backdrop-blur-md z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-white/70 hover:text-white">
                            <Menu size={24} />
                        </button>
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">Dashboard</h2>
                        <span className={`px-2 py-1.5 md:px-3 rounded-full text-[10px] font-mono border flex items-center gap-2 ${modelStatus.includes("Ready") ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                            <span className={`w-2 h-2 rounded-full ${modelStatus.includes("Ready") ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500'}`}></span>
                            <span className="hidden md:inline">{modelStatus}</span>
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <button onClick={() => window.open(`/`, '_blank')} className="btn-icon text-[var(--muted)] hover:text-white transition-colors p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-red-500/20" title="Open Public View">
                            <ExternalLink size={18} />
                        </button>
                        <button onClick={() => setShowQRModal(true)} className="px-5 py-2.5 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500/10 text-red-400 transition-all flex items-center gap-2 hover:border-red-500/40">
                            <QrCode size={14} /> <span className="hidden sm:inline">Event QR</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 cursor-default">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:border-red-500/30">
                            <div className="relative z-10">
                                <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Total Photos</p>
                                <h3 className="text-4xl font-display font-bold mt-2 text-white group-hover:scale-105 transition-transform origin-left">{photos.length}</h3>
                            </div>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                                <ImageIcon size={80} />
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:border-red-500/30">
                            <div className="relative z-10">
                                <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Storage Usage</p>
                                <h3 className="text-4xl font-display font-bold mt-2 text-white group-hover:scale-105 transition-transform origin-left">{(photos.length * 2.4).toFixed(1)}<span className="text-lg font-sans text-[var(--muted)] ml-1 font-medium">MB</span></h3>
                            </div>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                                <Zap size={80} />
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group border-red-500/20 hover:shadow-[0_0_30px_rgba(220,38,38,0.1)]">
                            <div className="relative z-10">
                                <p className="text-red-400 text-xs font-bold uppercase tracking-wider">System Status</p>
                                <div className="mt-2 flex items-center gap-3">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                    <h3 className="text-2xl font-display font-bold text-white">Online</h3>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:border-red-500/30">
                            <div className="relative z-10 w-full">
                                <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Maintenance</p>
                                <div className="mt-4">
                                    <button
                                        onClick={handleReindex}
                                        disabled={reindexing}
                                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw size={14} className={reindexing ? "animate-spin" : ""} />
                                        {reindexing ? `Re-indexing ${reindexProgress.current}/${reindexProgress.total}` : "Re-index Gallery"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border-red-500/10">
                        <div className="flex border-b border-red-500/10 bg-black/20">
                            <button
                                onClick={() => setUploadMode('public')}
                                className={`flex-1 py-5 flex items-center justify-center gap-2.5 text-sm font-bold transition-all relative
                                    ${uploadMode === 'public' ? 'text-white bg-white/5' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'}
                                `}
                            >
                                <Globe size={16} className={uploadMode === 'public' ? 'text-blue-400' : ''} /> Public Gallery
                                {uploadMode === 'public' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_-2px_10px_rgba(59,130,246,0.5)]"></div>}
                            </button>
                            <button
                                onClick={() => setUploadMode('private')}
                                className={`flex-1 py-5 flex items-center justify-center gap-2.5 text-sm font-bold transition-all relative
                                    ${uploadMode === 'private' ? 'text-white bg-white/5' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'}
                                `}
                            >
                                <Lock size={16} className={uploadMode === 'private' ? 'text-red-500' : ''} /> Private Gallery
                                {uploadMode === 'private' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_-2px_10px_rgba(239,68,68,0.5)]"></div>}
                            </button>
                        </div>

                        <div className="p-10">
                            {!uploading ? (
                                <div className="space-y-8">


                                    <div
                                        className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group relative overflow-hidden
                                            ${uploadMode === 'public' ? 'border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-red-500/20 hover:border-red-500/50 hover:bg-red-500/5'}
                                        `}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                        onClick={() => document.getElementById('fileUpload')?.click()}
                                    >
                                        <input id="fileUpload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                                        <div className="w-20 h-20 rounded-full bg-[var(--surface-highlight)] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                                            <Upload size={32} className={uploadMode === 'public' ? 'text-blue-400' : 'text-red-400'} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">
                                            {uploadMode === 'public' ? 'Upload Public Photos' : 'Upload Private Photos'}
                                        </h3>
                                        <p className="text-sm text-[var(--muted)]">
                                            {uploadMode === 'public' ? 'Visible to everyone in the gallery.' : 'Hidden. Only visible to people in the photo.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-16 text-center">
                                    <div className="relative w-20 h-20 mx-auto mb-8">
                                        <div className="absolute inset-0 rounded-full border-4 border-[var(--surface-highlight)]"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-t-red-500 animate-spin"></div>
                                        <Zap className="absolute inset-0 m-auto text-white animate-pulse" size={24} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">Processing Batch...</h3>
                                    <p className="text-[var(--muted)] mb-8">Optimizing, analyzing, and indexing content.</p>

                                    <div className="max-w-md mx-auto space-y-3">
                                        <div className="h-2 w-full bg-[var(--surface-highlight)] rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 relative" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}>
                                                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white/50 to-transparent"></div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-xs font-mono text-[var(--muted)]">
                                            <span>{uploadProgress.current} / {uploadProgress.total} Files</span>
                                            <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                                        </div>
                                        <p className="text-xs text-red-400 font-mono mt-2">{processingStatus}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-white"><ImageIcon size={20} className="text-red-400" /> Live Gallery</h3>
                            <div className="flex gap-2">
                                <button className="p-2 text-[var(--muted)] hover:text-white transition-colors bg-white/5 rounded-lg"><LayoutGrid size={18} /></button>
                            </div>
                        </div>

                        {loadingPhotos ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="aspect-square bg-[var(--surface-highlight)] rounded-2xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : photos.length === 0 ? (
                            <div className="py-32 text-center text-[var(--muted)] border-2 border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)]/20">
                                <p>No photos have been uploaded yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {photos.map(p => (
                                    <div key={p.id} className="relative aspect-square group rounded-2xl overflow-hidden bg-[var(--surface-highlight)] border border-white/5 hover:border-red-500/50 transition-all shadow-lg hover:shadow-red-500/20">
                                        <img src={p.url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-105" loading="lazy" />
                                        {p.isPrivate && (
                                            <div className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-md z-20" title="Private Photo">
                                                <Lock size={12} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                            <a href={p.url} target="_blank" className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg"><ExternalLink size={16} /></a>
                                            <button onClick={(e) => deletePhoto(e, p.id)} className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </main >

            {showQRModal && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in p-4" onClick={() => setShowQRModal(false)}>
                    <div className="glass-panel w-full max-w-sm rounded-2xl p-8 shadow-2xl animate-scale-in border border-red-500/20 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-display font-bold text-white">Event QR Code</h3>
                            <button onClick={() => setShowQRModal(false)}><X size={20} className="text-[var(--muted)] hover:text-white transition-colors" /></button>
                        </div>

                        <div className="bg-white p-4 rounded-xl mx-auto w-fit mb-8 shadow-xl shadow-white/5">
                            <QRCodeCanvas
                                id="event-qr-code"
                                value={`${window.location.origin}/`}
                                size={200}
                                level={"H"}
                                includeMargin={true}
                            />
                        </div>

                        <p className="text-sm text-[var(--muted)] mb-6">
                            Scan to access <strong>{PROFILE_EVENT_NAME}</strong>
                        </p>

                        <button
                            onClick={downloadQR}
                            className="w-full py-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Upload className="rotate-180" size={16} /> Download PNG
                        </button>
                    </div>
                </div>
            )
            }
        </div >
    );
}
