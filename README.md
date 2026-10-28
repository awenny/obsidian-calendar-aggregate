# Calendar Day Aggregate

An independent Obsidian calendar plugin with virtual day summaries. **Public beta 0.5.0**.

## Features

- Open a month calendar in the sidebar and click any day.
- Search the vault for Markdown notes whose basename matches the configured Moment date format.
- Search heading text matching the date (at any heading level).
- Include each heading's section up to the next heading of the same or higher level.
- Show source paths with links, and distinguish the selected day from today.
- Default to a virtual summary, without writing any file.
- Optional materialization under `Kalender/YYYY/MM/YYYY-MM-DD.md`.

## Installation

Use [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) to install this repository as a beta plugin once a GitHub release is published, or download `main.js`, `manifest.json`, `styles.css` from the release and place them in `<vault>/.obsidian/plugins/calendar-day-aggregate/`. Enable it in Community Plugins. Run **Kalender mit Tagesübersicht öffnen**.

## Development

Requires Node.js 22. Run `npm install`, `npm run check`, `npm test`, `npm run build`. Do not commit `main.js` or `node_modules`.

## Release

Update versions in `manifest.json`, `package.json`, `versions.json`, and commit a `package-lock.json` once dependencies can be installed. Commit and push to `main`. Tag the same exact version (`0.5.0`, not `v0.5.0`) and push the tag. GitHub Actions creates a **draft** release with the three installation assets; review and publish it. This is a beta; mark the GitHub release as a pre-release before publishing.

## Known limitations

- This is **not a source fork** of Liam Cain's Calendar plugin and does not replicate all of its features - but was inspired of if.
- Vault search currently scans Markdown files when a day is opened. Large vaults may be slower.
- The virtual summary is a rendered view, not an editable Markdown file.
- Materialization overwrites existing files at the generated destination: use a dedicated output folder.
- `minAppVersion` must be validated against actual supported Obsidian builds; mobile compatibility is not yet verified.
- Not tested in an automated Obsidian GUI environment.

## License

MIT
