---
title: "Mermaid from Markdown fences"
summary: "Mermaid diagrams can stay inside Markdown and be upgraded on the client by a small shared script."
section: "local"
integration: "mermaid"
sourceLabel: "Markdown code fences"
order: 2
---

# Mermaid in local docs

The diagram below is authored directly in Markdown.

```mermaid
flowchart LR
    A["Author Markdown"] --> B["Astro build"]
    B --> C["Static HTML pages"]
    C --> D["Client Mermaid upgrade"]
    D --> E["Rendered diagram in the terminal UI"]
```

## Notes

- No page-specific JavaScript is needed.
- The layout provides one shared client enhancement.
- The same approach works for generated Markdown pages too.

```ts
export async function getStaticPaths() {
  return entries.map((entry) => ({
    params: { slug: entry.id.split('/') },
    props: { entry }
  }));
}
```
