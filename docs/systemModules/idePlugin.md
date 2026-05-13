# IDE plugin

The Know IDE plugin surfaces rules to developers as they work, providing pre-change awareness without requiring manual `know context` calls.

The plugin is a maintained part of Know. VS Code is the primary target.

## How it works

The plugin works like Git source control integration in VS Code. Git's plugin continuously checks status and shows file changes in source control, with a badge when changes exist. Know's plugin does the same for rule-code relationships:

- Monitor active files and call `know context` to retrieve applicable rules.
- Display matching rules in a dedicated panel or sidebar.
- Show a notification badge when rules connected to workspace files need re-verification.
- Refresh rule state on file save and file open.

The plugin does not own domain logic. It calls Know CLI commands (`know context`, `know status`, `know check`) and presents results in editor UX.

## Primary views

### Rules panel

A browsable list of rules that apply to active or open files. Each entry shows rule description, verification status, and link target. Selecting a rule shows full rationale and linked context.

### Verification status indicator

A badge or icon (similar to Git source control badge) that indicates:

- How many rules connected to current workspace files are unverified.
- Whether any rule-code relationships are broken.

This gives developers a persistent, low-noise signal about rule health.

### Rule details

When a rule is selected, show:

- Description and rationale.
- Linked code targets and verification status.
- Related concepts.
- Tags.

## Interaction with Know

The plugin communicates with Know through CLI commands:

- `know context <file> --format json`: retrieve rules for a file.
- `know context <file> --count`: cheap check for whether rules apply.
- `know status --format json`: overall system health.
- `know check --format json`: source-level validation.

The plugin should handle:

- Missing read model (suggest running `know index`).
- Stale read model (show warning and use existing data unless strict mode is enabled).
- Incompatible Know version (show actionable error).

## Freshness

The plugin should call `know context` on file open and file save. For continuous freshness, detect changes under `.know/` and `linkVerification.lock.toml`, then refresh views.

For repositories using `know watch`, the read model remains fresh automatically and the plugin consumes that state.

## VS Code references

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code extension guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [FileSystemWatcher API](https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher)
- [VS Code Git extension source](https://github.com/microsoft/vscode/tree/main/extensions/git)
