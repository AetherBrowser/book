# Getting Aether

Nightly builds of Aether are published as GitHub releases on [AetherBrowser/aether-nightly-builds](https://github.com/AetherBrowser/aether-nightly-builds/releases).
Each successful scheduled build is a dated release, and the latest one is also available from the links below:

- [Windows installer][windows-installer] ([sha256][windows-installer-sha256])
- [Windows ZIP][windows-zip] ([sha256][windows-zip-sha256])
- [macOS (x86)][macos-x86] ([sha256][macos-x86-sha256])
- [macOS (AArch64)][macos-aarch64] ([sha256][macos-aarch64-sha256])
- [Linux (x86)][linux-x86] ([sha256][linux-x86-sha256])
- [Linux (AArch64)][linux-aarch64] ([sha256][linux-aarch64-sha256])
- [OpenHarmony (AArch64)][openharmony-aarch64] ([sha256][openharmony-aarch64-sha256])

Older nightlies stay in that releases list, one tag per day.

To build Aether yourself, [clone the repository](../building/getting-the-code.md):

```sh
$ git clone https://github.com/AetherBrowser/aether.git
$ cd aether
$ ./mach bootstrap
$ ./mach build --release
```

The desktop binary is `target/release/aether`.
`./mach build` selects `ports/aether`.
Pass `--port=servoshell` to build the upstream Servo demo shell instead.

[windows-installer]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-windows-msvc.exe
[windows-installer-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-windows-msvc.exe.sha256
[windows-zip]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-windows-msvc.zip
[windows-zip-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-windows-msvc.zip.sha256
[macos-x86]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-apple-darwin.dmg
[macos-x86-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-apple-darwin.dmg.sha256
[macos-aarch64]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-aarch64-apple-darwin.dmg
[macos-aarch64-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-aarch64-apple-darwin.dmg.sha256
[linux-x86]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-linux-gnu.tar.gz
[linux-x86-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-x86_64-linux-gnu.tar.gz.sha256
[linux-aarch64]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-aarch64-linux-gnu.tar.gz
[linux-aarch64-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-aarch64-linux-gnu.tar.gz.sha256
[openharmony-aarch64]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-aarch64-linux-ohos.hap
[openharmony-aarch64-sha256]: https://github.com/AetherBrowser/aether-nightly-builds/releases/latest/download/aether-aarch64-linux-ohos.hap.sha256
