# cwork

A quick-launch, full-screen terminal workspace: **Codex CLI on the left, Neovim on the right**, with an easy file browser and Git review. Everything stays inside the terminal you launch it from.

## Launch

After installation, in any project directory, type:

```sh
cwork
```

To open Codex's menu and choose a previous chat:

```sh
cwork resume
```

Or choose a directory:

```sh
cwork "C:\path\to\project"
# macOS / Linux:
cwork ~/Projects/my-project
```

The command uses the current directory by default. It returns to your shell when you quit. Windows Terminal, PowerShell, Command Prompt, and Unix terminals are supported; tmux and a graphical window are not required.

## Keys

| Key | Action |
| --- | --- |
| **F1** | Searchable Neovim shortcut reference |
| **F2** | File browser; press again to return to the open file |
| **Up/Down** or **j/k** | Navigate the file browser |
| **Enter** or **l** | Expand a folder or open a file |
| **h** or **Backspace** | Collapse a folder |
| **/** in browser | Filter visible filenames; empty input clears filter |
| **H** | Show/hide dotfiles |
| **F3** | Find a file anywhere in the project by part of its path |
| **F4** | Git changes; Enter opens the selected file with its diff |
| **F5** | Toggle a HEAD diff for the current file |
| **F6** | Focus Codex and resume typing in the CLI |
| **Mac: Ctrl+Shift+Left / Ctrl+Shift+Right** | Either shortcut toggles between Codex and Neovim |
| **Windows/Linux: Ctrl+Left / Ctrl+Right** | Either shortcut toggles between Codex and Neovim |
| **Ctrl+S** | Save the file, including from insert mode |
| **F10** | Quit, with confirmation and unsaved-edit choices |

The right pane switches between the browser and your file so the editor keeps its full width. A diff shows HEAD above the working file in the right pane; Codex stays on the left. Use the mouse or normal Vim window commands to resize splits.

On **macOS**, **Ctrl+Shift+Left** and **Ctrl+Shift+Right** both switch to whichever side is not focused. On **Windows and Linux**, use **Ctrl+Left** or **Ctrl+Right**. They work from Normal, Insert, and Codex terminal-input mode. Returning to Codex resumes terminal input; returning to Neovim restores its last focused pane, including a diff pane. The in-app shortcut reference and `cwork --help` show the combination for your platform.

This is real Neovim editing: **i** inserts text, **Esc** returns to normal mode, **:w** saves, **u** undoes, **Ctrl+R** redoes, **/text** searches, and **]c / [c** move between diff changes. **:bnext**, **:bprevious**, and **:ls** navigate open buffers.

Codex retains its normal terminal shortcuts. **Ctrl+\ then Ctrl+N** manually leaves terminal-input mode if you need normal Vim commands. F2/F6 are the easier shortcuts. F10 is the recommended exit; **:qa!** force-quits and discards unsaved edits.

### Viewing shortcuts

Press **F1**, type **`:Shortcuts`**, or press **Space h** in Normal mode. The reference opens in a popup and keeps your files, unsaved edits, and diff layout intact. It covers editing modes, movement, copy/paste, search/replace, files, panes, Git diffs, and Mac key alternatives.

Inside the reference, use **j/k** or the arrow keys to scroll. Press **/**, type a word such as `paste` or `save`, and press Enter to search; **n/N** move between matches. Press **q**, **Esc**, or **F1** to close it and return to the previous pane. For the complete built-in manual, use **`:help quickref`**; **`:Tutor`** starts the interactive Vim tutorial.

## Live changes

Unmodified open files reload when changed by Codex or another tool. Unsaved edits are preserved rather than overwritten. Git status and HEAD diffs refresh approximately every 1.8 seconds.

Diffs include staged and unstaged edits, plus current editor edits. They compare against HEAD, not just changes made in the current Codex session. New files have an empty baseline; deleted files retain their HEAD content. Renames appear as a deletion and an addition.

## Setup on another machine

Requires Node.js 22+, Git for change review, and a terminal with color/function-key support.

Clone the project into a permanent folder:

```sh
git clone https://github.com/belugasanity/cwork.git
cd cwork
```

### macOS (Apple Silicon and Intel)

Copy or clone the source into a permanent folder on your Mac, excluding the machine-specific `.tools/` directory. Install Node.js 22+ with npm first; if Git is missing, install Apple's Command Line Tools with `xcode-select --install`. Then, from this project folder:

```sh
sh ./install.sh
```

To create a portable source archive on the development machine, run `npm run bundle`. Transfer `artifacts/cwork-source.tar.gz` to the Mac and extract it into an empty permanent folder before installing. The bundle includes source and tests; downloaded Windows/Mac tools are excluded.

The installer selects the correct Neovim build for Apple Silicon (`arm64`) or Intel (`x86_64`), installs any missing tools locally, and writes an executable launcher to `~/.local/bin/cwork`. It does not require `sudo` or a global npm install. If that directory is not on your PATH, add this line to `~/.zshrc` and run it once in the current terminal:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Now run `cwork` inside any project directory. A custom installation prefix is supported with `sh ./install.sh --prefix /your/prefix`; the command is placed in that prefix's `bin` directory. Keep the source folder in place: the launcher points to it. To remove a user-local install, delete only `~/.local/bin/cwork` (or your custom prefix's `bin/cwork`). If you move the source or change your Node.js installation, rerun the installer to update its paths. Existing unrelated commands are never overwritten.

On Mac keyboards you may need **Fn+F2** to send F2. Pane switching uses **Ctrl+Shift+Left/Right**, leaving Ctrl+Left/Right available for macOS Spaces. If your OS or terminal intercepts the new combination, reassign the conflicting shortcut or use F2/F6. You can also use the following alternatives in Neovim normal mode:

| Shortcut | Action |
| --- | --- |
| **Space e** | Browse files |
| **Space f** | Find file |
| **Space g** | Git changes |
| **Space d** | Toggle diff |
| **Space c** | Focus Codex |
| **Space h** | View Neovim shortcuts |
| **Space q** | Quit workspace |

While typing in Codex, first press **Ctrl+\**, then **Ctrl+N**, to enter normal mode. The commands `:Files`, `:FindFile`, `:Changes`, `:Review`, and `:Codex` also work. **Ctrl+S** saves in the editor; Command+S is handled by your terminal app.

### Windows

```sh
npm run setup
npm link
```

Setup reuses Neovim 0.11+ if available, or downloads the official stable portable build into **.tools/** and verifies its SHA-256 against the GitHub release metadata. It also discovers Codex. When only a desktop-embedded Codex binary is present, setup installs a complete official CLI package locally under **.tools/codex/**. Your existing global codex command is preserved. No Neovim plugins or changes to personal editor config are needed.

The npm-linked command points to this folder, so keep this project in place. To remove an npm-linked command, run **npm unlink -g codex-workbench**. The user-local installer also works on Linux; alternatively, use the npm setup/link steps if your global npm prefix is writable.

```sh
cwork --check          # Check Neovim, Codex and Git paths
cwork --shell          # Shell on the left instead of Codex
cwork --editor-only    # Neovim and browser only
cwork --help
```

Optional executable overrides: **CWORK_NVIM** and **CWORK_CODEX**. Cwork uses an isolated Neovim configuration with swap files and shared command history disabled. If Codex needs authentication, use your usual Codex login process.

If setup reports a GitHub API rate limit while looking up the Neovim download, retry after the limit resets or supply `GH_TOKEN` / `GITHUB_TOKEN` for the release lookup. GitHub Actions passes its built-in read-only token automatically. The token is used only for GitHub API metadata requests and is not saved in the project or passed to the download host.

## Development

```sh
npm test
npm run test:editor
```

Run the editor integration test directly in an interactive terminal: Windows ConPTY needs a console even for the headless test process. Tests cover terminal input, split layout, navigation, editing/saving, filetypes, HEAD diffs, external reload, unsaved edits, and deleted/new files. There are no npm runtime dependencies in the launcher.

The GitHub Actions workflow covers Windows, Linux, Apple Silicon macOS, and Intel macOS. On Unix it also executes the installed launcher and the editor integration tests. See the [latest checks](https://github.com/belugasanity/cwork/actions) for native platform results.

The browser omits .git, node_modules, .tools, .venv, and __pycache__. Expansion is capped at 3,000 visible entries and 20 levels; file search scans up to 20,000 entries and returns up to 100 matches. Automatic opening and HEAD previews are capped at 2 MB; larger files can be opened explicitly with :edit.

