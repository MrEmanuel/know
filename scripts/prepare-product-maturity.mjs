import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  installLocalKnow,
  prepareFixtureRepo,
} from "./prepare-fixture-repo.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const repoDir = join(projectRoot, "tests", "fixtures", "product-maturity");

await prepareFixtureRepo({
  repoDir,
  resetKnowledge: "generated-only",
  gitignoreLines: [
    "node_modules/",
    ".git/",
    "package-lock.json",
    ".knowledge/indexes/",
    ".knowledge/agent-instructions.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".github/",
    ".cursor/",
  ],
  packageJson: {
    name: "product-maturity",
    private: true,
    type: "module",
    description:
      "Product-maturity fixture repo for exercising know against real code and rules.",
    scripts: {
      know: "know",
      "know:init": "know init",
      "know:init:dry-run": "know init --dry-run",
      "know:index": "know index",
      "know:status": "know status",
      "know:context:visibility": "know context src/labels/visibility.ts",
      "know:context:copy": "know context src/labels/copy.ts",
    },
  },
  readmeLines: [
    "# product-maturity",
    "",
    "Fixture repository prepared by `yarn dev:prepare:product-maturity`.",
    "",
    "Useful commands:",
    "",
    "- `npm run know:init:dry-run`",
    "- `npm run know:init`",
    "- `npm run know:index`",
    "- `npm run know:status`",
    "- `npm run know:context:visibility`",
    "- `npm run know:context:copy`",
    "",
    "This fixture contains the simple product-maturity code and knowledge files used for end-to-end testing of `know`.",
    "",
    "The local `know` package is installed from the parent repo.",
  ],
});

await mkdir(join(repoDir, "src", "labels"), { recursive: true });
await mkdir(join(repoDir, ".knowledge", "concepts"), { recursive: true });
await mkdir(join(repoDir, ".knowledge", "rules"), { recursive: true });

await writeFile(
  join(repoDir, "src", "labels", "visibility.ts"),
  [
    "export class LabelVisibility {",
    "  visibleTo(ownerId: string, viewerId: string) {",
    "    return ownerId === viewerId;",
    "  }",
    "",
    "  isHidden(label: { hidden: boolean }) {",
    "    return label.hidden;",
    "  }",
    "}",
    "",
  ].join("\n"),
);

await writeFile(
  join(repoDir, "src", "labels", "copy.ts"),
  [
    "export function copyLabel(label: { personal: boolean }, sameOwner: boolean) {",
    "  if (label.personal && !sameOwner) return undefined;",
    "  return { ...label };",
    "}",
    "",
  ].join("\n"),
);

await writeFile(
  join(repoDir, ".knowledge", "concepts", "label.md"),
  [
    "---",
    "id: concept.label",
    "title: Label",
    "related: [concept.maturity]",
    "---",
    "",
    "# Label",
    "",
    "A user-visible marker attached to items.",
    "",
  ].join("\n"),
);

await writeFile(
  join(repoDir, ".knowledge", "concepts", "maturity.md"),
  [
    "---",
    "id: concept.maturity",
    "title: Maturity",
    "---",
    "",
    "# Maturity",
    "",
    "The lifecycle state that controls how item behavior is exposed.",
    "",
  ].join("\n"),
);

await writeFile(
  join(repoDir, ".knowledge", "rules", "labels.md"),
  [
    "---",
    "concept: concept.label",
    "---",
    "",
    "# Label rules",
    "",
    "## Personal visible only to owner",
    "status: active",
    "reviewed: 2030-01-01",
    "anchors:",
    "  - symbol: LabelVisibility.visibleTo",
    "",
    "Personal labels are visible only to their owner.",
    "",
    "### Rationale",
    "",
    "Personal labels are private organization state.",
    "",
    "## Hidden labels stay hidden",
    "status: active",
    "reviewed: 2030-01-01",
    "anchors:",
    "  - symbol: LabelVisibility.isHidden",
    "",
    "Hidden labels must remain hidden everywhere.",
    "",
    "### Rationale",
    "",
    "Hidden labels support draft organization workflows.",
    "",
    "## Copy personal not followed",
    "status: active",
    "reviewed: 2030-01-01",
    "anchors:",
    "  - symbol: copyLabel",
    "",
    "Personal labels are dropped when copied across users.",
    "",
    "### Rationale",
    "",
    "Copying personal labels would expose another user's organization model.",
    "",
  ].join("\n"),
);

await installLocalKnow(repoDir, projectRoot);

console.log(`Prepared ${repoDir}`);
