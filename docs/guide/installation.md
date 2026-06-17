# Installation

AgentDocs requires Node.js 20 or later. The beta is published on npm as
`@somneelsaha/agentdocs`; installing it exposes the `agentdocs` command.

## Windows PowerShell

Install Node.js from [nodejs.org](https://nodejs.org/), then run:

```powershell
npm install --global @somneelsaha/agentdocs
agentdocs --version
```

## Linux

Install Node.js 20+ using your distribution package manager or a version
manager, then run:

```bash
npm install --global @somneelsaha/agentdocs
agentdocs --version
```

## Run Without Installing

```bash
npx @somneelsaha/agentdocs@beta --help
npx @somneelsaha/agentdocs@beta --version
```

## Project-Local Install

```bash
npm install --save-dev @somneelsaha/agentdocs
npx @somneelsaha/agentdocs init
```

Beta releases use the npm `beta` dist-tag. Pin
`@somneelsaha/agentdocs@0.1.0-beta.4` when you need a reproducible
installation.

## Check The Published Package

```bash
npm view @somneelsaha/agentdocs dist-tags versions
```

`@beta` tracks the newest beta release. The package may also have a separate
`latest` tag; use `@beta` in examples until the project cuts a stable release.
