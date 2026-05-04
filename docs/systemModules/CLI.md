# Know CLI

The `know` command without any arguments starts an interactive command selection flow.

The command interface does not own domain logic. It delegates to the underlying system modules.

Know has the following commands:

### know context

The Know systems main feature.
Return relevant rule, concept and rationale data for a given symbol, glob, or path. Takes the input, queries the generated read model for resolved links, and returns relevant rules.

### know browse

Opens the TUI, an interactive terminal user interface to browse and edit rules, concepts, and inline rule links.

### know help

List all commands

### know system-info

Information about the know cli and the know system in general.

### know init

Initialize the .know directory with its sub-folders, and example definition files. The rules example includes inline links.

#### flags

- overwrite - Overwrites any existing data in .know directory
- dry-run - does a dry run, printing to console instead

### know query

Execute a read-only query against the generated read model. This is primarily a diagnostic and power-user command.

### know search

Semantic search for any rules, concepts, or (clickable) links. Returns an interactive list where user can browse relevant information, select multiple, and print selected option data to console or file.

### know validate/verify/check

Parses and validates the files in the .know directory.

### know index

Validate and parse the .know file structure, then update the generated read model and semantic search index.

### know sync/watch

Automatically index .know files when they change.

### know rules

Add or edit rules. id, descriptions, links, and concepts.

Options shown:

- Add new rule
- Select existing rule
- Add link(s) to rule(s)
- Add concept(s) to rule(s)
- Add reason(s) to rule(s)

Option descriptions:

- Add new rule
  - rule-id
  - description
  - insert concept(s)
    - Add new
    - Select existing (multi select)
  - insert reason(s)
    - Add new
    - Select existing (multi select)

- Select existing rule
  - edit rule-id
  - edit description
  - edit concept(s)
    - Add new
    - Edit existing
  - edit reason(s)
    - Add new
    - Edit existing

- Add links(s) to rule(s)
  - multi select rules
    - add inline link
    - path, glob, or symbol target
    - link kind
      - show dry-run or overview of result
        - y/n

- Add concept(s) to rule(s)
  - multi select rules
    - add concept
    - multi select concepts

- Add reason(s) to rule(s)
  - multi select rules
    - add reason
    - multi select reasons

### know links

Manage inline rule links. A link cannot exist without an owning rule.

- Add new link
  - select owning rule
  - file path, glob or symbol
  - link kind
- Select existing rule link(s)
  - edit link
    - file path, glob or symbol
    - link kind
    - tags
  - verify or re-verify link
- Add link(s) to rule(s)

### know concepts

// TODO: Describe flow and options for concepts command.
