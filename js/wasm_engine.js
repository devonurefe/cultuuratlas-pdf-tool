const { PDFDocument } = PDFLib;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const pdfPageCount = document.getElementById('pdfPageCount');
    const logArea = document.getElementById('logArea');
    const resultDiv = document.getElementById('result');
    const downloadLinks = document.getElementById('downloadLinks');
    const btnText = document.getElementById('btn-text');
    const progressBar = document.getElementById('progress-bar');
    const submitBtn = document.getElementById('processBtn') || form.querySelector('button');

    let globalPdfBytes = null;
    let totalPdfPages = 0;

    function logProgress(msg) {
        logArea.classList.remove('hidden');
        logArea.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
        logArea.scrollTop = logArea.scrollHeight;
        console.log(msg);
    }

    // PDF Load Listener
    document.getElementById('pdf_file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            pdfPageCount.textContent = "";
            return;
        }

        pdfPageCount.textContent = "Reading PDF file...";
        const arrayBuffer = await file.arrayBuffer();
        globalPdfBytes = new Uint8Array(arrayBuffer);

        try {
            const pdfDoc = await PDFDocument.load(globalPdfBytes);
            totalPdfPages = pdfDoc.getPageCount();
            pdfPageCount.textContent = `Total Pages: ${totalPdfPages}`;
            logProgress(`PDF loaded. Total ${totalPdfPages} pages.`);
        } catch (err) {
            pdfPageCount.textContent = "ERROR: Cannot read PDF.";
            console.error(err);
        }
    });

    // Parsers (Ported from python process_ranges & process_remove_pages)
    function parseRanges(rangesStr, maxPages) {
        if (!rangesStr) return [[...Array(maxPages).keys()].map(i => i + 1)];
        const ranges = [];
        rangesStr.split(',').forEach(part => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                if (start > end || start < 1 || end > maxPages) throw new Error(`Invalid page range: ${part}`);
                const r = [];
                for (let i = start; i <= end; i++) r.push(i);
                ranges.push(r);
            } else {
                const page = Number(part);
                if (page < 1 || page > maxPages) throw new Error(`Invalid page range: ${part}`);
                ranges.push([page]);
            }
        });
        return ranges;
    }

    function parseRemovePages(removeStr, maxPages) {
        if (!removeStr) return [];
        const pages = removeStr.split(',').map(s => Number(s.trim())).filter(n => n);
        if (pages.some(p => p < 1 || p > maxPages)) throw new Error("Invalid pages to remove");
        return pages;
    }

    function mergeArticles(ranges, mergeStr) {
        if (!mergeStr) return ranges;
        const mergeIndices = mergeStr.split(',').map(s => Number(s.trim())).filter(n => n);
        if (mergeIndices.length < 2) return ranges;

        const validIndices = mergeIndices.filter(i => i >= 1 && i <= ranges.length).sort((a, b) => a - b);
        if (validIndices.length < 2) return ranges;

        let allPages = [];
        const indicesSet = new Set(validIndices.map(i => i - 1));
        validIndices.forEach(i => allPages.push(...ranges[i - 1]));
        allPages.sort((a, b) => a - b);

        const result = [];
        for (let i = 0; i < ranges.length; i++) {
            if (i === validIndices[0] - 1) result.push(allPages);
            else if (!indicesSet.has(i)) result.push(ranges[i]);
        }
        return result;
    }

    // Helper Format Name
    function generateFilename(year, number, start, end) {
        const pYear = String(year);
        const pNum = String(number).padStart(2, '0');
        const pStart = String(start).padStart(2, '0');
        const pEnd = String(end).padStart(2, '0');
        return `${pYear}${pNum}${pStart}${pEnd}`;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  OCR TEXT CLEANER  —  pure, deterministic, zero external dependencies
    //  Fixes the most common defects produced by image-based PDF OCR
    //  (Tesseract, ABBYY, etc.) that end up baked into the embedded text:
    //    1. UTF-8/Windows-1252 mojibake    (â€œ → ", Ã© → é, …)
    //    2. Latin ligatures                (ﬁ → fi, ﬂ → fl, …)
    //    3. Hyphenated line breaks         (ge- makkelijk → gemakkelijk)
    //    4. Random uppercase mid-word      (vaN, GroeNlo, eNiGe → van, …)
    //    5. Multiple consecutive spaces    (collapsed to a single space)
    //    6. Missing line break after . ! ? (new sentence on a new line)
    //  Runs in <10 ms on a typical magazine page, no network, no WASM,
    //  no external CDN. Deterministic — same input always gives same output.
    // ──────────────────────────────────────────────────────────────────────

    // Step 1 — Repair mojibake produced when UTF-8 bytes were decoded as
    // Windows-1252 / Latin-1. We rebuild the original byte stream by mapping
    // each character back to its Windows-1252 byte and then re-decode as
    // UTF-8. The pass is repeated (up to 3×) so double-encoded mojibake
    // ("Ãƒ©" instead of "é") is also recovered. We keep a result only when
    // it actually lowers the mojibake-marker count (defensive guard).
    const WIN1252_REVERSE = {
        0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
        0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
        0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
        0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
        0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
        0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
    };
    // NOTE: do NOT add the /g flag here. RegExp.test() with /g is stateful
    // (it advances .lastIndex between calls) and produces inconsistent
    // results when the same regex is reused — which is exactly what would
    // happen across many .txt extractions in a row. We only need a presence
    // check, so a non-global regex is the right shape.
    const MOJIBAKE_MARKERS = /Â|Ã.|â€|â‚¬|Å“|Å¡|Å¾|Æ’/;
    const MOJIBAKE_MARKERS_G = /Â|Ã.|â€|â‚¬|Å“|Å¡|Å¾|Æ’/g;

    function _mojibakePass(text) {
        const bytes = [];
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code <= 0xFF) {
                bytes.push(code);
            } else if (WIN1252_REVERSE[code] !== undefined) {
                bytes.push(WIN1252_REVERSE[code]);
            } else {
                const utf8 = new TextEncoder().encode(text[i]);
                for (const b of utf8) bytes.push(b);
            }
        }
        try {
            return new TextDecoder('utf-8', { fatal: false })
                .decode(new Uint8Array(bytes));
        } catch (e) {
            return text;
        }
    }

    function fixMojibake(text) {
        if (!text || !MOJIBAKE_MARKERS.test(text)) return text;
        let cur = text;
        for (let i = 0; i < 3; i++) {
            const next = _mojibakePass(cur);
            const before = (cur.match(MOJIBAKE_MARKERS_G) || []).length;
            const after = (next.match(MOJIBAKE_MARKERS_G) || []).length;
            if (after < before) {
                cur = next;
            } else {
                break;
            }
        }
        return cur;
    }

    // Step 1a — Repair well-known broken multi-byte sequences.
    // pdf.js drops bytes in the Win-1252 0x80–0x9F "hole" (these code-points
    // are undefined in ISO-8859-1 and some PDF decoders silently discard
    // them).  The result is a truncated UTF-8 sequence that _mojibakePass
    // cannot repair because the bytes are physically absent.
    //
    // Example: bullet "•" = UTF-8 E2 80 A2. After 0x80 is dropped the
    //          string becomes â¢ (U+00E2 U+00A2) — two perfectly legal
    //          characters that decode cleanly but mean nothing.
    //
    // The map below lists every practical fragment together with the
    // character that was originally intended.
    const BROKEN_SEQUENCE_MAP = {
        // ── bullets & symbols ──
        'â¢':  '•',       // E2 80 A2 → dropped 80
        'â£':  '•',       // occasional OCR variant

        // ── dashes ──
        'â"':  '—',       // em-dash  E2 80 94 → â + " (0x94 = ")
        'â"':  '–',       // en-dash  E2 80 93 → â + " (0x93 = ")
        // when 0x93/0x94 also gets dropped, only â remains — handled below

        // ── single curly quotes ──
        'â\u0018': '\u2018',  // '  left single  E2 80 98 → â + 0x18
        'â\u0019': '\u2019',  // '  right single E2 80 99 → â + 0x19
        'â\u2018': '\u2018',  // '  sometimes the byte survives as char
        'â\u2019': '\u2019',

        // ── double curly quotes ──
        'â\u001C': '\u201C',  // "  left double  E2 80 9C → â + 0x1C
        'â\u001D': '\u201D',  // "  right double E2 80 9D → â + 0x1D
        'â\u201C': '\u201C',
        'â\u201D': '\u201D',

        // ── ellipsis ──
        'â¦':  '…',       // E2 80 A6 → dropped 80

        // ── misc ──
        'â¬':  '€',       // E2 82 AC  (euro sign, 0x82 dropped)
        'â°':  '‰',       // E2 80 B0  (per-mille, 0x80 dropped)
        'â€':  '"',       // E2 80 9C/9D — 2nd byte dropped (catch-all)
    };
    // Build one alternation regex from the map keys, longest-first so that
    // e.g. "â\u201C" is tried before a bare "â".
    const _brokenKeys = Object.keys(BROKEN_SEQUENCE_MAP)
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const BROKEN_SEQ_RE = new RegExp(_brokenKeys.join('|'), 'g');

    function fixBrokenSequences(text) {
        if (!text) return text;
        return text.replace(BROKEN_SEQ_RE, m => BROKEN_SEQUENCE_MAP[m] || m);
    }

    // Step 1b — Some PDF text streams have already lost the trailing bytes
    // of curly-quote / dash mojibake (Win-1252 codepoints 0x80, 0x9C, 0x9D
    // are undefined and pdf.js sometimes drops them). What survives is a
    // lone 'â' (U+00E2). Hollandaca'da 'â' karakteri pratikte hiç
    // kullanılmaz — bu yüzden tek başına geçen 'â'leri tipografik tırnağa
    // çeviriyoruz. Always runs, even if no other mojibake markers exist.
    //
    // Updated: prefer SINGLE curly quotes (' ') which are far more common
    // in Dutch typographic convention than double quotes.  Lines like
    //   de 'Bellebuurt'   or   in de jaren '50
    // use single quotes almost exclusively.  The rare double-quote case
    // is already handled by fixBrokenSequences above.
    function stripStrayMojibakeArtefacts(text) {
        if (!text || text.indexOf('â') < 0) return text;
        let out = text;
        // letter/digit/punctuation followed by 'â' → closing single quote '
        out = out.replace(/([A-Za-zÀ-ÿ0-9.,;:!?])â/g, '$1\u2019');
        // 'â' followed by a letter or digit → opening single quote '
        out = out.replace(/â(?=[A-Za-zÀ-ÿ0-9])/g, '\u2018');
        // any remaining lone 'â' surrounded by whitespace / line ends → drop
        out = out.replace(/(^|\s)â(?=\s|$)/g, '$1');
        return out;
    }

    // Step 2 — Normalise common Latin ligatures and stray PDF artefacts
    // back to plain ASCII pairs. NFKC takes care of the bulk; the explicit
    // map handles characters that NFKC leaves unchanged.
    const LIGATURES = {
        'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
        'ﬅ': 'st', 'ﬆ': 'st',
        '\u00AD': '',     // soft hyphen
        '\uFFFD': '',     // replacement character (lost byte)
        '\u200B': '',     // zero-width space
        '\u200C': '',     // zero-width non-joiner
        '\u200D': ''      // zero-width joiner
    };
    function fixLigatures(text) {
        let out = text.normalize('NFKC');
        out = out.replace(/[ﬀﬁﬂﬃﬄﬅﬆ\u00AD\uFFFD\u200B-\u200D]/g,
            (c) => LIGATURES[c] !== undefined ? LIGATURES[c] : c);
        return out;
    }

    // Step 3 — Re-join words that were hyphenated across a line break.
    // Only joins when the hyphen sits between two lowercase letters, so
    // legitimate compounds (e.g. "Klein-Brabant", "e-mail") survive.
    const LC = 'a-zàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿœß';
    const UC = 'A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒ';
    function fixHyphenation(text) {
        const re = new RegExp(`([${LC}])-[\\u00A0 \\t]*\\n[\\u00A0 \\t]*([${LC}])`, 'g');
        let out = text.replace(re, '$1$2');
        const inline = new RegExp(`([${LC}])-[\\u00A0 \\t]+([${LC}])`, 'g');
        out = out.replace(inline, '$1$2');
        return out;
    }

    // Step 4 — Lowercase uppercase letters that appear mid-word right after
    // a lowercase letter. Iterates until no more replacements (handles
    // chains like "laNGduriG" → "langdurig").
    function fixInnerCaps(text) {
        const re = new RegExp(`([${LC}])([${UC}])`, 'g');
        const lowerMap = {
            'À': 'à','Á': 'á','Â': 'â','Ã': 'ã','Ä': 'ä','Å': 'å','Æ': 'æ',
            'Ç': 'ç','È': 'è','É': 'é','Ê': 'ê','Ë': 'ë','Ì': 'ì','Í': 'í',
            'Î': 'î','Ï': 'ï','Ñ': 'ñ','Ò': 'ò','Ó': 'ó','Ô': 'ô','Õ': 'õ',
            'Ö': 'ö','Ø': 'ø','Ù': 'ù','Ú': 'ú','Û': 'û','Ü': 'ü','Ý': 'ý',
            'Ÿ': 'ÿ','Œ': 'œ'
        };
        let prev;
        let cur = text;
        do {
            prev = cur;
            cur = cur.replace(re, (_, a, b) => a + (lowerMap[b] || b.toLowerCase()));
        } while (cur !== prev);
        return cur;
    }

    // Step 5 — Collapse runs of horizontal whitespace into a single space,
    // but preserve newlines.
    function collapseSpaces(text) {
        return text
            .replace(/[\u00A0\t \f\v]{2,}/g, ' ')
            .replace(/[\u00A0\t \f\v]+\n/g, '\n')
            .replace(/\n[\u00A0\t \f\v]+/g, '\n');
    }

    // Step 6 — Insert a newline after sentence-ending punctuation when the
    // next sentence starts with an uppercase letter. The character before
    // the punctuation must be a lowercase letter or digit so that initials
    // (B.V., P.O., F.C.) are left intact.
    function newlineAfterSentence(text) {
        const re = new RegExp(
            `([${LC}0-9])([.!?])[\\u00A0 \\t]+(?=["“”'’(]?[${UC}])`,
            'g'
        );
        return text.replace(re, '$1$2\n');
    }

    // Master pipeline.
    function cleanOcrText(text) {
        if (!text) return text;
        let out = fixMojibake(text);
        out = fixBrokenSequences(out);
        out = stripStrayMojibakeArtefacts(out);
        out = fixLigatures(out);
        out = fixHyphenation(out);
        out = fixInnerCaps(out);
        out = collapseSpaces(out);
        out = newlineAfterSentence(out);
        out = out.replace(/[ \t]+$/gm, '');
        out = out.replace(/\n{3,}/g, '\n\n');
        return out.trim() + '\n';
    }

    // pdf.js 3.x transfers the underlying ArrayBuffer to its worker, which
    // detaches it for any subsequent caller. We therefore hand pdf.js a
    // disposable copy every time so the caller's bytes stay reusable.
    function copyBytes(src) {
        const out = new Uint8Array(src.byteLength);
        out.set(src);
        return out;
    }

    // Extract Text natively (matches the original Python PyPDF2 logic).
    // Uses the Y-coordinate of each text item (transform[5]) to detect line
    // breaks, since pdf.js does not expose `hasEOL` consistently across
    // versions. Output is always run through cleanOcrText().
    async function extractTextFromPdf(pdfBytes) {
        const loadingTask = pdfjsLib.getDocument({ data: copyBytes(pdfBytes) });
        const pdf = await loadingTask.promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            let pageText = "";
            let lastY = null;
            for (const item of textContent.items) {
                const str = item.str;
                if (str === undefined || str === null) continue;
                const y = item.transform ? item.transform[5] : null;

                if (lastY !== null && y !== null && Math.abs(y - lastY) > 1) {
                    if (pageText && !pageText.endsWith('\n')) pageText += '\n';
                } else if (pageText && !/\s$/.test(pageText) && !/^\s/.test(str)) {
                    pageText += ' ';
                }
                pageText += str;
                lastY = y;
            }
            fullText += pageText + "\n\n";
        }
        return cleanOcrText(fullText);
    }

    // PDF.js Render Page as Image (Matches Python PIL dimensions)
    async function renderScaledImages(pdfBytes, pageNumber) {
        const loadingTask = pdfjsLib.getDocument({ data: copyBytes(pdfBytes) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);

        // Render at a high scale initially (scale 3.0) for good base quality
        const viewport = page.getViewport({ scale: 3.0 });

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.height = viewport.height;
        sourceCanvas.width = viewport.width;

        await page.render({ canvasContext: sourceCanvas.getContext('2d'), viewport: viewport }).promise;

        function resizeCanvas(maxW, maxH) {
            let ratio = Math.min(maxW / viewport.width, maxH / viewport.height);
            let targetW = viewport.width * ratio;
            let targetH = viewport.height * ratio;

            const targetCanvas = document.createElement('canvas');
            targetCanvas.width = targetW;
            targetCanvas.height = targetH;
            const ctx = targetCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
            return targetCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        }

        // Python used 500x700 for small, 1024x1280 for large
        const smallBase64 = resizeCanvas(500, 700);
        const largeBase64 = resizeCanvas(1024, 1280);

        return { small: smallBase64, large: largeBase64 };
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!globalPdfBytes) return alert("Please select a PDF file first");

        const btnSvg = btnText.innerHTML.match(/<svg[\s\S]*?<\/svg>/) ? btnText.innerHTML.match(/<svg[\s\S]*?<\/svg>/)[0] : '';
        btnText.innerHTML = btnSvg + '<span style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2; padding-top:2px;"><span>Processing...</span><span style="font-size:11px; font-weight:600; opacity:0.85;">(Do not close tab)</span></span>';
        submitBtn.disabled = true;
        resultDiv.classList.add('hidden');
        logArea.innerHTML = '';
        progressBar.style.width = '10%';

        logProgress("System initialized...");

        try {
            const year = document.getElementById('year').value.replace(/[^a-zA-Z0-9]/g, '');
            const number = document.getElementById('number').value.replace(/[^a-zA-Z0-9]/g, '');
            const pRangesStr = document.getElementById('article_ranges').value;
            const pMergeStr = document.getElementById('merge_ranges').value;
            const pRemoveStr = document.getElementById('remove_pages').value;

            // Parsers
            let articleRanges = parseRanges(pRangesStr, totalPdfPages);
            articleRanges = mergeArticles(articleRanges, pMergeStr);
            const removePages = parseRemovePages(pRemoveStr, totalPdfPages);

            logProgress("Inputs parsed. Preparing JSZip compression engine...");
            const zip = new JSZip();
            const originalDoc = await PDFDocument.load(globalPdfBytes);

            progressBar.style.width = '30%';

            for (let i = 0; i < articleRanges.length; i++) {
                const range = articleRanges[i];
                logProgress(`Processing: Article Block ${i + 1}/${articleRanges.length} (Pages: ${range.join(',')})`);

                // PDF Splitting (pdf-lib)
                const newPdf = await PDFDocument.create();
                const pagesToCopy = range.filter(p => !removePages.includes(p)).map(p => p - 1);

                if (pagesToCopy.length === 0) continue;

                const copiedPages = await newPdf.copyPages(originalDoc, pagesToCopy);
                copiedPages.forEach(p => newPdf.addPage(p));
                const newPdfBytes = await newPdf.save();

                const startP = Math.min(...range);
                const endP = Math.max(...range);
                const baseName = generateFilename(year, number, startP, endP);

                // Add PDF
                zip.file(`output${year}${number}/pdf/${baseName}.pdf`, newPdfBytes);

                // Generate Images (Canvas pdf.js)
                logProgress(`  -> Generating thumbnail images (Small & Large)...`);
                const { small, large } = await renderScaledImages(newPdfBytes, 1);
                zip.file(`output${year}${number}/small/${baseName}.jpg`, small, { base64: true });
                zip.file(`output${year}${number}/large/${baseName}.jpg`, large, { base64: true });

                logProgress(`  -> Extracting and cleaning text from PDF...`);
                const extractedText = await extractTextFromPdf(newPdfBytes);
                zip.file(`output${year}${number}/ocr/${baseName}.txt`, extractedText);
            }

            progressBar.style.width = '80%';
            logProgress("All PDFs processed. Creating ZIP archive...");

            const content = await zip.generateAsync({ type: "blob" });

            progressBar.style.width = '100%';
            logProgress("Process completed successfully!");

            try { document.getElementById('notificationSound').play(); } catch (e) { /* sound blocked by browser */ }

            const outputName = `output${year}${number}.zip`;
            downloadLinks.innerHTML = `
                <button id="downloadBtn" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
                    color: white;
                    font-weight: 800;
                    font-size: 16px;
                    padding: 14px 24px;
                    border-radius: 14px;
                    border: none;
                    cursor: pointer;
                    font-family: 'Nunito', sans-serif;
                    letter-spacing: 0.01em;
                    box-shadow: 0 8px 24px -4px rgba(22, 163, 74, 0.4);
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                "
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 14px 32px -4px rgba(22,163,74,0.5)'"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px -4px rgba(22,163,74,0.4)'">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download ${outputName}
                </button>
            `;


            document.getElementById('downloadBtn').addEventListener('click', () => {
                saveAs(content, outputName);
            });

            resultDiv.classList.remove('hidden');

        } catch (e) {
            logProgress("ERROR: " + e.message);
            alert("Error during processing: " + e.message);
        } finally {
            btnText.innerHTML = btnSvg + ' Process PDF';
            submitBtn.disabled = false;
        }
    });

});
