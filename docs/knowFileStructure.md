# Know files and file structure

The Know files are stored in a .know directory in the root of the project. This directory contains all rule and concept definitions that are relevant to the project.

Definitions are documented in .toml files. Optionally, json5 could be supported in the future.

Each directory has one or many .toml definition files.
File names are arbitrary and ignored by the system.
Files in each directory are parsed for definitions that are added to the Know system.

Links are defined inline inside rule definitions. A link is the relationship between one rule and one code target.

The .know directory has one sub-directory for each source-defined primitive:

```txt
.know/
├── rules/
│ ├── labels.toml
│ ├── billing.toml
│ └── ...
└── concepts/
    ├── customer-identity.toml
    ├── billing.toml
    └── ...
```

The file structure is designed for ease of use, readability, and discoverability. Users and AI-agents can easily navigate the directory structure to find and edit the relevant definitions. The use of .toml files allows for a structured and human-readable format for defining rules, concepts, and inline rule links.

The know system will parse all files in the .know directory and build a single config model, representing the user's described system. This config model is then parsed and stored in a local SQL database, with vector embeddings for semantic search. SQLite is a generated read model: the original .toml files remain the durable source of truth and can be used to recreate the database at any time.
