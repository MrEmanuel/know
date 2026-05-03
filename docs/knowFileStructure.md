## Know files and file structure

The Know files are stored in a .know directory in the root of the project. This directory contains all the definitions of rules, concepts, and links that are relevant to the project.

Definitions are documented in .toml files. Optionally, json5 could be supported in the future.

Each directory has one or many .toml definition files.
File names are arbitrary and ignored by the system.
Files in each directory are parsed for definitions that are added to the Know system.

The .know directory have one sub-directory for every primitive

.know/
├── rules/
│ ├── rule1.toml
│ ├── rule2.toml
│ └── ...
├── links/
│ ├── link1.toml
│ ├── link2.toml
│ └── ...
└── concepts/
├── concept1.toml
├── concept2.toml
└── ...

The file structure is designed for ease of use, readability, and discoverability. Users and AI-agents can easily navigate the directory structure to find and edit the relevant definitions. The use of .toml files allows for a structured and human-readable format for defining rules, concepts, and links.

The know system will parse all files in the .know directory and build a single config file, representing the users's described system. This config file is then parsed and stored in a local SQL database, with vector embeddings for semantic search. The original .toml files are still stored and can be referenced for source code links and other information.
