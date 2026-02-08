# Forking KatanOS

This guide explains how to fork, rebrand, build, and publish your own variant of KatanOS.

## 1. Fork And Clone

1. Fork this repository on GitHub.
2. Clone your fork locally:

```bash
git clone https://github.com/<your-user>/<your-fork>.git
cd <your-fork>
```

3. Point `origin` to your fork and optionally add the upstream remote:

```bash
git remote set-url origin https://github.com/<your-user>/<your-fork>.git
git remote add upstream https://github.com/Katania91/KatanOS.git
```

## 2. Rebrand Checklist

Update project identity before publishing your fork:

1. `package.json`
   - `name`
   - `description`
   - `author`
   - `build.productName`
   - `build.appId`
2. App metadata and assets
   - `metadata.json`
   - app icons in `build-resources/`
   - branding references in `README.md` and docs
3. Store/package identifiers
   - `build.appx.identityName`
   - `build.appx.publisher`
   - `build.appx.publisherDisplayName`
   - `build.appx.applicationId`
4. Website and support links
   - replace sponsor/documentation links with your own

## 3. Build Locally

Install dependencies and run:

```bash
npm ci
npm run electron:dev
```

Run tests:

```bash
npm run test
```

Create distributables:

```bash
npm run electron:build
```

## 4. Publish Your Fork

1. Push your fork to GitHub.
2. Create a release tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

3. Create a GitHub Release and upload build artifacts if needed.
4. If you use CI/CD, configure secrets and release automation in your fork.

## 5. Keep In Sync (Optional)

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## 6. Attribution And Licensing

KatanOS is licensed under Apache-2.0. If you reuse this project:

1. Keep `LICENSE` and `NOTICE` in your repository.
2. Preserve existing notices where required.
3. Clearly mark your own modifications and branding.

This guide is operational guidance, not legal advice.
