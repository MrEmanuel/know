## Know TUI

The know TUI is an interactive terminal user interface built with Ratatui, allowing users to browse and edit rules, concepts, and links in an interactive way. It is one of the main features of the Know system, providing a user-friendly way to interact with the defined rules and their associated data.

The TUI will call underlying modules for data retrieval, validation, and parsing as needed. It shares the same core logic and data structures as the CLI, ensuring consistency across different interfaces of the Know system.

For inspirational images of the TUI visuals, see ../images

TUI has two main modes: Browse and Edit

Browse has 3 tabs: Rules, Concepts, and Links
Rules tab is the main window.

### Rules tab

Three columns:
Left: Scrollable rules list
Middle: Rule aggregated data of title, descriptions, concepts and links. Concepts and links are scrollable, selectable. When highligted, they are shown in rightmost pane.
Right: Code preview window.
When highligting a link, preview window show code and reference to the associated link, preview of
When highlighting a concept, the concept is previewed

### Concept tab

Three columns:
Left: Scrollale concept list
Middle: Concept title and description, and associated rules. Rules are clickable, opening rules tab with that rule selected
Right: Preview of the highligted rule (same as middle column of rules tab)

### Links tab

Three columns:
Left: Scrollable list of links (resolved glob/symbols)
Middle: Code preview windows from rules tab right column. Also a list of multiple rules to select from if they exist.
Right: Rule aggregate view from rules tab middle window
