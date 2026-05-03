## Know CLI

The know command without any arguments will start the CLI, giving the user options of commands to choose from.

Does not have it's own logic. Strictly a way to call the different modules of the system.

Know has the following commands:

### know context

The Know systems main feature.
Return relevant rule, concept and reason data for a given symbol, glob, or path. Takes the input, queries the db for resolved links, and returns relevant rules.

### know browse

Opens the TUI, an interactive terminal user interface to browse and edit rules, concepts, and links.

### know help

List all commands

### know system-info

Information about the know cli and the know system in general.

### know init

Initialze the .know directory with its' sub-folders, and example definition files (rules.toml, links.toml, and concepts.toml).

#### flags

- overwrite - Overwrites any existing data in .know directory
- dry-run - does a dry run, printing to console instead

### know query

Execute arbitrary, read-only sql query to the local know database.

### know search

Semantic search for any rules, concepts, or (clickable) links. Returns an interactive list where user can browse relevant information, select multiple, and print selected option data to console or file.

### know validate/verify/check

Parses and validates the files in the .know directory.

### know index

Validate and parse the .know file structure, index data in local sql db (including embeddings for semantic search).

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
    - add concept
    - multi-select links
      - show dry-run or overview of result
        - y/n

- Add concept(s) to rule(s)
  - multi select rules
    - add concept
    - multi select concepts

- Add reson(s) to rule(s)
  - multi select rules
    - add reson
    - multi select resons

### know links

// TODO: does it even make sense to have links by themselves?!
// They must be connected to a rule to motivate their existance.

- Add new link
  - file path, glob or symbol
  - rule(s)
- Select existing link(s)
  - edit link
    - file path, glob or symbol
    - rule(s)
- Add link(s) to rule(s)

### know concepts

// TODO: Describe flow and options for concepts command.
