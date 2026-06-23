---
layout: page
pageClass: custom-home-page
sidebar: false
---

<main class="font-body-md text-body-md antialiased text-on-surface bg-terminal-black">

<!-- Hero Section -->
<section class="relative py-24 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto grid lg:grid-cols-2 gap-12 items-center">
<div class="space-y-8">
<h1 class="font-headline-xl text-headline-xl text-on-surface leading-tight !mt-0 !mb-4 border-b-0">
                    Prevent coding agents from using <span class="text-primary">stale documentation</span>.
                </h1>
<p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                    A local context compiler and CI gate that gives coding agents task-specific, source-linked evidence. Eliminate hallucinations caused by wrong versions or outdated manuals.
                </p>
<div class="flex flex-wrap gap-4">
<a class="bg-primary-container hover:bg-primary text-white px-8 py-4 rounded font-bold transition-all no-underline inline-block" href="/AgentDocs/guide/installation.html">Get Started</a>
<a class="border border-border-muted hover:border-primary text-primary px-8 py-4 rounded font-bold transition-all flex items-center gap-2 no-underline inline-block" href="https://github.com/SomneelSaha2042/AgentDocs" target="_blank" rel="noopener noreferrer">
<span class="material-symbols-outlined">star</span> View on GitHub
                    </a>
</div>
</div>
<div class="relative group">
<div class="absolute inset-0 bg-primary-container opacity-10 blur-3xl rounded-full"></div>
<img alt="Hero Illustration" class="relative z-10 w-full h-auto rounded-xl shadow-2xl border border-border-muted" src="/brand/hero-agentdocs.png"/>
</div>
</section>

<!-- Validation Metrics -->
<section class="py-20 bg-surface-container-low border-y border-outline-variant">
<div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
<h2 class="font-label-caps text-label-caps text-primary mb-12 tracking-widest text-center border-b-0">VALIDATED AGAINST REAL DOCUMENTATION</h2>
<div class="grid md:grid-cols-3 gap-8">
<div class="bg-surface-charcoal border border-border-muted p-8 rounded-lg glow-hover transition-all group">
<div class="font-label-caps text-label-caps text-status-pass mb-2">DETERMINISTIC OUTPUT</div>
<div class="font-headline-lg text-headline-lg text-on-surface group-hover:text-primary transition-colors">100% Hash Match</div>
<p class="text-text-dim mt-4 text-sm">Every successful target produced the same artifact hash on repeated builds.</p>
</div>
<div class="bg-surface-charcoal border border-border-muted p-8 rounded-lg glow-hover transition-all group">
<div class="font-label-caps text-label-caps text-tertiary mb-2">RESILIENT PARSING</div>
<div class="font-headline-lg text-headline-lg text-on-surface group-hover:text-primary transition-colors">737+ MDX Pages</div>
<p class="text-text-dim mt-4 text-sm">Supabase docs preserved despite per-file diagnostics and complex MDX layouts.</p>
</div>
<div class="bg-surface-charcoal border border-border-muted p-8 rounded-lg glow-hover transition-all group">
<div class="font-label-caps text-label-caps text-secondary mb-2">SCALABLE CRAWLS</div>
<div class="font-headline-lg text-headline-lg text-on-surface group-hover:text-primary transition-colors">823 Chunks</div>
<p class="text-text-dim mt-4 text-sm">Next.js compiled bounded 100-page crawls into high-density task packs.</p>
</div>
</div>
</div>
</section>

<!-- Core Features Grid -->
<section class="py-32 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
<div class="text-center mb-20">
<h2 class="font-headline-lg text-headline-lg mb-4 border-b-0">From docs to gateable context</h2>
<p class="text-on-surface-variant font-body-md max-w-2xl mx-auto">The transformation layer that turns static documentation into deterministic evidence for AI agents.</p>
</div>
<div class="grid md:grid-cols-3 gap-gutter">
<!-- Feature 1 -->
<div class="flex flex-col bg-surface-charcoal border border-border-muted rounded-lg overflow-hidden glow-hover transition-all">
<div class="p-6">
<img alt="Compile Docs" class="w-full aspect-square object-cover rounded-lg mb-6 border border-outline-variant" src="/brand/feature-build.png"/>
<h3 class="font-headline-md text-headline-md mb-2 border-b-0">Compile Existing Docs</h3>
<p class="text-text-dim text-sm leading-relaxed">Collect, normalize, graph, and generate deterministic local context from existing docs.</p>
</div>
</div>
<!-- Feature 2 -->
<div class="flex flex-col bg-surface-charcoal border border-border-muted rounded-lg overflow-hidden glow-hover transition-all">
<div class="p-6">
<img alt="Scope Retrieval" class="w-full aspect-square object-cover rounded-lg mb-6 border border-outline-variant" src="/brand/feature-search.png"/>
<h3 class="font-headline-md text-headline-md mb-2 border-b-0">Scope Retrieval</h3>
<p class="text-text-dim text-sm leading-relaxed">Filter versions, frameworks, routers, and runtimes while retrieving evidence offline.</p>
</div>
</div>
<!-- Feature 3 -->
<div class="flex flex-col bg-surface-charcoal border border-border-muted rounded-lg overflow-hidden glow-hover transition-all">
<div class="p-6">
<img alt="Trace Claims" class="w-full aspect-square object-cover rounded-lg mb-6 border border-outline-variant" src="/brand/feature-audit-evidence.png"/>
<h3 class="font-headline-md text-headline-md mb-2 border-b-0">Trace Every Claim</h3>
<p class="text-text-dim text-sm leading-relaxed">Link task packs, entities, and findings back to source pages, headings, and code.</p>
</div>
</div>
<!-- Feature 4 -->
<div class="flex flex-col bg-surface-charcoal border border-border-muted rounded-lg overflow-hidden glow-hover transition-all">
<div class="p-6">
<img alt="Task Packs" class="w-full aspect-square object-cover rounded-lg mb-6 border border-outline-variant" src="/brand/feature-task-packs.png"/>
<h3 class="font-headline-md text-headline-md mb-2 border-b-0">Generate Task Packs</h3>
<p class="text-text-dim text-sm leading-relaxed">Give coding agents compact task context without silently combining conflicting evidence.</p>
</div>
</div>
<!-- Feature 5 -->
<div class="flex flex-col bg-surface-charcoal border border-border-muted rounded-lg overflow-hidden glow-hover transition-all">
<div class="p-6">
<img alt="Hand off" class="w-full aspect-square object-cover rounded-lg mb-6 border border-outline-variant" src="/brand/feature-mcp-tools.png"/>
<h3 class="font-headline-md text-headline-md mb-2 border-b-0">Hand off to Agents</h3>
<p class="text-text-dim text-sm leading-relaxed">Serve task context, freshness, verification, and setup commands through read-only MCP.</p>
</div>
</div>
<!-- Feature 6 -->
<div class="flex flex-col bg-surface-charcoal border border-border-muted rounded-lg overflow-hidden glow-hover transition-all">
<div class="p-6">
<img alt="Readiness" class="w-full aspect-square object-cover rounded-lg mb-6 border border-outline-variant" src="/brand/feature-doctor-readiness.png"/>
<h3 class="font-headline-md text-headline-md mb-2 border-b-0">Gate Readiness</h3>
<p class="text-text-dim text-sm leading-relaxed">Check freshness, coverage, and context conflicts before agents start their work.</p>
</div>
</div>
</div>
</section>

<!-- Technical Workflow (CLI Terminal) -->
<section class="py-24 bg-terminal-black overflow-hidden border-t border-outline-variant">
<div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid lg:grid-cols-2 gap-16 items-center">
<div>
<h2 class="font-headline-lg text-headline-lg mb-6 border-b-0">Automated Guardrails</h2>
<p class="text-body-lg text-on-surface-variant mb-8">
                        The `verify-context` command prevents "context drift" by validating your agent's handoff against current build state. It detects deprecated evidence and version mismatches before they lead to failed PRs.
                    </p>
<ul class="space-y-4 list-none pl-0">
<li class="flex items-start gap-3">
<span class="material-symbols-outlined text-tertiary">check_circle</span>
<span>Deterministic local context compilation</span>
</li>
<li class="flex items-start gap-3">
<span class="material-symbols-outlined text-tertiary">check_circle</span>
<span>CI integration via `agentdocs doctor`</span>
</li>
<li class="flex items-start gap-3">
<span class="material-symbols-outlined text-tertiary">check_circle</span>
<span>Source-linked evidence tracking</span>
</li>
</ul>
</div>
<div class="bg-[#1C2128] rounded-xl border border-border-muted shadow-2xl font-code-md text-code-md overflow-hidden">
<div class="bg-surface-container-highest px-4 py-2 flex items-center justify-between border-b border-border-muted">
<div class="flex gap-1.5">
<div class="w-3 h-3 rounded-full bg-status-fail"></div>
<div class="w-3 h-3 rounded-full bg-status-warn"></div>
<div class="w-3 h-3 rounded-full bg-status-pass"></div>
</div>
<div class="text-text-dim text-xs">bash — agentdocs verify-context</div>
</div>
<div class="p-6 overflow-x-auto terminal-scroll text-sm leading-relaxed">
<div class="mb-4">
<span class="text-secondary">$</span> agentdocs verify-context --task "migrate this service to Fastify v5"<br/>
<span class="text-status-warn font-bold">WARN: Context needs review.</span><br/>
<span class="ml-4 text-text-dim">Issue: deprecated_evidence</span><br/>
<span class="ml-4 text-text-dim">Selected task pack: migration</span><br/>
<span class="ml-4 text-text-dim">Recommended action: inspect migration task pack.</span>
</div>
<div>
<span class="text-secondary">$</span> agentdocs verify-context --task "migrate this service to Fastify v5" --facet version=v5<br/>
<span class="text-status-pass font-bold">PASS: Context is safe to use for this task.</span><br/>
<span class="ml-4 text-text-dim">Version boundary: v5</span><br/>
<span class="ml-4 text-text-dim">Task evidence: source-linked migration sections</span>
</div>
</div>
</div>
</div>
</section>

<!-- Local-First Section -->
<section class="py-32 border-t border-outline-variant relative">
<div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop text-center">
<div class="inline-block px-4 py-1 bg-primary-container bg-opacity-20 border border-primary-container rounded-full text-primary font-label-caps text-label-caps mb-8">
                    SECURITY FIRST
                </div>
<h2 class="font-headline-lg text-headline-lg mb-8 border-b-0">Run locally and safely</h2>
<div class="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-border-muted bg-surface-container mb-12 shadow-inner">
<img alt="Local First Infrastructure" class="w-full h-auto object-cover opacity-90" src="/brand/feature-local-first-safe.png"/>
</div>
<p class="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                    Keep your documentation architecture offline. Treat docs as untrusted input and never execute crawled commands. AgentDocs is designed for privacy-conscious engineering teams who require air-gapped context for their development agents.
                </p>
<div class="mt-12 flex justify-center gap-12 flex-wrap">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary">security</span>
<span class="font-label-caps text-label-caps">No Data Leakage</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary">wifi_off</span>
<span class="font-label-caps text-label-caps">Offline Ready</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary">terminal</span>
<span class="font-label-caps text-label-caps">CLI Driven</span>
</div>
</div>
</div>
</section>

<!-- Final CTA -->
<section class="py-24 bg-primary-container text-on-primary-container text-center">
<div class="max-w-container-max mx-auto px-margin-mobile">
<h2 class="font-headline-lg text-headline-lg mb-6 border-b-0">Ready to harden your AI workflow?</h2>
<p class="font-body-lg mb-10 opacity-90 max-w-xl mx-auto">Install the published beta and start generating source-linked evidence today.</p>
<div class="flex justify-center gap-4">
<a class="bg-on-surface text-surface px-8 py-4 rounded font-bold hover:bg-white transition-all no-underline inline-block" href="/AgentDocs/guide/installation.html">Get Started</a>
<a class="border border-on-primary-container text-on-primary-container px-8 py-4 rounded font-bold hover:bg-on-primary-container hover:text-primary-container transition-all no-underline inline-block" href="/AgentDocs/results/">View Results</a>
</div>
</div>
</section>

</main>
