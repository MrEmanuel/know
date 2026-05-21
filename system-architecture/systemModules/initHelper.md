# init helper

This module initializes the .know directory with its sub-folders, and example definition files.

`know init` creates:

```txt
.know/
├── rules/
├── concepts/
├── linkVerification.toml
├── linkVerification.lock.toml
├── .gitignore
└── cache/
```

`.know/.gitignore` ignores `cache/` so generated read-model and semantic-index files are not committed. The source TOML files, `.know/linkVerification.toml`, and `.know/linkVerification.lock.toml` are intended to be committed.
