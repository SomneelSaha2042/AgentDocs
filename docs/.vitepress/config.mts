import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgentDocs",
  description: "Deterministic, local-first tooling for agent-readable documentation.",
  base: "/AgentDocs/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/installation" },
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
          { text: "Readiness Doctor", link: "/guide/doctor" },
          { text: "Search and MCP", link: "/guide/search-mcp" },
          { text: "Architecture and Security", link: "/guide/architecture" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
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
