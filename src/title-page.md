# The Aether Book

***

[Aether](https://github.com/AetherBrowser/aether) is the browser built by [AetherBrowser](https://github.com/AetherBrowser).
It embeds [Servo](https://servo.org), a web browser engine written in Rust, and adds the desktop shell, profile storage, and the engine hooks those features need.

Aether currently runs on:

- 64-bit Linux
- 64-bit macOS
- 64-bit Windows
- Android
- OpenHarmony

On the desktop, Aether is the [winit](https://crates.io/crates/winit) and [egui](https://crates.io/crates/egui) browser in `ports/aether`.
`./mach build` builds that port by default.
The upstream demo shell, `ports/servoshell`, is still in the tree; pass `--port=servoshell` to build it instead.

This book covers building and running Aether, contributing to it, and the architecture of the Servo engine underneath.
The engine chapters describe Servo.
[Architecture](design-documentation/architecture.md) describes `ports/aether` and the Servo components Aether changes.

**This book is a work in progress!**
In the table of contents, \* denotes chapters that were recently added or imported from older docs, and still need to be copyedited or reworked.

Contributions are always welcome.
Click the pencil button in the top right of each page to propose changes, or go to [AetherBrowser/book](https://github.com/AetherBrowser/book).

## Need help?

Open a discussion on [AetherBrowser/aether](https://github.com/AetherBrowser/aether/discussions).
