# PIL Lens — Architecture Rules for Claude Code

## Project Purpose
PIL Lens is a pharmaceutical document intelligence platform for Lotus Pharmaceutical (TWSE: 1795).
It automates PIL creation, review, and variation assessment for TFDA/Thai FDA regulatory submissions.

## Tech Stack
- **Frontend:** React + Vite + Tailwind CSS (3 screens: Documents, Workflows, Results)
- **Backend:** Node.js + Express (ESM, server.js on port 8080)
- **PDF Extraction:** Gemini 2.5 Pro via Vertex AI (@google/genai SDK)
- **Intelligence:** Claude Sonnet 4 via Anthropic SDK (section mapping, translation, deviation detection)
- **Word Extraction:** mammoth.js (free, no AI needed)
- **Word Generation:** python-docx via Python microservice (port 8081) OR docx npm fallback
- **Deployment:** Cloud Run (asia-southeast1), Docker, 1Gi memory, 15min timeout
- **Auth:** Application Default Credentials (ADC) for Vertex AI, Secret Manager for ANTHROPIC_API_KEY

## STRICT Architectural Rules

### Rule 1: Best Tool Routing — NO EXCEPTIONS
- **PDF extraction → Gemini** (1M context window, single call, zero chunking)
- **Word extraction → mammoth** (free, instant, no API cost)
- **Section mapping → Claude Sonnet** (precise regulatory reasoning)
- **Translation → Claude Sonnet** (pharma-grade CJK terminology)
- **Deviation detection → Claude Sonnet** (severity classification)
- **Word generation → python-docx** (template cloning from approved PIL)

### Rule 2: NO REGEX FOR DOCUMENT PARSING
Never use regex to split, detect, or extract sections from pharmaceutical documents.
Always use LLM API calls (Gemini or Claude).
The only acceptable regex is for trivial string cleanup (trim whitespace, remove BOM).

### Rule 3: NO CHUNKING FOR EXTRACTION
Do NOT split PDFs into chunks for extraction. Gemini's 1M context handles full documents.
Claude chunked extraction exists ONLY as a fallback if Gemini is unavailable.

### Rule 4: STREAMING FOR CLAUDE
Any Claude API call that may take >10 minutes MUST use `client.messages.stream()`.
Anthropic API rejects non-streaming requests over 10 minutes.

### Rule 5: MODEL VERSIONS
- Claude Sonnet: `claude-sonnet-4-20250514`
- Claude Haiku: `claude-haiku-4-5-20251001`
- Gemini: `gemini-2.5-pro` (via Vertex AI)
Never use deprecated model strings (claude-3-5-haiku, claude-3-5-sonnet, etc).

### Rule 6: SUBSECTION NUMBERING
Generated PIL must include subsection numbers matching the target market template.
Taiwan TFDA format: 1, 1.1, 1.2, 3.1, 3.1.1, 3.3.1, 5.1.1-5.1.6, etc.
Match the approved PIL's exact numbering hierarchy.

### Rule 7: SECTION CONTENT INTEGRITY
Each target section contains ONLY its relevant content.
Zero duplication between sections.
When one source section maps to multiple targets, extract ONLY the relevant subsection for each.

### Rule 8: BACKEND ROUTES ARE SACRED
Never modify or remove existing API endpoints. All 4 workflow routes must remain:
- POST /api/workflows/review-aw
- POST /api/workflows/create-draft
- POST /api/workflows/assess-variation
- POST /api/workflows/generate-aw

### Rule 9: APPROVED PIL IS THE FORMAT STANDARD
The generated Word doc must match the exact format of the Lotus approved PIL:
- Same section numbering (1-14 for Taiwan TFDA)
- Same heading style with "(依文獻紀載)" suffix on sections 4-12
- Same subsection hierarchy (3.1.1, 5.1.1, 6.1-6.7, etc.)
- Manufacturer footer: 製造廠/廠址/藥商/地址
- Header: bilingual product name + registration numbers

### Rule 10: COST AWARENESS
- Gemini extraction: ~$0.80/document (cheap, use freely)
- Claude mapping: ~$1.00/workflow (moderate, use for reasoning)
- Claude translation: ~$1.50/14 sections (moderate, use for quality)
- mammoth: $0 (always prefer for Word docs)
- Total workflow cost target: <$4 per Create PIL Draft

## Key Files
- `server.js` — Express entry point, route loading
- `backend/src/services/geminiExtraction.js` — Gemini PDF extraction (primary)
- `backend/src/services/claudeVision.js` — Claude PDF extraction (fallback)
- `backend/src/services/extractionRouter.js` — Routes extraction by file type
- `backend/src/workflows/createDraft.js` — Create PIL Draft pipeline
- `backend/src/workflows/reviewAW.js` — Review AW deviation detection
- `backend/src/services/documentManager.js` — In-memory document store
- `backend/src/services/marketTemplates.js` — Learnable market section templates
- `python-doc-service/main.py` — Python FastAPI for Word generation
- `src/pages/ResultsPage.jsx` — Results display with download buttons
