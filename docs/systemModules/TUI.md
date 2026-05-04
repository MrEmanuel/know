# Know TUI

The know TUI is an interactive terminal interface for browsing and editing rules, concepts, and inline rule links. It is one of the main features of the Know system, providing a user-friendly way to interact with the defined rules and their associated data.

The TUI will call underlying modules for data retrieval, validation, and parsing as needed. It shares the same core logic and data structures as the CLI, ensuring consistency across different interfaces of the Know system.

For inspirational images of the TUI visuals, see ../images

TUI has two main modes: Browse and Edit

Browse has 3 tabs: Rules, Concepts, and Links
Rules tab is the main window.

## Code-aware browsing

The TUI uses Tree-sitter as a code-awareness layer when a supported grammar is available. This makes the terminal interface behave more like a lightweight code browser without becoming a code editor.

Tree-sitter-backed browsing can provide:

- syntax-highlighted code previews
- file outlines for classes, functions, methods, structs, interfaces, and similar symbols
- breadcrumbs for the highlighted code target
- symbol selection when authoring a new symbol link
- structural folding in code previews
- focused snippets for symbol links
- nearby symbol context for path and glob links
- repair suggestions when a symbol link no longer resolves

Path and glob links still use deterministic filesystem resolution and raw file-content fingerprints for verification. Tree-sitter improves browsing, authoring, previewing, search chunking, and repair suggestions, but it does not change the source-of-truth identity of path and glob links.

### Rules tab

Three columns:
Left: Scrollable rules list
Middle: Rule aggregated data of title, description, rationale, concepts and inline links. Concepts and links are scrollable, selectable. When highlighted, they are shown in rightmost pane.
Right: Code preview window.
When highlighting a link, the preview window shows the resolved code target and the associated link metadata.
When highlighting a concept, the concept is previewed

### Concept tab

Three columns:
Left: Scrollable concept list
Middle: Concept title and description, and associated rules. Rules are clickable, opening rules tab with that rule selected
Right: Preview of the highlighted rule (same as middle column of rules tab)

### Links tab

Three columns:
Left: Scrollable list of inline rule links (resolved paths, globs, and symbols)
Middle: Code preview windows from rules tab right column. Also a list of multiple rules to select from if they exist.
Right: Rule aggregate view from rules tab middle window
