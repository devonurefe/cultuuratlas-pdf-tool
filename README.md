# Museum PDF Tool (WebAssembly Version)

A 100% client-side, offline-capable PDF processing tool for Museum Magazines. 

## Features
- **Zero Server Cost & 100% Privacy:** All processing happens locally in the browser using WebAssembly and JavaScript (`pdf-lib.js`, `pdf.js`). Files never leave your device.
- **Offline Capable (PWA):** Once loaded, the application caches all necessary assets via a Service Worker and can be used completely offline.
- **Installable Desktop App:** Can be installed directly to the desktop or home screen via supported browsers (Chrome, Edge).
- **Core Capabilities:** 
  - Splits PDF files into individual pages.
  - Merges specific user-defined pages.
  - Excludes unwanted pages.
  - Extracts text and images natively.
  - Outputs a ZIP file containing the processed results.

## Deployment
This project is designed to be hosted statically on platforms like GitHub Pages, Vercel, or Netlify. It requires no backend server.

The application is deployed at `cultuuratlas.nl`.
