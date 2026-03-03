# Museum PDF Tool v2.0 🖼️
**100% Offline, Secure, Browser-Based Magazine PDF Processor**

The Museum PDF Tool is a modern web application designed for museum staff to process, split, merge, and archive scanned museum magazine PDFs. By leveraging WebAssembly (WASM) and client-side JavaScript, the tool performs all heavy PDF operations directly within the user's browser, guaranteeing **zero data upload** and **100% privacy**.

![Museum PDF Tool Aesthetic](docs/assets/preview.png) *(Preview placeholder)*

🔗 **Live Tool:** [cultuuratlas.nl](https://cultuuratlas.nl)

---

## ✨ Key Features

### 🔒 Ultimate Privacy & Security
- **No Servers, No Uploads:** Files never leave your device. All processing happens locally in your browser memory.
- **Client-Side Engine:** Built using `pdf-lib` and `pdf.js`.
- **GDPR Compliant by Design:** Eliminates privacy concerns since no data is transmitted or stored externally.

### 📱 Progressive Web App (PWA) & Offline Ready
- **Installable:** Can be installed like a native application on Windows, macOS, iOS, and Android directly from the browser (e.g., via "Add to Home Screen").
- **100% Offline Capable:** Powered by an advanced Service Worker (v4) that caches all necessary assets, fonts, and CDN libraries. Once loaded, the tool functions flawlessly without an internet connection.
- **Auto-Update Mechanism:** The service worker automatically detects new versions and gracefully reloads the application to ensure you always have the latest toolset.

### 🎨 Modern "Delft Blue & Dutch Orange" Aesthetic
The UI was meticulously designed to reflect Dutch cultural heritage:
- **Color Palette:** Features deep, premium Navy/Delft Blue (`#111827`, `#1e3a8a`) and crisp white backgrounds, contrasted beautifully with vibrant Dutch Orange (`#ea580c`, `#f97316`) accents.
- **Mathematical Patterns:** A subtle radial dot pattern background created purely via CSS ensures 0 KB extra load weight while maintaining a modern, high-end gallery feel.
- **Dark Mode Support:** Includes a persistent dark mode toggle (stored in `localStorage`) for comfortable nighttime workflow, switching to high-contrast slate and charcoal tones.
- **Responsive & Accessible:** Fully mobile/tablet optimized with proper touch targets, fluid layouts, and intelligent keyboard handling (e.g., standard keyboards for range inputs to allow commas and dashes).

### ⚙️ Core Capabilities
- **Split & Archive:** Automatically splits large magazine PDFs into individual articles based on user-defined page ranges.
- **Exclude Pages:** Easily remove specific pages (e.g., full-page advertisements or blank pages) from the final output.
- **Merge Blocks:** Merge separate, non-contiguous page ranges into a single continuous PDF document.
- **Text Extraction (OCR-ready):** Automatically extracts raw text from the parsed PDF pages and saves them as `.txt` files for archiving and search indexing.
- **Thumbnail Generation:** Renders and exports high-quality cover images (Small: 500x700px, Large: 1024x1280px) for each processed article using `pdf.js` canvas rendering.
- **One-Click ZIP Export:** Packages all generated PDFs, text files, and images into a neatly structured `.zip` archive, ready for immediate download.

---

## 🛠️ Architecture & Tech Stack

The transition from a Python/Flask backend to a 100% serverless WebAssembly/JS architecture was driven by the need for enhanced privacy, lower maintenance costs, and better accessibility.

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Styling:** Custom native CSS (no heavy frameworks) for maximum performance.
- **PDF Manipulation:** `pdf-lib.js` for splitting, merging, and rebuilding PDFs.
- **PDF Rendering & Text:** `pdf.js` via Mozilla for rendering canvas thumbnail images and extracting embedded text.
- **Archiving:** `JSZip` for bundling the final output on the client side.
- **File Handling:** `FileSaver.js` for triggering the local download prompt.
- **Hosting:** GitHub Pages (Free, highly scalable static hosting).

---

## 📖 How to Use

For detailed instructions on using the tool and installing it as an offline app on your specific device (iPhone, iPad, PC), please refer to the integrated **[User Guide](guide.html)**.

1. **Upload:** Drag & drop your source magazine PDF.
2. **Configure:** Enter the Year, Issue Number, and Page Ranges (e.g., `1-10, 15, 20-30`).
3. **Filter:** Specify any pages to exclude (e.g., advertisements) or blocks to merge.
4. **Process:** Click "Process PDF". The tool will generate your files locally.
5. **Download:** Save the resulting `.zip` folder containing your split PDFs, extracted text, and thumbnail images.

---

## 💻 Local Development

Since the application is purely static, development is extremely straightforward. No build steps or complex environments are required.

1. Clone the repository:
   ```bash
   git clone https://github.com/devonurefe/cultuuratlas-pdf-tool.git
   ```
2. Navigate to the directory:
   ```bash
   cd cultuuratlas-pdf-tool
   ```
3. Start a local HTTP server (required to test Service Workers):
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   ```
4. Open your browser and navigate to `http://localhost:8000`. 
   *(Tip: Use Incognito/Private mode during development to bypass aggressive Service Worker caching).*

---

Made with ❤️ for the community. Powered by **h2O**.
