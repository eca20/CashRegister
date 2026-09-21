# App screenshots

These PNGs capture the actual production frontend with a successful response from
the Node calculation API. No mock response, generated image, or post-processing
is used. Both show USD, divisor 3, 2.12 owed, 3.00 paid, and 0.88 change.

| File                   | Browser viewport                            | Capture                              |
| ---------------------- | ------------------------------------------- | ------------------------------------ |
| `register-desktop.png` | Chromium, 1440 × 1000                       | Full page, desktop layout            |
| `register-mobile.png`  | Chromium, 390 × 844, mobile/touch emulation | Full scrollable page, stacked layout |

Both use device scale factor 1, light color scheme, reduced motion, and default
muted sound. Browser chrome and workstation details are not included. Mobile
emulation demonstrates responsive layout; it is not physical-device testing.

## Reproduce

From the repository root, install, build, and start the app:

```sh
npm ci
npm run build
npm run serve
```

In another terminal in the same directory:

```sh
npx playwright install chromium
node scripts/capture-screenshots.mjs
```

For a server on a different port, pass its base URL as the first argument:

```sh
node scripts/capture-screenshots.mjs http://127.0.0.1:3001
```

The script enters amounts through the visible keypad, waits for the expected
receipt and enabled download button, and replaces these two PNGs. No app code
or test behavior is changed. Review the images before committing updated captures.
