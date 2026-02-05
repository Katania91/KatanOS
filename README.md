# KatanOS

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-gitbook-3884FF)](https://docs.katania.me/)
[![Sponsor](https://img.shields.io/badge/sponsor-support%20this%20project-EA4AAA)](https://github.com/sponsors/katania91)

<p align="center">
  <img src="https://katania.me/images/KatanOS.webp" alt="KatanOS" width="960" />
</p>

<p align="center">
  <b>Local-first productivity desktop app built with Electron, React, and TypeScript.</b>
</p>

<p align="center">
  <a href="https://docs.katania.me/"><strong>Documentation</strong></a>
  ·
  <a href="https://katania.me/katanos"><strong>Website</strong></a>
  ·
  <a href="https://github.com/sponsors/katania91"><strong>Sponsor</strong></a>
</p>

<p align="center">
  Built to keep your life organized, not your data exposed.
</p>

## What KatanOS Is

KatanOS combines core productivity workflows into one desktop app while keeping data ownership on your machine.

## Why It Feels Different

- local-first architecture, no required backend
- desktop-native Electron bridge (`window.katanos`) for real filesystem workflows
- encrypted vault with recovery flow
- per-user backup/restore and export/import support
- modular structure designed to be forked and extended

## Modules At a Glance

- dashboard
- agenda and events
- todo and checklists
- finance tracking
- contacts
- habits
- journal
- bookshelf
- encrypted vault
- mini-games

## Project Status

This repository is published as a stable open baseline.

The original scope has been shipped. The codebase is now available for anyone who wants to fork it, extend it, or adapt it.

## Documentation

The full technical documentation lives on GitBook:

- [docs.katania.me](https://docs.katania.me/)

It covers architecture, modules, data model, Electron APIs, security, and release workflow.

## Quick Start

Run in development:

```bash
npm ci
npm run electron:dev
```

Run tests:

```bash
npm run test
```

Build desktop package:

```bash
npm run electron:build
```

## Metadata

| Key | Value |
| --- | --- |
| Version | `1.0.9` |
| App ID | `com.katanos.app` |
| Microsoft Store ID | `9NBNSBD58DNL` |

## Support

If KatanOS helped you, you can support ongoing work:

- [GitHub Sponsors](https://github.com/sponsors/katania91)
- [Ko-fi](https://ko-fi.com/katania91)

## License

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

See [LICENSE](LICENSE) for details.
