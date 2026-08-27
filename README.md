# tiki_emu

**Turn an old Android phone into a retro game console. Your guests' phones are the controllers —
they install nothing.**

*[Léeme en español](README.es.md)*

The host phone is the console: it shows the game, runs the emulator and creates its own WiFi
network. Everyone else scans a QR code, and their phone becomes a gamepad in the browser. No app to
install, no account, no internet connection.

```
   ┌─────────────────┐
   │   host phone    │   screen + server + emulator
   │   (or a laptop) │   creates its own WiFi network
   └────────┬────────┘
            │  WiFi (no internet needed)
      ┌─────┴─────┐
      ▼           ▼
  ┌───────┐   ┌───────┐
  │ phone │   │ phone │   controllers, in the browser
  └───────┘   └───────┘
```

---

## Why

Everyone has a drawer with an old phone in it. It has a decent screen, a battery, WiFi and more
computing power than any console from the era these games come from. It is not worth selling and
throwing it away is a waste.

The other half of the idea is the guests. The moment a get-together needs everybody to *install
something*, half the table drops out. A QR code and a browser have no such cost: you scan, you
choose a seat, you play. The point is a console you can carry in a pocket and set up anywhere in
under a minute — a bar table, a park bench, a hotel room — without a router, without cables and
without accounts.

It is a community project. It is not, and will not be, a commercial product.

> ### Two players, not four
>
> No web emulator available today lets you connect more than two controllers: none of them exposes
> the assignment of a multitap to a console port. This was measured, not assumed — several
> emulators and several approaches were tested before settling. The protocol was designed for four
> seats; only two are usable, so only two are shown.

---

## What you need

- **A host device**: an Android phone (Android 8 or newer), or any PC/laptop.
- **The players' phones**: any phone with a browser. Nothing to install.
- **Your own games**: this repository ships **no ROMs or BIOS files** — see [Legal](#legal).

Nobody needs an internet connection, not even the host.

---

## Install

### On an Android phone

1. Download the latest **`tiki_emu.apk`** from
   [Releases](https://github.com/rnkr69/tiki_emu/releases) and open it on the phone.
   Android will ask you to allow installing from outside the Play Store — that is normal for an
   app distributed this way.
2. Open the app and grant the permission to **create a WiFi network**. This is what lets the
   console work anywhere, with no router and no data plan.

That is the whole installation. Nothing else to set up.

### On a PC or laptop

Download the installer for your system from
[Releases](https://github.com/rnkr69/tiki_emu/releases), run it, and open the app.

> **Version 0.1.0, in testing.** Both applications work, but hardly anyone has played with them yet.
> If you are here to try them, there is a guide covering what to look at and the warnings Windows
> will show: [`TESTING.md`](TESTING.md).
>
> To run from source, see [`DEVELOPMENT.md`](DEVELOPMENT.md).

---

## Playing

1. **Put your games on the device.** For a phone, plug it into a computer over USB and drag a
   folder of ROMs across — `/sdcard/Roms` is the usual place. Then, in the lobby, tap **Game
   folder** and point it there; it is remembered from then on.

2. **Your guests scan two QR codes**, in order:
   - the first one joins their phone to the console's WiFi network;
   - the second one opens the controller in their browser.

   Guests install nothing. The controller *is* the web page.

3. **Each guest picks a seat** (player 1 or 2) and turns their phone sideways.

4. **Choose a game on the console and press Start.** Player 1 also gets Save and Load on their
   controller, and a Room screen to free a seat if somebody leaves.

**About the network name.** Android creates a temporary network whose name and password change on
every start (`AndroidShare_5195`, `AndroidShare_2775`…). That is why the QR code matters — nobody is
going to type a new password every evening. From **Android 16 onward** the app can name it itself,
and the network is called `tiki_emu`. If the manufacturer blocks hotspots or you deny the
permission, nothing breaks: the console falls back to whatever network the phone is already on, and
says so in the lobby.

> **A router will do, but the console's own hotspot is much better.** Measured on real hardware:
> over the hotspot, one-way latency is **19.9 ms at the 95th percentile**. Over a home router it
> climbs to **85.9 ms** — the difference between a game that feels right and one that does not.

---

## Adding games

The console reads a folder and works out which system each file belongs to from its extension, or
from the folder name for `.zip` files. Organising them like this is enough:

```
Roms/
  nes/
  snes/
  gb/
  gba/
  megadrive/
```

Supported systems: **NES**, **SNES**, **Game Boy / Color / Advance** and **Mega Drive / Genesis**.
The game list shows the console name, not the emulator core — «SNES» means something, «snes9x» does
not.

---

## Languages

The interface is available in **English and Spanish**, and **each device uses its own language** —
the host and the controllers are different phones belonging to different people, so a guest whose
phone is in English gets an English controller even if the console is in Spanish. It is detected
from the browser; add `?idioma=en` or `?idioma=es` to the URL to force one.

Adding a language is copying `web/js/idiomas/es.js`, translating it, and listing it in
`web/js/i18n.js`.

---

## How it works

Three pieces, and the boundary between them is the point of the design:

- **`web/`** — the console screen, the controller and the emulator page. **It does not know who is
  serving it.** Not one line mentions Node or Android. That is what lets the same interface run
  under a development server on a PC and inside the native app without a single change; the Android
  build copies the folder into its assets untouched.
- **`server-node/`** — the development server: static files, the game catalogue and the input relay.
  One dependency, `ws`.
- **`android/`** — the native app: a Ktor server inside a foreground service, a full-screen WebView,
  and the WiFi network.

### The protocol

Two WebSocket channels, deliberately split:

- **A JSON control channel** for everything that happens rarely: claiming a seat, the seat list,
  kicking, save/load, pings.
- **A 4-byte binary channel for input** — seat, button mask, sequence number. Input travels dozens
  of times a second and gets no JSON parsing, no allocation and no ordering guarantees it does not
  need: an out-of-order packet is dropped by sequence number, because a stale button state is worse
  than a missing one.

Nothing text-shaped ever crosses the protocol — only codes. The server does not know what language
the device that will display a message is in, so the wording is always chosen by whoever paints it.

### Technologies

| Piece | Choice | Why |
|---|---|---|
| Emulation | [EmulatorJS](https://emulatorjs.org) 4.2.3 (GPL-3.0), vendored | Runs libretro cores (`fceumm`, `snes9x`, `mgba`, `genesis_plus_gx`) in the browser, with no server-side work |
| Interface | Plain HTML/CSS/JS, native ES modules | No bundler, no build step, no `node_modules` on the critical path. It has to work with no internet |
| Server | Node.js + `ws` | A single dependency. Serves both development and the inside of the desktop app |
| Android app | Kotlin + [Ktor](https://ktor.io) in a `ForegroundService` | An embedded HTTP/WebSocket server that survives the screen going off |
| Desktop app | [Electron](https://electronjs.org) | Reuses the same Node server and the same interface, and installs like any other program |
| Network | `startLocalOnlyHotspot()` | A temporary network with no internet, which is exactly what is wanted: the host phone needs no data plan |
| Games | Storage Access Framework | The user picks the folder; the app never demands access to the whole filesystem |

The controller is a single multi-touch surface, not a set of buttons: the D-pad works out the
direction from where your thumb is relative to the centre, which is what makes diagonals possible.
Visual feedback fires on the local touch event and never waits for the network — waiting would *be*
the latency.

### Layout

```
web/          the interface. Immutable across phases: mentions neither Node nor Android
server-node/  development server. Only depends on ws
android/      native Android app (Kotlin + Ktor)
desktop/      Electron desktop app
roms/         your games (not distributed — see Legal)
```

Building any of it, and the development server, are covered in
[`DEVELOPMENT.md`](DEVELOPMENT.md).

---

## Status

Working and tested on real hardware: the protocol with seats and tokens, the multi-touch
controller, QR pairing, the live lobby, reconnection, kicking, on-screen latency diagnostics, the
game picker, saving and loading from the controller, and the native Android app with its own WiFi
network.

And the desktop app, which installs on a PC like any other program and takes advantage of something
the phone cannot: served from the machine itself, the emulator can use its threaded cores.

Not published yet: builds of either app. Cutting the first release is the next step. The desktop
build also still needs testing with real phones as controllers — so far the server has been tested,
not the network.

The working documentation — specification, plans, measurements — is kept in Spanish and is not part
of this repository.

---

## Legal

This repository **distributes no ROMs and no commercial BIOS files**, and none are bundled in the
Android app. Supplying your own game files, and the legality of doing so where you live, is your
responsibility.

## License

**GPL-3.0** — see [`LICENSE`](LICENSE).

This is not only a preference. EmulatorJS and the libretro cores it runs are GPL, so anything that
bundles them — the Android APK, a future desktop build — inherits that licence anyway. Here it is
adopted gladly: the project exists for the community.
