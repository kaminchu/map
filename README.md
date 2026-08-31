# Offline Map

[![CI](https://github.com/kaminchu/map/actions/workflows/ci.yml/badge.svg)](https://github.com/kaminchu/map/actions/workflows/ci.yml)

[日本語](README-jd.md)

Offline Map is a Progressive Web App for viewing Japan's Geospatial Information Authority (GSI) Standard Map online and offline. It keeps viewed map tiles in browser storage and lets you download a visible area explicitly for dependable access without a network connection.

## Features

- Browse the GSI Standard Map with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/).
- Cache viewed tiles automatically and display local tiles before checking for updates.
- Save the current map extent at a selected zoom range for offline use.
- Pause, resume, update, and remove saved-area downloads.
- Show the device's current location, accuracy, and heading when permission is granted.
- Inspect storage usage, request persistent storage, and clear temporary tiles without deleting saved areas.
- Install the app as a PWA and open the application shell while offline.

## How offline storage works

Map tiles are stored in the browser's Origin Private File System (OPFS), while tile metadata, settings, and saved-area records are stored in IndexedDB. The service worker caches only the application shell; it does not put map tiles in Cache Storage.

When a tile is requested, the app uses a locally stored copy immediately when available. If the device is online and that copy has not been checked for 24 hours, the app revalidates it in the background. Tiles belonging to saved areas are pinned, while automatically cached tiles may be removed to stay within the storage limit.

All downloaded data belongs to the browser profile and origin where it was created. Clearing site data or using browser storage-management features can remove it. Persistent storage reduces that risk when the browser grants the request, but it is not a backup.

## Requirements

For development:

- [Node.js](https://nodejs.org/) 22
- npm

For the full application experience, use a modern browser with WebGL, service workers, IndexedDB, and OPFS support. Geolocation, device orientation, persistent storage, and PWA installation depend on browser and device support. These features generally require HTTPS in production; `localhost` is treated as a secure context for local development.

Browsers without OPFS can still display the online map, but offline-area downloads and persistent tile caching are unavailable.

## Getting started

```sh
git clone https://github.com/kaminchu/map.git
cd map
npm ci
npm run dev
```

Open the local URL printed by Vite. To exercise the production build and service worker locally:

```sh
npm run build
npm run preview
```

## Using the app

1. Open **Map** while online and move or zoom to the area you need.
2. Select **Save area**, review the name and zoom range, then start the download.
3. Open **Offline maps** to monitor, pause, resume, update, or remove the download.
4. Once the download is complete, the saved tiles remain available without a network connection.

The location and heading controls request their respective browser permissions only when you use them. The interface itself is currently in Japanese.

## Development

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the Vite development server        |
| `npm run test`         | Run Vitest in watch mode                 |
| `npm run test:run`     | Run the test suite once                  |
| `npm run lint`         | Check the code with oxlint               |
| `npm run format`       | Format the code with oxfmt               |
| `npm run format:check` | Check formatting without changing files  |
| `npm run build`        | Type-check and create a production build |
| `npm run preview`      | Preview the production build locally     |

Before submitting a change, run:

```sh
npm run test:run
npm run lint
npm run format:check
npm run build
```

GitHub Actions runs the tests on pushes and pull requests. Pushes to `main` also build and deploy the site to GitHub Pages. The `BASE_PATH` environment variable can be set at build time when the app is hosted below a domain subpath.

## Technology stack

- React and TypeScript
- Vite and `vite-plugin-pwa`
- MapLibre GL JS
- Zustand, SWR, wouter, and Zod
- OPFS and IndexedDB
- Vitest, Testing Library, oxlint, and oxfmt

## Map data and attribution

This project uses the GSI Standard Map tiles provided by the Geospatial Information Authority of Japan. The map displays the required attribution. Before operating a public deployment or redistributing downloaded data, review the current [GSI tile list and terms of use](https://maps.gsi.go.jp/development/ichiran.html).

## Project documentation

The detailed requirements and implementation plan are maintained in Japanese:

- [Requirements](plans/%E8%A6%81%E4%BB%B6.md)
- [Implementation plan](plans/%E5%AE%9F%E8%A3%85%E8%A8%88%E7%94%BB.md)

## License

No license file is currently included in this repository.
