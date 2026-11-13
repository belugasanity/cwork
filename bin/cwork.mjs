#!/usr/bin/env node
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { parseArgs, runtime, editorArgs, checkVersion } from '../lib/launcher.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`cwork — Codex + Neovim, in this terminal

Usage: cwork [directory] [--shell | --editor-only]
       cwork --check

No directory argument uses your current directory.
--shell        Start a shell instead of Codex in the left pane
--editor-only  Open just the editor and file browser
--check        Check local tools without opening the workspace

F1 shortcuts · F2 files · F3 find file · F4 Git changes · F5 diff · F6 Codex
Ctrl+S save · ${process.platform === 'darwin' ? 'Ctrl+Shift+Left/Right' : 'Ctrl+Left/Right'} toggle panes · F10 quit
Inside the workspace: :Shortcuts or Space h also opens the searchable reference.

First-time setup: npm run setup && npm link`);
  } else if (options.version) console.log('cwork 2.0.0');
  else {
    const tools = runtime();
    if (options.check) {
      console.log(`Neovim: ${tools.nvim ? `${checkVersion(tools.nvim)} (${tools.nvim})` : 'missing — run npm run setup'}`);
      console.log(`Codex:  ${tools.codex || 'missing — install Codex CLI or set CWORK_CODEX'}`);
      console.log(`Git:    ${tools.git || 'missing — file editing works; change review requires Git'}`);
      if (!tools.nvim || !tools.codex) process.exitCode = 1;
    } else {
      if (!fs.statSync(options.directory).isDirectory()) throw new Error('Choose a project directory.');
      if (!tools.nvim) throw new Error('Neovim is not installed. In the cwork project, run npm run setup.');
      if (!tools.codex && !options.shell && !options.editorOnly) throw new Error('Codex CLI was not found. Install it, set CWORK_CODEX to its executable, or use cwork --shell.');
      checkVersion(tools.nvim);
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run cwork directly in an interactive terminal.');
      const child = spawn(tools.nvim, editorArgs(), {
        cwd: options.directory, stdio: 'inherit',
        env: { ...process.env, NVIM_APPNAME: 'cwork', CWORK_ROOT: options.directory,
          CWORK_CODEX: tools.codex || '', CWORK_NODE: process.execPath, CWORK_MODE: options.editorOnly ? 'editor' : options.shell ? 'shell' : 'codex' },
      });
      process.on('SIGINT', () => {});
      child.on('error', error => { console.error(`cwork: ${error.message}`); process.exitCode = 1; });
      child.on('exit', code => { process.exitCode = code ?? 1; });
    }
  }
} catch (error) { console.error(`cwork: ${error.message}`); process.exitCode = 1; }
