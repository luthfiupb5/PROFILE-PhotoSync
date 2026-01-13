# PROFILE Conference 2026 - PhotoSync AI

![PROFILE PhotoSync Header](/web-client/public/assets/Profile-logo-light.png)

**PROFILE PhotoSync** is a privacy-first, next-generation event photography platform designed for PROFILE Conference 2026. It allows attendees to instantly find every photo of themselves from thousands of event shots using "Pro-Level" facial recognition—all without their biometric data ever leaving their phone.

---

## 🚀 Key Features

### 🧠 Pro-Level AI Recognition
- **SSD MobileNet V1 Engine**: Powered by a high-accuracy neural network tuned to a strict confidence threshold (0.6) for professional-grade reliability.
- **Multi-Face Search**: Upload a group selfie, and the AI finds photos matching *anyone* in the group.
- **Smart Indexing**: Generates unique hashes for every face to prevent duplicates and speed up matching.

### 🔒 Privacy-First Architecture
- **Client-Side Processing**: Facial analysis happens entirely in the user's browser.
- **Zero Image Transfer**: Your uploaded selfie is **NEVER** sent to our servers. Only anonymous mathematical vectors are transmitted.
- **Anonymous Search**: The server receives only a list of numbers (vectors), making it impossible to reconstruct the user's face from the search data.

### 📱 Adaptive Experience
- **Mobile-First Design**:
    - **100dvh Lock**: Layout locks to the mobile viewport for a native-app feel with no scrolling.
    - **Thumb-Friendly Grid**: Large, square touch targets for easy navigation.
    - **Decluttered UI**: Smart headers that hide secondary actions in a drawer menu.
- **Desktop Professional Mode**:
    - Automatically switches to a spacious, vertical layout for PC users.
    - High-resolution gallery view with instant download options.

### 🛠️ Admin Dashboard
- **Mobile Admin Drawer**: Full administrative control from your phone with a responsive sidebar.
- **Live Monitoring**: Real-time stats on uploads, storage usage, and system status.
- **Batch Upload**: Drag-and-drop thousands of event photos with auto-face-indexing.
- **QR Code Generator**: Generate and download the official event QR code instantly.

---

## 🏗️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Custom Animations
- **AI Engine**: `face-api.js` (TensorFlow.js based)
- **Database**: Local JSON / Supabase (Configurable)
- **Icons**: Lucide React

---

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/profile-photosync.git
    cd profile-photosync/web-client
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.
    *Note: To access from mobile on the same network, check your terminal for the local IP (e.g., `http://192.168.1.9:3000`).*

---

## 📖 User Guide

### For Attendees
1.  **Scan QR**: Open the app via the event QR code.
2.  **Find Me**: Tap the red "Find Me" button.
3.  **Selfie / Scan**: Take a live selfie or upload a group photo.
4.  **Magic**: Instantly see every photo you're in. Download high-res versions or share them.

### For Admins
1.  Navigate to `/admin`.
2.  Login with your credentials.
3.  **Upload**: Drag & drop folders of event photos. The AI will automatically index faces in the background.
4.  **Monitor**: Keep track of storage and user engagement via the Dashboard.

---

## 🛡️ Security & Privacy

We take privacy seriously.
- **No Face Storage**: We do not store user selfies.
- **Vector Only**: We only store face descriptors (vectors) linked to the public event photos.
- **Ephemeral Input**: User input data is wiped from memory as soon as the search is complete.

---

## 👨‍💻 Developed By

**Luthfi Bassam U P**
- [GitHub](https://github.com/luthfiupb5)
- [LinkedIn](https://www.linkedin.com/in/luthfibassamup/)

---

*Built for PROFILE Conference 2026. Connecting Professional Students.*
