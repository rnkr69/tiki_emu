# Development

*[Léeme en español](DESARROLLO.md)*

How to run tiki_emu from source, and how to build the applications. None of this is needed to
**use** the console — for that, see the downloads in the [README](README.md).

It is needed right now, though, because no release has been published yet.

---

## The development server

The quickest way to see the console running. Needs [Node.js](https://nodejs.org) 18 or newer.

```sh
cd server-node
npm install      # one dependency: ws
node server.js
```

- **Console** (the screen): open `http://localhost:8080/`
- **Controllers**: `http://<this-machine-ip>:8080/pad.html` — the server prints the URLs on start,
  and the console shows them as a QR code.

Put your games in the `roms/` folder, or point the `ROMS_EXTRA` environment variable at another
folder.

The console needs you to press **Start**: browsers block audio until the user has interacted with
the page.

Controllers have to be on the same network as the machine. Without the app's hotspot, latency is
whatever your router gives you: a home router measured 85.9 ms one-way against the hotspot's
19.9 ms.

To check the interface in the other language without changing your system language, add
`?idioma=en` or `?idioma=es` to the URL.

---

## Building the Android app

Needs the Android SDK (installing Android Studio is the easy way — it bundles it) and a phone with
USB debugging enabled.

```sh
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` points at each machine's SDK and is not versioned. If it is missing, create it
with:

```
sdk.dir=C:/Users/your-user/AppData/Local/Android/Sdk
```

With forward slashes: in a `.properties` file backslashes are escapes, and a path containing `\U`
fails with a cryptic "Invalid file path".

How the app is put together — the hotspot, how it reads ROMs, the traps found along the way — is in
[`android/README.md`](android/README.md) (in Spanish).

---

## Building the desktop app

Needs [Node.js](https://nodejs.org) 18 or newer.

```sh
cd desktop
npm install
npm start          # run unpackaged, for development
npm run dist       # build the installer into paquete/desktop/
```

`npm start` uses the repository's own `web/` and `roms/`, so changes show up on
reload (F5).

### How it is put together

The server does **not** run alongside the window, but in its own process
(Electron's `utilityProcess`). Its disk I/O is synchronous — walking a games
folder is hundreds of blocking calls — and in the main process that would freeze
the interface. With 6000 files it takes 161 ms and the window never notices.

That also matches Android, for the same reason: whoever serves has no window, so
when a folder picker is needed it asks whoever does.

```
main.js  ──{arrancar}──►  servidor-proceso.js
         ◄──{listo|error}─
         ◄──{pedir-carpeta}─      (the host pressed the button)
         ──{carpeta}──►           (re-indexes and announces the catalogue)
```

The window loads `http://127.0.0.1` and talks to the server over the same
WebSocket any browser would use: no preload, no IPC, and not one Electron API
within reach of the page. `web/` still does not know who is serving it.

### What the desktop has and the phone does not

`127.0.0.1` is a secure context, so with the `COOP`/`COEP` headers the browser
exposes `SharedArrayBuffer` and EmulatorJS can use the **threaded cores**. It is
advertised as one more capability, and only when all four variants of every core
are present: asking for threads when one is missing does not degrade, it
**aborts the game** (`emulator.js:535`).

### When packaging

- **`web/` and `server-node/` sit next to the executable, not inside the asar.**
  electron-builder's `files` patterns cannot reach outside the app directory,
  and this way `../server-node/servidor.js` resolves the same packaged as in
  development, because `app.asar/..` is that same folder.
- **`ws` is named as its own source**: electron-builder drops any `node_modules`
  it meets while walking an extra resource.
- **`roms/` is not packaged.** The project distributes no games, and copying the
  builder's own folder would put their ROMs in the installer. The app creates
  the empty folder on first run.
- **There is no code signing**, so SmartScreen will say "unknown publisher" the
  first time someone runs the installer. A certificate costs money and this is a
  community project.

### The firewall

This is the biggest risk in the desktop build. Windows asks about network access
on first run and ticks only "private networks"; a phone hotspot is usually
classified as public. If it is denied, the console works perfectly on
`127.0.0.1` and **no phone ever reaches it** — a QR code that opens a page that
never loads, indistinguishable from a broken program.

The rule cannot be queried without administrator rights, so it is inferred from
absence: console open, 45 seconds, not one controller. Only controllers from
**other devices** count: one opened in a browser on this same machine arrives
over loopback without touching the network and proves nothing.

---

## Termux, on a phone without installing the app

**This was the proof of concept, not a product.** It is how the idea was shown to work before the
Android app existed, and it stays because it is still useful for developing directly on the phone.
If you just want to play, install the app.

1. Install **Termux** from [F-Droid](https://f-droid.org/packages/com.termux/) or GitHub Releases —
   the Play Store build is abandoned and will not work.
2. `pkg install nodejs`
3. Copy the project over, then `cd server-node && npm i ws`
4. Settings → Apps → Termux → Battery → **Unrestricted**, or Android will kill the server the
   moment you leave the app.
5. `termux-setup-storage` once, so Termux can see `~/storage/shared`. Without it, the games folder
   in the phone's normal storage does not exist.
6. `termux-wake-lock && node server.js`
7. Turn on the phone's hotspot and have the controllers join it.

`scripts/arrancar.sh` and `scripts/parar.sh` are meant for a Termux:Widget shortcut, so that
starting the console is a single tap.

---

## Measuring latency

The controller shows two numbers in its top bar, and the console repeats all of them in its
diagnostics overlay:

- **`ida p95`** — half the controller ↔ server RTT. **This is the number that decides**: the
  project's criterion is that it stays below 30 ms.
- **`rtt`** — mean round trip to the server.
- **`host`** — the full round trip: controller → server → console browser → back. If this number
  spikes but `rtt` does not, the problem is inside the host device, not on the WiFi.

---

## Things worth knowing before touching the code

**`web/` does not know who is serving it.** This is the rule everything else rests on: not one line
in that folder mentions Node, Android or Electron. It is what lets the same interface run under the
development server, inside the APK and inside the desktop app with no variants. If something needs
to know who is serving, it asks the server (`capacidades` in the welcome message) rather than
branching in the client.

**The only file coupled to the emulator is `web/js/input-bus.js`.** Swapping emulators should mean
rewriting that file and nothing else.

**Only codes cross the protocol, never sentences.** The server does not know what language the
device that will display a message is in — the host and each controller can be in different
languages — so the wording is always chosen by whoever paints it.

**Interface text goes by key.** What is written in the HTML is marked with `data-i18n`; what is
built from JavaScript calls `t()`. Adding a language means copying `web/js/idiomas/es.js`,
translating it and listing it in `web/js/i18n.js`.

**Uppercase in the interface is styling**, and lives in CSS as `text-transform`. Writing it into the
source forces the translator to decide it language by language.

Note that the codebase is written in Spanish — identifiers, comments and commit messages.

---

## EmulatorJS

Vendored in `web/vendor/emulatorjs/` (v4.2.3, GPL-3.0, with its own `LICENSE`) rather than fetched
at runtime: the console has to work with no internet. Some pieces missing from the tagged source are
included by hand:

- `data/emulator.min.js` and `.min.css`, without which EmulatorJS falls back to an emergency mode
  that downloads from its CDN.
- All four variants of each core (normal, `legacy`, `thread`, `thread-legacy`). It picks one
  depending on WebGL2 and SharedArrayBuffer; over plain HTTP, which is not a secure context, it uses
  the `legacy` one.
- `data/cores/reports/*.json`, needed for the core cache.

Verified with DevTools: served from a LAN IP it makes no external request at all. Only on
`localhost` does it ask `cdn.emulatorjs.org/stable/data/version.json` to check for updates; with no
internet that fails without blocking anything.

Its virtual gamepad is disabled with `EJS_defaultOptions = { 'virtual-gamepad': 'disabled' }`, and
its menu bar with a CSS rule: the `menu-bar-button: hidden` option is not enough, because it is a
default the user can revert and that EmulatorJS remembers.
