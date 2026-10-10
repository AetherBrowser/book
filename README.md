The Aether Book
===============

Documentation for [Aether](https://github.com/AetherBrowser/aether), the browser, and for the Servo engine it embeds.

To render the book locally:

```sh
$ cargo install mdbook --vers '^0.5' --locked
$ cargo install mdbook-mermaid --vers '^0.17' --locked
$ mdbook serve --open
```

Or if you have [Nix](https://nixos.org/download/) (the package manager):

```sh
$ nix-shell --run 'mdbook serve --open'
```

**This book is a work in progress!**
In the table of contents, \* denotes chapters that were recently added or imported from older docs, and still need to be copyedited or reworked.

The engine chapters describe Servo as Aether embeds it.
Aether-specific wiring, and the Servo components it changes, are in [Architecture](src/design-documentation/architecture.md).

### Adding a new page

To add a new page to the book:

1. Create the new markdown page in the desired subdirectory of `src/`
2. Add a new link to [SUMMARY.md](https://github.com/AetherBrowser/book/blob/main/src/SUMMARY.md) with the relative path to the new file
