# Testing guide for tiki_emu

*[Léeme en español](PRUEBAS.md)*

Thanks for helping. Nobody but the author has played this yet, so whatever you
find is new information — including "I couldn't get past step two".

**What you need:** a Windows PC or an Android phone to act as the console,
another phone to act as a controller, and some games of your own.

---

## First: the games

**None are included and we cannot send you any.** The project distributes no
ROMs; you supply your own. NES, SNES, Game Boy, Game Boy Color, Game Boy Advance
and Mega Drive files all work.

Put them in a folder, with subfolders if you like. For `.zip` files, put them in
a folder named after the console (`nes`, `snes`, `gb`, `gbc`, `gba`,
`megadrive`) — that is how the machine they belong to is worked out.

---

## On a Windows PC

1. Run `tiki_emu-0.1.0-instalador.exe`.

2. **Windows will say it does not recognise the program.** You get a blue
   "Windows protected your PC" screen: *More info* → *Run anyway*. It is not
   code-signed, and signing costs money this project does not have. It is
   expected — but if you would rather not, that is completely fair.

3. It installs for your user only, with no administrator prompt.

4. On first launch, **Windows will ask about network access**. Pay attention
   here: tick **both boxes, private and public**. If you say no, the console
   will look fine on your screen but **no phone will be able to connect**, and
   the symptom is confusing — the QR opens a page that just hangs.

5. In the console, **Games → Choose games folder**, and point it at your ROMs.

## On an Android phone

1. Install `tiki_emu-0.1.0.apk`. Android will ask permission to install from
   outside the Play Store.
2. Open it and **grant permission to create a WiFi network** — that is what
   makes it work with no router.
3. Copy your games over USB to `Internal storage → Roms`, then use **Game
   folder** in the lobby.

---

## Playing

1. Guests scan **both QR codes, in order**: the first joins their phone to the
   network, the second opens the controller.
2. Each picks a seat (1 or 2) and turns the phone sideways.
3. You pick a game on the console and press Start.

**Two players maximum.** That is not an oversight: no web emulator available
today allows more.

---

## What would help us most

You do not have to do all of this. The list above is what matters.

**Does the basic path work**

- Did you get to actually play? Where did you get stuck, if you did?
- Did your games show up, with the right console name?
- Did a game start? Try **more than one system** if you can — NES, SNES and GBA
  use different emulators and can fail independently.

**The controllers, which are the least tested part**

- Did the second phone connect? Which model, and which Android or iOS version?
- **Is there noticeable lag when you press?** This is the project's most
  important question. The controller shows some milliseconds at the top: if you
  can, tell us what you see while playing. Under 30 should feel right.
- Did the phone's screen switch off mid-game?
- Did a controller drop and come back on its own?

**Things we already suspect**

- **On PC**: whether the QR points at an address your phone cannot reach. If you
  have a VPN, Docker or virtual machines, that is a good place to look.
- **On PC**: if after 45 seconds with no controller connected a warning about
  the firewall appears, tell us whether what it said was any use.
- **On Android**: the name of the network the console creates. Below Android 16
  the system picks it (`AndroidShare_...`) and it cannot be changed.
- If the phone acting as controller **is not a recent Android**, anything odd.
  On iPhone, full screen cannot be forced, and a "turn your phone" screen stands
  in for it.

**How it looks**

- Does everything fit on your phone's screen without being cut off? Very tall
  screens and tablets are the interesting cases.
- If your phone is in English, the interface should come out in English. And
  each device uses its own language: the console in one and a controller in
  another is correct, not a bug.

---

## How to report

A message is enough. If you can, include:

- **Which devices**: model and OS of the console and of the controllers.
- **What you expected and what happened.** A screenshot or a video of the phone
  beats a description.
- If something broke outright, the exact step where it did.

And if anything confused you even though it eventually worked, say that too —
it is as useful as a bug. If you had to ask how something is done, then it is
not explained well enough.

---

## Known gaps

So you do not spend time on them:

- No code signing, hence the Windows warning.
- Two players only.
- The desktop build **has never been tested with a real phone as a controller**.
  That is literally why you are here.
- No macOS, no Linux.
- Saved games live in the console's browser storage: they do not travel between
  devices.
