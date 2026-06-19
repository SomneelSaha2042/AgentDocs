# AgentDocs Pixel Detective Icon Pack

A finalized visual system for the AgentDocs documentation site, GitHub repository, npm release presence, and product feature pages. The canonical persona is a document-bodied detective: it inspects freshness, scope, evidence, and safety before context reaches a coding agent.

## Pack structure

- `brand/` — primary identity, size variants, and favicon.
- `features/` — large feature illustrations for docs and README sections.
- `webp/` — web-optimized equivalents.
- `source-originals/` — untouched generated masters.
- `manifest.json` — machine-readable usage, prompts, alt text, and checksums.
- `preview-sheet.jpg` — visual index.

## Visual rules

Use the app icon as the repeated identity and the feature art sparingly—normally one illustration per section. Keep the dark background intact unless a replacement is deliberately regenerated. Do not add competing robot mascots, generic AI brains, cloud symbols, or extra wordmarks. Preserve the fedora, red hatband, cyan eyes, paper body, and green verification accents so the persona remains recognizable.

The feature illustrations are designed for roughly 320–480 px display width. They contain too much detail to function as 16–32 px navigation glyphs. Use the supplied favicon and app-icon derivatives for small placements.

## Asset map, placements, and regeneration prompts

### `brand/hero-agentdocs.png` — AgentDocs Hero Mascot

**Use:** Homepage hero, README header, launch post, and social-preview base. Keep it large; the wordmark and supporting props are not intended for favicons.

**Recommended placements:** Docs homepage hero; README top visual; GitHub social-preview composition; Release announcement artwork.

**Display guidance:** Display at 420–760 px wide; retain the square master for crops.

**Alt text:** AgentDocs pixel detective mascot holding documentation and an audit checklist.

**Regeneration prompt:**


> Create a square retro pixel-art hero illustration for AgentDocs. Show a friendly document-bodied robot detective in a black suit and fedora with a red hatband, bright cyan scanner eyes, a green pen, an audit clipboard, and a stack of source documents. Use a charcoal-to-black background, crisp blocky pixels, subtle cyan and green glow, high contrast, centered composition, and enough negative space for a README or docs hero. Add a restrained pixel wordmark reading AgentDocs near the bottom. Avoid photorealism, gradients that blur the pixel edges, tiny illegible text, or unrelated AI symbols.

### `brand/app-icon-agentdocs.png` — Primary App and Package Icon

**Use:** Primary compact identity for the docs navbar, repository avatar, npm/package artwork, profile images, and favicons. This is the canonical small-format mascot.

**Recommended placements:** Docs navbar/logo; GitHub repository avatar or organization artwork; npm package artwork and release cards; Favicon source; CLI documentation callouts.

**Display guidance:** Use 512 or 256 px for profile artwork, 64–128 px in docs UI, and the supplied favicon files for browser tabs.

**Alt text:** AgentDocs document detective mascot with cyan eyes, fedora, pen, and checklist.

**Regeneration prompt:**


> Create a compact square pixel-art app icon for AgentDocs. Center a friendly document-shaped detective mascot wearing a black fedora with a red band and black coat, with two bright cyan scanner eyes, holding a green pen and a small checklist. Place it on a near-black rounded-square tile with a subtle border and soft shadow. Use a limited palette of charcoal, paper white, cyan, signal green, and red. Keep the silhouette bold and readable at 64 pixels. No wordmark, no tiny text, no extra background objects, no photorealism.

### `features/feature-build.png` — Build and Compile

**Use:** Illustrates the deterministic collection-to-artifact build pipeline: loose source documents are compiled into ordered, usable context.

**Recommended placements:** Quick Start; Build command reference; Architecture pipeline; Homepage feature card: Compile existing docs.

**Display guidance:** 320–480 px wide in feature cards; 640–900 px on dedicated pages.

**Alt text:** AgentDocs mascot compiling loose documentation into an organized stack.

**Regeneration prompt:**


> Create a square pixel-art feature illustration for AgentDocs build. Show the document detective mascot transforming scattered Markdown pages on the left into a clean ordered stack of normalized documents on the right, connected by a bright cyan compilation stream and arrow. Use the canonical black fedora with red band, white document body, cyan eyes, charcoal rounded-square background, and small cyan spark effects. The scene should communicate deterministic compilation and structured output. No labels or tiny text.

### `features/feature-search.png` — Scoped Search and Retrieval

**Use:** Represents evidence retrieval with version, framework, router, and runtime filters rather than indiscriminate search.

**Recommended placements:** Search and MCP guide; Scope retrieval feature card; Configuration/facets documentation; Context-conflict explanations.

**Display guidance:** 320–480 px wide in cards; pair with copy about filters and conflict warnings.

**Alt text:** AgentDocs mascot inspecting and filtering documentation with a magnifying glass.

**Regeneration prompt:**


> Create a square pixel-art feature illustration for scoped documentation retrieval. Show the AgentDocs document detective holding a large cyan magnifying glass over one selected bright document while several dim documents with distinct facet symbols sit nearby. Add a small funnel filtering cyan data particles into the selected page. Use a dark rounded tile, paper white, cyan, charcoal, and signal green. Communicate version and framework filtering without readable text. Keep the composition simple and technical.

### `features/feature-audit-evidence.png` — Evidence Trace and Audit Trail

**Use:** Shows source-to-claim traceability: documentation evidence is connected to generated context and a verified result.

**Recommended placements:** Generated Artifacts reference; Trace every claim feature card; Audit trail explanations; Evidence/source citation sections.

**Display guidance:** 320–480 px wide; leave surrounding whitespace so the connection trail remains legible.

**Alt text:** AgentDocs mascot tracing a glowing evidence path between a source document and generated code context.

**Regeneration prompt:**


> Create a square pixel-art illustration for evidence traceability. Show the AgentDocs document detective between a source document on the left and a dark code/context panel on the right. Connect them with a glowing green dotted evidence path that ends in a large verified check node. Use the canonical fedora, cyan eyes, paper body, dark rounded-square background, and restrained green highlights. The visual should clearly communicate provenance, source links, and auditability. No readable text.

### `features/feature-task-packs.png` — Task Packs

**Use:** Represents compact, evidence-backed bundles assembled for a specific implementation goal or workflow.

**Recommended placements:** Task pack documentation; Agent workflow guide; Handoff command section; Homepage feature card: Generate task packs.

**Display guidance:** 320–480 px wide; works well beside task-family examples such as authentication or migration.

**Alt text:** AgentDocs mascot carrying a tied bundle of verified task documents.

**Regeneration prompt:**


> Create a square pixel-art feature illustration for AgentDocs task packs. Show the canonical document detective mascot carrying a neatly tied bundle of color-tabbed documents, with visible green check marks on the front pages. Use a black fedora with red band, cyan eyes, paper-white body, dark rounded tile, and limited accent colors for task categories. The bundle should feel compact, curated, and ready to hand to a coding agent. No labels or tiny text.

### `features/feature-mcp-tools.png` — Read-only MCP Tools

**Use:** Visualizes the read-only interface between built AgentDocs artifacts and agent clients, terminals, tooling, or local indexes.

**Recommended placements:** Search and MCP guide; setup-agent documentation; MCP tools reference; Integration feature card.

**Display guidance:** 320–480 px wide; place next to the list of MCP resources and tools.

**Alt text:** AgentDocs mascot connecting verified documentation to a terminal, tool gear, and local database.

**Regeneration prompt:**


> Create a square pixel-art feature illustration for AgentDocs MCP integration. Show the document detective presenting one verified context file that connects through cyan dotted lines to a terminal window, a gear, and a local database cylinder. Use the canonical dark tile, black fedora with red band, white document body, cyan eyes, and green verification mark. Make the connections look read-only and local, not cloud-based. No readable labels.

### `features/feature-doctor-readiness.png` — Doctor and Readiness Gate

**Use:** Represents deterministic readiness scoring, diagnostics, pass/warn/fail status, and CI gating before an agent begins implementation.

**Recommended placements:** Readiness Doctor guide; Results pages; CI drift gate section; Homepage feature card: Verify context.

**Display guidance:** 320–480 px wide; pair with score thresholds or pass/warn/fail copy.

**Alt text:** AgentDocs mascot beside a readiness gauge, checklist, and verified shield.

**Regeneration prompt:**


> Create a square pixel-art feature illustration for AgentDocs readiness checks. Show the document detective beside a large red-amber-green gauge with the needle in the green zone, holding a verified clipboard and standing next to a dark shield with a bright green check. Use the canonical fedora, cyan eyes, paper body, and charcoal rounded-square background. The scene should communicate deterministic diagnostics, CI gating, and a safe pass state. Avoid medical imagery and readable text.

### `features/feature-local-first-safe.png` — Local-first and Safe

**Use:** Communicates that source docs are treated as untrusted input, commands are never executed, and built artifacts remain within a protected local boundary.

**Recommended placements:** Architecture and Security guide; Security policy; Local-first feature card; Trust and privacy explanations.

**Display guidance:** 320–480 px wide; use near security guarantees and local/offline architecture copy.

**Alt text:** AgentDocs mascot protecting local documentation with a lock shield inside a secure boundary.

**Regeneration prompt:**


> Create a square pixel-art security illustration for AgentDocs. Show the canonical document detective inside a glowing cyan local boundary, holding a green shield with a white padlock while placing a verified document into a dark locked local box. Include a small crossed-out command document in the background to imply no command execution. Use a charcoal rounded tile, paper white, cyan, green, and a restrained red warning accent. No cloud icons, no readable text, no aggressive cybersecurity clichés.

## Suggested repository paths

```text
docs/public/brand/hero-agentdocs.png
docs/public/brand/app-icon-agentdocs.png
docs/public/brand/favicon.ico
docs/public/brand/feature-build.png
docs/public/brand/feature-search.png
docs/public/brand/feature-audit-evidence.png
docs/public/brand/feature-task-packs.png
docs/public/brand/feature-mcp-tools.png
docs/public/brand/feature-doctor-readiness.png
docs/public/brand/feature-local-first-safe.png
```

## Drop-in examples

README hero:

```markdown
<p align="center">
  <img src="./docs/public/brand/hero-agentdocs.png" width="560" alt="AgentDocs pixel detective mascot holding documentation and an audit checklist." />
</p>
```

VitePress feature illustration:

```html
<img
  src="/AgentDocs/brand/feature-doctor-readiness.webp"
  alt="AgentDocs mascot beside a readiness gauge, checklist, and verified shield."
  class="feature-illustration"
/>
```

Favicon in the VitePress theme head configuration:

```ts
head: [
  ["link", { rel: "icon", href: "/AgentDocs/brand/favicon.ico" }]
]
```

Suggested CSS:

```css
.feature-illustration {
  display: block;
  width: min(100%, 440px);
  height: auto;
  margin: 1.5rem auto;
  border-radius: 24px;
}

.brand-avatar {
  width: 64px;
  height: 64px;
  border-radius: 16px;
}
```

## Naming convention

The filenames intentionally match the existing AgentDocs feature-pack vocabulary so they can replace or extend current references with minimal documentation changes. The primary identity is `app-icon-agentdocs.png`; feature files should not be substituted for favicons or avatars.
