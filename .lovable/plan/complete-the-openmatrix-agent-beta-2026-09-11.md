# Complete the OpenMatrix Agent BETA

## Goal
Finish the remaining lightweight BETA as a coherent AI app-builder upgrade without destabilizing the working streaming, multi-file preview, model, and publishing flows.

## Build sequence

### 1. Stabilize the unfinished release experience
- Fix and verify the once-per-release “What’s new” popup, including mobile layout, accessible dismissal, lazy-loaded artwork, and the `/agent/new` handoff link.
- Keep `/agent/new` as a clear product update and implementation handoff page, with correct page metadata.

### 2. Deep, dependable agent toolkit
- Expand the virtual workspace with a curated set of high-value operations rather than thousands of shallow aliases: multi-file patches, copy/move directories, dependency and import analysis, JSON/package updates, search/replace, snapshots, rollback, test scaffolding, accessibility checks, and project repair.
- Add strict path/input validation, structured tool outcomes, and activity markers for every operation.
- Update the agent instructions so models inspect first, make surgical edits, run checks, repair failures, and only then present the preview.
- Stream tool starts, progress, results, file names, and validation states immediately in the activity feed.

### 3. Preview reliability and backend-like capabilities
- Harden preview dependency loading with package/version parsing, aliases, load errors, and deterministic pinned fallbacks for common UI, data, chart, animation, and 3D packages.
- Improve project-tree synchronization so writes, renames, deletes, and streamed code blocks consistently update every file.
- Strengthen `ocDB` with serialized writes, atomic batch/transaction operations, subscriptions, and visible operation history.
- Extend the built-in preview AI bridge with clear errors and telemetry while preserving secrets on the server.

### 4. Mobile app export BETA
- Add an export flow that wraps a compatible generated web project in a Capacitor Android project.
- Generate the required package/config, Android-oriented manifest guidance, icons/splash placeholders, and a downloadable source archive.
- Clearly label this as “APK-ready source”: cloud hosting cannot run the native Android compiler, but Android Studio or a connected CI service can produce the final APK.

### 5. Community templates and pre-publish QA
- Add a polished template gallery with a focused starter set covering SaaS, dashboard, storefront, portfolio, and mobile-style app patterns.
- Support one-click remix into the builder with complete multi-file projects.
- Add automated preview captures for mobile, tablet, and desktop, plus a visual QA summary that checks rendering, overflow, runtime errors, and key viewport differences before shipping.
- Surface the QA gate in the Ship panel without blocking manual export when a user knowingly accepts warnings.

### 6. Professional AI-builder interface
- Refine the current OpenMatrix shell rather than replacing working flows: clearer app/editor/data/terminal/ship hierarchy, resizable desktop workspace, compact mobile navigation, live file focus, command palette, and consistent status language.
- Preserve the existing semantic palette and typography while removing nested-card clutter and improving small-screen fit.
- Add meaningful motion only for active agent work, file changes, checks, and completion states; respect reduced-motion preferences.

## Technical details
- Keep TanStack Start routing and server boundaries intact.
- Use the existing in-request virtual workspace; no unsafe host shell execution or secret exposure.
- Generated previews remain sandboxed and use host bridges for database and AI access.
- Use ZIP generation in the browser for exports; do not claim direct APK compilation in the hosted runtime.
- Keep provider failure behavior explicit: show the error and let the user choose another model rather than silently switching.
- Add focused automated tests for file operations, parser/project synchronization, database transactions, export contents, and QA analysis.
- Verify with the current build diagnostics and Playwright at desktop and mobile widths, capturing the popup, agent activity, preview panels, templates, QA, and mobile export screens.

## Delivery checkpoints
1. Release popup and handoff verified.
2. Toolkit and streaming activity verified.
3. Preview storage/dependencies verified.
4. Mobile export and templates verified.
5. QA capture and redesigned workspace verified.
6. Final build, runtime, and screenshot pass completed.
