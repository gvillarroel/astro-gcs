---
title: "Nested local Markdown"
summary: "A local folder tree under src/content can become static routes with almost no page-specific code."
section: "local"
integration: "markdown"
sourceLabel: "src/content/integrations/local"
order: 1
---

# Local Markdown routed by Astro

This page lives inside a nested content folder and is rendered through the same layout as every generated integration page.

## Why this pattern works

- Astro can statically route nested Markdown entries from `src/content`.
- The page shell stays in Astro components, while content authors keep writing Markdown.
- The file structure becomes the URL structure.

## Useful Markdown features

> Keep the layout and navigation in Astro. Keep the actual documentation in Markdown.

| Feature | Example |
| --- | --- |
| Task lists | `- [x]` and `- [ ]` |
| Tables | Native GFM tables |
| Fenced code | Language-aware code blocks |
| Nested routes | Folder names become path segments |

- [x] Static route generation
- [x] Shared layout
- [x] Shared navigation
- [ ] Live source refresh without rebuilding

Continue to the Mermaid example to see diagrams rendered from Markdown code fences.
