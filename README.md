# KatanOS

Local-first productivity desktop app built with Electron, React, and TypeScript.

## Quick Links

- [Install (Microsoft Store)](https://apps.microsoft.com/detail/9NBNSBD58DNL)
- [Docs](https://docs.katania.me)
- [Forking](FORKING.md)
- [Cite/Attribution](CITATION.cff)

Fork-friendly: feel free to rebrand and ship your own version. Please keep [LICENSE](LICENSE) and [NOTICE](NOTICE); [CITATION.cff](CITATION.cff) is provided for attribution.

## Support

If you find KatanOS useful, you can sponsor the project.

- [GitHub Sponsors](https://github.com/sponsors/Katania91)
- Monthly: $5 Supporter - helps cover code signing / CI / maintenance
- Monthly: $25 Backer - optional name listed in [BACKERS.md](BACKERS.md)
- One-time: $10 Tip Jar - thank you
- One-time: $50 Backer - optional name listed in [BACKERS.md](BACKERS.md)
- One-time: $200 Sponsor - optional company name listed in [BACKERS.md](BACKERS.md)

No support SLA; sponsorship is a donation.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
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

## Forking

If you want to create your own branded variant, see [FORKING.md](FORKING.md) for rebrand, build, and publish steps.

## Contributing

For contributions and collaboration flow, see [CONTRIBUTING.md](CONTRIBUTING.md).

For issue filing, use the templates:

- [Bug report template](.github/ISSUE_TEMPLATE/bug_report.yml)
- [Feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)

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

## License

Apache License 2.0.

See [LICENSE](LICENSE) for details.

## Attribution

If you reuse this project, keep [LICENSE](LICENSE) and [NOTICE](NOTICE) intact and, if possible, credit the author in your About page or documentation.

This is a social norm, not an additional legal requirement beyond Apache-2.0.
