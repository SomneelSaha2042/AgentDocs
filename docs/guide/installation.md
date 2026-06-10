# Installation

AgentDocs requires Node.js 20 or later. The beta supports Windows and Linux
through npm.

## Windows PowerShell

Install Node.js from [nodejs.org](https://nodejs.org/), then run:

```powershell
npm install --global agentdocs
agentdocs --version
```

## Linux

Install Node.js 20+ using your distribution package manager or a version
manager, then run:

```bash
npm install --global agentdocs
agentdocs --version
```

## Run Without Installing

```bash
npx agentdocs@beta --help
```

## Project-Local Install

```bash
npm install --save-dev agentdocs
npx agentdocs init
```

Beta releases use the npm `beta` dist-tag. Pin `agentdocs@0.1.0-beta.1` when
you need a reproducible installation.
