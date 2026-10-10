# Running Aether

From a build of the [Aether repository](https://github.com/AetherBrowser/aether), run the desktop browser with:

```sh
$ ./target/debug/aether [url] [options]
```

Or through mach, which builds the `aether` port unless you pass `--port`:

```sh
$ ./mach run -d -- [url] [options]
$ ./aether --help
```

The profile directory defaults to `~/.config/aether`.
History is stored there as `places.sqlite`, and the chosen search engines as `search.json`.

### Enabling experimental web platform features

Servo has in-progress support for many web platform features.
Some are not complete enough to be enabled by default, but you can try them out using a preference setting.
For a list of these features and the preference used to enable them, see [Experimental features](../design-documentation/experimental-features.md).
You can enable a useful subset with `--enable-experimental-web-platform-features`.

## Keyboard shortcuts

Handled by the desktop window before the event reaches the page:

- **Ctrl**+`Q` (⌘Q on macOS) exits Aether
- **Ctrl**+`T` (⌘T on macOS) opens a new tab
- **Ctrl**+`W` (⌘W on macOS) closes the current tab
- **Alt**+`←` (⌘← on macOS) goes back
- **Alt**+`→` (⌘→ on macOS) goes forward
- **Ctrl**+`1` through **Ctrl**+`8` select a tab by position; **Ctrl**+`9` selects the last tab
- **Esc** exits fullscreen mode

## Internal pages

The location bar and the application menu open pages on the privileged `servo:` scheme:

- `servo:newtab` is the start page
- `servo:history` is the history page
- `servo:settings` is settings, including search engines at `servo:settings#search`
- `servo:processes` lists browser processes, fed by `servo:process-list`

## Troubleshooting

Aether should run on most desktop systems without extra runtime packages beyond what `./mach bootstrap` installed.
If you are on **Linux** and the browser reports that a shared library is missing, ensure that you have the following packages installed:

* `GStreamer` ≥ 1.18
* `gst-plugins-base` ≥ 1.18
* `gst-plugins-good` ≥ 1.18
* `gst-plugins-bad` ≥ 1.18
* `gst-plugins-ugly` ≥ 1.18
* `libXcursor`
* `libXrandr`
* `libXi`
* `libxkbcommon`
* `vulkan-loader`
