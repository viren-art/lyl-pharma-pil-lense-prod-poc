# PIL Lens Architecture Rules

These rules are MANDATORY for all code changes. Read before every session.

## Rule 1: NO REGEX FOR DOCUMENT PARSING
Never use regex to split, detect, or extract sections from pharmaceutical documents.
Always use Claude API calls for section detection and content extraction.
The only acceptable regex is for trivial string cleanup (trim whitespace, remove BOM characters).

Mammoth extracts raw text from Word docs — but section DETECTION must be done by Claude,
not by regex pattern matching on headings. Pharmaceutical section numbering is inconsistent
across markets, languages, and document versions.

## Rule 2: ONE LLM CALL FOR EXTRACTION + MAPPING
Do not extract first then map separately when creating draft PILs.
Send the source document and target template in ONE Claude call.
Claude returns content already organized into target sections.

This prevents off-by-one errors, content duplication, and mapping misalignment.
The mapping prompt must include the FULL target template with section numbers and names.

## Rule 3: STREAMING FOR LARGE DOCUMENTS
Any Claude call processing >10 pages MUST use streaming API:
```javascript
const stream = client.messages.stream({ ... });
const response = await stream.finalMessage();
```
Never use `client.messages.create()` for large documents — Anthropic API
will reject non-streaming requests that take >10 minutes.

## Rule 4: MODEL VERSIONS
- Sonnet: `claude-sonnet-4-20250514`
- Haiku: `claude-haiku-4-5-20251001`

Never use deprecated model strings:
- ~~claude-3-5-haiku-20241022~~ → use claude-haiku-4-5-20251001
- ~~claude-3-5-sonnet-20241022~~ → use claude-sonnet-4-20250514
- ~~claude-3-opus~~ → do not use

## Rule 5: SUBSECTION NUMBERING
Generated PIL must include subsection numbers matching the target market template:
- 3.1, 3.1.1, 3.1.2, 3.3.1, 3.3.2
- 5.1, 5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.1.5, 5.1.6
- 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
- 10.1, 10.2, 10.2.1, 10.3, 10.3.1, 10.3.1.1, 10.3.1.2

These must appear in the generated Word document as bold headings.

## Rule 6: SECTION CONTENT INTEGRITY
Each target section contains ONLY its relevant content.
Zero duplication between sections. Verify by checking that
no paragraph appears in more than one section.

When Claude maps a broad SmPC section (e.g., "4.4 Special warnings") to
multiple TFDA target sections (5.1.1, 5.1.2, etc.), each target gets ONLY
its specific paragraphs. The mapping prompt must explicitly instruct:
"Extract ONLY the relevant paragraphs for each target — zero overlap."

## Rule 7: SECTION MATCHING BY NAME, NOT INDEX
When processing Claude's mapping response, ALWAYS match sections by their
`targetNumber` (e.g., "1", "5.1.1") or `targetName`, NEVER by array index.

Array index 0 is NOT necessarily section 1. Match explicitly:
```javascript
// WRONG: mappings[i] → targetSections[i]
// RIGHT: mappings.find(m => m.targetNumber === target.number)
```

## Rule 8: APPROVED PIL FORMAT
The generated Word document must match Lotus Pharmaceutical's approved PIL format:
- Header: Bilingual product name + registration number + "須由醫師處方使用"
- Sections 4-12 get "(依文獻紀載)" suffix
- Subsection headings bold
- Plain black text, no decorative styling
- Footer: 製造廠/廠址/藥商/地址

## Rule 9: COST AWARENESS
- Use mammoth ($0) for Word documents, Claude Vision only for PDFs
- Use Haiku for simple classification tasks, Sonnet for extraction/translation
- Log API costs per workflow run
- Typical costs: Review AW ~$1, Create Draft ~$4, Assess Variation ~$0.55

## Rule 10: NO MOCK DATA IN PRODUCTION
The app starts with zero documents. No seed data, no hardcoded entries.
All document dropdowns read from the actual upload store via API.
Mock data is ONLY acceptable when ANTHROPIC_API_KEY is not set (dev mode).
