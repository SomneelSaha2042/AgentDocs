import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgentDocs",
  description: "Deterministic, local-first, context-safe tooling for agent-readable documentation.",
  base: "/AgentDocs/",
  // Explicit file URLs keep the deployed artifact portable and verifiable.
  cleanUrls: false,
  lastUpdated: true,
  vite: {
    build: {
      target: "esnext",
    },
  },
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/installation" },
      { text: "Results", link: "/results/" },
      { text: "Reference", link: "/reference/configuration" },
      { text: "GitHub", link: "https://github.com/SomneelSaha2042/AgentDocs" },
    ],
    search: { provider: "local" },
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Overview", link: "/" },
          { text: "Installation", link: "/guide/installation" },
          { text: "Quick Start", link: "/guide/quick-start" },
          { text: "Agent Workflow", link: "/guide/agent-workflow" },
          { text: "Readiness Doctor", link: "/guide/doctor" },
          { text: "Search and MCP", link: "/guide/search-mcp" },
          { text: "Architecture and Security", link: "/guide/architecture" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
          { text: "Live Dogfood Runs", link: "/guide/live-dogfood" },
          { text: "Dogfood Workflow Matrix", link: "/guide/workflow-matrix" },
        ],
      },
      {
        text: "Results",
        items: [
          { text: "Real-World Results", link: "/results/" },
          { text: "Evaluation History", link: "/results/history" },
          { text: "Findings by Target", link: "/results/findings" },
          { text: "Candidate Expansion Metrics", link: "/results/candidate-expansion" },
          { text: "Methodology", link: "/results/methodology" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Configuration", link: "/reference/configuration" },
          { text: "CLI Commands", link: "/reference/cli" },
          { text: "Generated Artifacts", link: "/reference/artifacts" },
          { text: "Contributing and Releases", link: "/reference/contributing" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/SomneelSaha2042/AgentDocs" },
    ],
    editLink: {
      pattern: "https://github.com/SomneelSaha2042/AgentDocs/edit/master/docs/:path",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright 2026 Somneel Saha",
    },
  },
});
