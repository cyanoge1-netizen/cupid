# Architecture & Design Decisions

This document records architectural, technical, and UX design decisions made during Phase 1 development according to SPEC.md section 12.

## 1. Project Scaffolding
- **Build & Framework**: Vite 8 + React 19 + TypeScript + Tailwind CSS v3.
- **PWA Strategy**: `vite-plugin-pwa` with `injectManifest` using `src/sw.ts` to support the Web Share Target API with multipart form-data handling.
- **Routing**: In-memory tab-based routing (with URL hash / query state synchronization) to ensure seamless operation on static hosts (GitHub Pages) without 404 rewrite requirements.
- **Data Access**: Dexie 4.x managing IndexedDB tables (`people`, `partners`, `inbox`, `sendLogs`, `meta`). All data operations are strictly encapsulated in `src/db/`.
- **Localization**: Single source of truth for all user-facing strings in `src/i18n/bn.ts`.
