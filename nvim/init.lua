-- A self-contained terminal workspace. No plugin manager or user config changes.
local api, uv = vim.api, vim.uv
local S = { root = vim.fs.normalize(vim.env.CWORK_ROOT or uv.cwd()), expanded = {}, rows = {}, statuses = {}, nav_mode = 'files', show_hidden = true }
local focus_modifier = vim.fn.has('macunix') == 1 and 'C-S' or 'C'
S.focus_shortcut = focus_modifier == 'C-S' and 'Ctrl+Shift+Left/Right (or Ctrl+Left/Right)' or 'Ctrl+Left/Right'
_G.Cwork = S
local excluded = { ['.git'] = true, node_modules = true, ['.tools'] = true, ['.venv'] = true, __pycache__ = true }
local function join(...) return vim.fs.joinpath(...) end
local function valid(win) return win and api.nvim_win_is_valid(win) end
local function tell(message, level) vim.notify(message, level or vim.log.levels.INFO, { title = 'cwork' }) end
local function focus(win)
  vim.cmd.stopinsert()
  if valid(win) then api.nvim_set_current_win(win) end
end
local function lines(text)
  local result = vim.split(text:gsub('\r\n', '\n'), '\n', { plain = true })
  if result[#result] == '' then table.remove(result) end
  return #result > 0 and result or { '' }
end
local function write_buffer(buf, content)
  if not api.nvim_buf_is_valid(buf) then return end
  local old = api.nvim_buf_get_lines(buf, 0, -1, false)
  if vim.deep_equal(old, content) then return end
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, content)
  vim.bo[buf].modifiable = false
  vim.bo[buf].modified = false
end
local function scratch(name, filetype)
  local buf = api.nvim_create_buf(false, true)
  api.nvim_buf_set_name(buf, name)
  vim.bo[buf].bufhidden = 'hide'
  vim.bo[buf].filetype = filetype or 'cwork'
  vim.bo[buf].swapfile = false
  return buf
end
local function git(args, callback)
  local command = { 'git', '-C', S.root }
  vim.list_extend(command, args)
  local ok, error = pcall(vim.system, command, { text = true, timeout = 10000, env = { GIT_OPTIONAL_LOCKS = '0', GIT_TERMINAL_PROMPT = '0' } }, function(result)
    vim.schedule(function() callback(result) end)
  end)
  if not ok then callback({ code = 1, stdout = '', stderr = tostring(error) }) end
end

vim.opt.termguicolors = true
vim.opt.mouse = 'a'
vim.opt.number = true
vim.opt.relativenumber = false
vim.opt.signcolumn = 'yes:1'
vim.opt.splitright = true
vim.opt.splitbelow = true
vim.opt.hidden = true
vim.opt.autoread = true
vim.opt.updatetime = 250
vim.opt.timeoutlen = 400
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.scrolloff = 4
vim.opt.wrap = false
vim.opt.confirm = true
vim.opt.exrc = false
vim.opt.modeline = false
vim.opt.laststatus = 3
vim.opt.showtabline = 2
vim.opt.shortmess:append('I')
vim.g.mapleader = ' '
vim.cmd('filetype plugin indent on')
vim.cmd('syntax enable')
vim.cmd.colorscheme('habamax')
for group, value in pairs({
  Normal = { fg = '#d4d9df', bg = '#14171a' }, NormalNC = { fg = '#c3cbd2', bg = '#14171a' },
  CodexTerminal = { fg = '#eef2f5', bg = '#101317' },
  StatusLine = { fg = '#bed8c7', bg = '#27382e' }, TabLineFill = { bg = '#1c2520', fg = '#aacbb5' },
  WinSeparator = { fg = '#597361', bg = '#14171a' }, CworkDirectory = { fg = '#9ec5e8', bold = true },
  CworkHeading = { fg = '#a3e6c4', bold = true }, CworkMuted = { fg = '#788791' },
  CworkChange = { fg = '#d6ba84' }, CworkAdded = { fg = '#9bd3ac' }, CworkDeleted = { fg = '#e59b9b' },
}) do api.nvim_set_hl(0, group, value) end
-- Codex uses the terminal's ANSI colors extensively. Keep its neutral colors
-- bright enough to remain readable against the dedicated terminal background.
for index, color in pairs({
  -- Codex uses ANSI black for the editable prompt text; on cwork's dark
  -- background, map it to a readable neutral instead of near-black.
  [0] = '#eef2f5', [1] = '#f28b82', [2] = '#9bd3ac', [3] = '#f2cc8f',
  [4] = '#8ab4f8', [5] = '#d7aefb', [6] = '#8bd5ca', [7] = '#eef2f5',
  -- Codex uses bright black/dim gray for much of its explanatory text.
  -- Keep that neutral readable instead of allowing it to disappear into the background.
  [8] = '#b7c0c9', [9] = '#ffaaa3', [10] = '#b8e6c1', [11] = '#ffe0a6',
  [12] = '#a9c7ff', [13] = '#e5c6ff', [14] = '#b1eee4', [15] = '#ffffff',
}) do vim.g['terminal_color_' .. index] = color end
vim.opt.tabline = '  CWORK  |  ' .. vim.fs.basename(S.root):gsub('%%', '%%%%') .. ' %= F1 Help   F2 Files   F3 Find   F4 Changes   F5 Diff   F6 Codex   F7 Toggle  '
vim.opt.statusline = ' %{mode()}  %f %m%r %= %y  %l:%c  |  Ctrl+S Save   F10 Quit '

S.ns = api.nvim_create_namespace('cwork')
function S.render()
  if not S.nav_buf or not api.nvim_buf_is_valid(S.nav_buf) then return end
  local out, rows = {}, {}
  local function add(text, row) table.insert(out, text); rows[#out] = row end
  if S.nav_mode == 'changes' then
    add('  CHANGES FROM HEAD', { header = true })
    add('  Enter: open diff   r: refresh   F2: files', { muted = true })
    add('', {})
    if S.git_error then add('  ' .. S.git_error, { muted = true })
    elseif #S.changes == 0 then add('  Working tree is clean.', { muted = true })
    else for _, entry in ipairs(S.changes) do add('  ' .. entry.status .. '  ' .. entry.path, entry) end end
  else
    add('  FILES  ' .. vim.fs.basename(S.root), { header = true })
    add('  Enter: open / expand   h: collapse   /: filter', { muted = true })
    add('', {})
    local count = 0
    local function directory(relative, depth)
      if depth > 20 or count >= 3000 then return end
      local handle = uv.fs_scandir(join(S.root, relative))
      if not handle then return end
      local entries = {}
      while true do
        local name, kind = uv.fs_scandir_next(handle)
        if not name then break end
        if not excluded[name] and (S.show_hidden or name:sub(1, 1) ~= '.') then table.insert(entries, { name = name, directory = kind == 'directory', path = relative == '' and name or relative .. '/' .. name, depth = depth }) end
      end
      table.sort(entries, function(a, b) if a.directory ~= b.directory then return a.directory end return a.name:lower() < b.name:lower() end)
      for _, entry in ipairs(entries) do
        count = count + 1
        local open = S.expanded[entry.path]
        local status = S.statuses[entry.path]
        if not S.filter or S.filter == '' or entry.name:lower():find(S.filter:lower(), 1, true) or entry.directory then
          add(string.rep('  ', depth + 1) .. (entry.directory and (open and 'v ' or '> ') or '  ') .. entry.name .. (entry.directory and '/' or '') .. (status and '  [' .. status .. ']' or ''), entry)
        end
        if entry.directory and open then directory(entry.path, depth + 1) end
        if count >= 3000 then break end
      end
    end
    directory('', 0)
    if #out == 3 then add('  Empty folder.', { muted = true }) end
  end
  S.rows = rows
  write_buffer(S.nav_buf, out)
  api.nvim_buf_clear_namespace(S.nav_buf, S.ns, 0, -1)
  for number, row in pairs(rows) do
    local group = row.header and 'CworkHeading' or row.muted and 'CworkMuted' or row.directory and 'CworkDirectory' or row.status == 'D' and 'CworkDeleted' or row.status == 'U' and 'CworkAdded' or row.status and 'CworkChange'
    if group then api.nvim_buf_set_extmark(S.nav_buf, S.ns, number - 1, 0, { end_col = #out[number], hl_group = group }) end
  end
end

function S.close_diff()
  if valid(S.diff_win) then api.nvim_win_close(S.diff_win, true) end
  S.diff_win = nil
  if S.diff_buf and api.nvim_buf_is_valid(S.diff_buf) then api.nvim_buf_delete(S.diff_buf, { force = true }) end
  S.diff_buf = nil
  if valid(S.edit_win) then api.nvim_win_call(S.edit_win, function() vim.cmd('diffoff') end); vim.wo[S.edit_win].winbar = '' end
end
function S.open_file(relative)
  S.close_diff()
  focus(S.edit_win)
  local filename = join(S.root, relative)
  local stat = uv.fs_stat(filename)
  if stat and stat.type ~= 'file' then tell('Select a regular file.'); return end
  if stat and stat.size > 2 * 1024 * 1024 then tell('Files larger than 2 MB are not opened automatically. Use :edit to open explicitly.'); return end
  local buf = vim.fn.bufadd(filename)
  vim.fn.bufload(buf)
  api.nvim_win_set_buf(S.edit_win, buf)
  S.file_buf = buf
  S.file_path = relative
  vim.bo[buf].buflisted = true
  local ft = vim.filetype.match({ filename = filename, buf = buf })
  if ft then vim.bo[buf].filetype = ft end
  vim.wo[S.edit_win].number = true
end
function S.browser(mode)
  S.close_diff()
  if api.nvim_get_current_win() == S.edit_win and api.nvim_get_current_buf() == S.nav_buf and mode == S.nav_mode and S.file_buf and api.nvim_buf_is_valid(S.file_buf) then
    api.nvim_win_set_buf(S.edit_win, S.file_buf)
    return
  end
  S.nav_mode = mode or 'files'
  S.render()
  focus(S.edit_win)
  api.nvim_win_set_buf(S.edit_win, S.nav_buf)
  vim.wo[S.edit_win].number = false
  if #api.nvim_buf_get_lines(S.nav_buf, 0, -1, false) >= 4 then api.nvim_win_set_cursor(S.edit_win, { 4, 0 }) end
end
function S.select()
  local entry = S.rows[api.nvim_win_get_cursor(0)[1]]
  if not entry or not entry.path then return end
  if entry.directory then S.expanded[entry.path] = not S.expanded[entry.path]; S.render()
  else local review = S.nav_mode == 'changes'; S.open_file(entry.path); if review then S.diff() end end
end
function S.refresh_changes(callback)
  if S.refreshing then if callback then callback() end; return end
  S.refreshing = true
  git({ 'rev-parse', '--show-prefix' }, function(prefix_result)
    if prefix_result.code ~= 0 then
      S.git_error = 'No Git repository. File browsing and editing still work.'
      S.changes, S.statuses, S.refreshing = {}, {}, false
      S.render(); if callback then callback() end
      return
    end
    S.git_prefix = vim.trim(prefix_result.stdout)
    git({ 'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--', '.' }, function(result)
      S.refreshing = false
      if result.code ~= 0 then S.git_error = vim.trim(result.stderr or 'Git status failed.'); if callback then callback() end; return end
      S.git_error, S.changes, S.statuses = nil, {}, {}
      for _, record in ipairs(vim.split(result.stdout, '\0', { plain = true, trimempty = true })) do
        local code, relative = record:sub(1, 2), record:sub(4)
        if relative:sub(1, #S.git_prefix) == S.git_prefix then
          relative = relative:sub(#S.git_prefix + 1)
          local status = code == '??' and 'U' or code:find('U') and 'C' or code:find('D') and 'D' or code:find('A') and 'A' or 'M'
          table.insert(S.changes, { path = relative, status = status })
          S.statuses[relative] = status
        end
      end
      S.render(); if callback then callback() end
    end)
  end)
end
function S.diff(refresh_only)
  if not S.file_path or not S.file_buf or not api.nvim_buf_is_valid(S.file_buf) then if not refresh_only then tell('Open a file first. Enter on a file in F4 also opens its diff.') end; return end
  if valid(S.diff_win) and not refresh_only then S.close_diff(); return end
  local relative, file_buf = S.file_path, S.file_buf
  git({ 'show', 'HEAD:' .. (S.git_prefix or '') .. relative }, function(result)
    if S.file_buf ~= file_buf then return end
    local original = result.stdout or ''
    if result.code ~= 0 then
      if not S.statuses[relative] and not (result.stderr or ''):find("invalid object name 'HEAD'", 1, true) then if not refresh_only then tell(vim.trim(result.stderr or 'No HEAD version is available.')) end; return end
      original = ''
    end
    if #original > 2 * 1024 * 1024 or original:find('\0', 1, true) then tell('The HEAD version is binary or exceeds 2 MB.'); return end
    if not valid(S.diff_win) then
      if refresh_only then return end
      focus(S.edit_win)
      api.nvim_win_set_buf(S.edit_win, file_buf)
      vim.cmd('aboveleft split')
      S.diff_win = api.nvim_get_current_win()
      S.diff_buf = scratch('cwork://HEAD/' .. relative)
      api.nvim_win_set_buf(S.diff_win, S.diff_buf)
      vim.bo[S.diff_buf].filetype = vim.bo[file_buf].filetype
      vim.wo[S.diff_win].winbar = ' HEAD (read only)'
      vim.wo[S.edit_win].winbar = ' Working tree / editor buffer'
      api.nvim_win_call(S.diff_win, function() vim.cmd.diffthis() end)
      api.nvim_win_call(S.edit_win, function() vim.cmd.diffthis() end)
      focus(S.edit_win)
    end
    write_buffer(S.diff_buf, lines(original))
  end)
end

function S.find()
  vim.ui.input({ prompt = 'Find file (part of path): ' }, function(query)
    if not query or query == '' then return end
    local matches = {}
    -- Bounded fallback also works in plain folders. No dependency on ripgrep.
    local queue, scanned = { '' }, 0
    while #queue > 0 and scanned < 20000 and #matches < 100 do
      local relative = table.remove(queue, 1)
      local handle = uv.fs_scandir(join(S.root, relative))
      if handle then
        while true do
          local name, kind = uv.fs_scandir_next(handle)
          if not name then break end
          scanned = scanned + 1
          local item = relative == '' and name or relative .. '/' .. name
          if not excluded[name] then
            if kind == 'directory' then table.insert(queue, item)
            elseif kind == 'file' and item:lower():find(query:lower(), 1, true) then table.insert(matches, item) end
          end
          if #matches >= 100 or scanned >= 20000 then break end
        end
      end
    end
    table.sort(matches)
    if #matches == 0 then tell('No matching files.'); return end
    if #matches == 1 then S.open_file(matches[1]); return end
    vim.ui.select(matches, { prompt = 'Open file (up to 100 results)' }, function(item) if item then S.open_file(item) end end)
  end)
end
function S.codex()
  if not valid(S.term_win) then return end
  local current = api.nvim_get_current_win()
  if current ~= S.term_win and api.nvim_win_get_config(current).relative == '' then S.neovim_win = current end
  focus(S.term_win)
  vim.cmd.startinsert()
end
function S.toggle_focus()
  if not valid(S.term_win) then return end
  if api.nvim_get_current_win() == S.term_win then
    focus(valid(S.neovim_win) and S.neovim_win or S.edit_win)
  else
    if valid(S.help_win) then S.close_help(false) end
    S.codex()
  end
end
function S.close_help(restore)
  local window = S.help_win
  S.help_win = nil
  if valid(window) then api.nvim_win_close(window, true) end
  if restore ~= false and valid(S.help_return_win) then
    focus(S.help_return_win)
    if S.help_return_win == S.term_win then vim.cmd.startinsert() end
  end
end
local function help_config()
  local width = math.max(1, math.min(94, vim.o.columns - 6))
  local height = math.max(1, math.min(36, vim.o.lines - 7))
  return { relative = 'editor', width = width, height = height,
    row = math.max(0, math.floor((vim.o.lines - height - 2) / 2)),
    col = math.max(0, math.floor((vim.o.columns - width - 2) / 2)),
    style = 'minimal', border = 'rounded', title = ' Neovim shortcuts ', title_pos = 'center',
    footer = ' / search  |  n/N matches  |  q close ', footer_pos = 'center' }
end
function S.help()
  if valid(S.help_win) then S.close_help(); return end
  S.help_return_win = api.nvim_get_current_win()
  if not S.help_buf or not api.nvim_buf_is_valid(S.help_buf) then
    S.help_buf = scratch('cwork://shortcuts')
    local config_dir = vim.fs.dirname(debug.getinfo(1, 'S').source:sub(2))
    local content = dofile(join(config_dir, 'shortcuts.lua'))
    write_buffer(S.help_buf, content)
    vim.bo[S.help_buf].readonly = true
    for _, key in ipairs({ 'q', '<Esc>', '<F1>' }) do
      vim.keymap.set('n', key, S.close_help, { buffer = S.help_buf, silent = true, desc = 'Close shortcut reference' })
    end
    for index, line in ipairs(content) do
      if line:match('^[A-Z][A-Z /]+$') then
        api.nvim_buf_set_extmark(S.help_buf, S.ns, index - 1, 0, { end_col = #line, hl_group = 'CworkHeading' })
      end
    end
    api.nvim_create_autocmd('WinLeave', { buffer = S.help_buf, callback = function()
      local popup = S.help_win
      vim.schedule(function()
        if S.help_win == popup and valid(popup) and api.nvim_get_current_win() ~= popup then S.close_help(false) end
      end)
    end })
  end
  vim.cmd.stopinsert()
  S.help_win = api.nvim_open_win(S.help_buf, true, help_config())
  vim.wo[S.help_win].wrap = true
  vim.wo[S.help_win].linebreak = true
  vim.wo[S.help_win].winhighlight = 'Normal:Normal,FloatBorder:WinSeparator,FloatTitle:CworkHeading'
end
api.nvim_create_autocmd('VimResized', { callback = function()
  if valid(S.help_win) then api.nvim_win_set_config(S.help_win, help_config()) end
end })
function S.quit()
  local dirty = false
  for _, buf in ipairs(api.nvim_list_bufs()) do if vim.bo[buf].buftype == '' and vim.bo[buf].modified then dirty = true end end
  local choice = vim.fn.confirm(dirty and 'Unsaved edits. Closing also stops Codex.' or 'Close workspace and stop Codex?', dirty and '&Save and quit\n&Discard and quit\n&Cancel' or '&Quit\n&Cancel', dirty and 3 or 2)
  if choice == 0 or choice == (dirty and 3 or 2) then return end
  if dirty and choice == 1 then local ok, err = pcall(vim.cmd.wall); if not ok then tell(tostring(err)); return end end
  vim.cmd('qa!')
end

S.actions = {}
local function bind(key, fn, description)
  table.insert(S.actions, fn)
  local command = '<Cmd>lua Cwork.actions[' .. #S.actions .. ']()<CR>'
  vim.keymap.set('n', key, fn, { desc = description })
  vim.keymap.set('i', key, '<Esc>' .. command, { desc = description })
  vim.keymap.set('t', key, '<C-\\><C-n>' .. command, { desc = description })
end
bind('<F1>', S.help, 'cwork help')
bind('<F2>', function() S.browser('files') end, 'Browse files')
bind('<F3>', S.find, 'Find file')
bind('<F4>', function() S.refresh_changes(function() S.browser('changes') end) end, 'Review Git changes')
bind('<F5>', S.diff, 'Toggle HEAD diff')
bind('<F6>', S.codex, 'Focus Codex')
bind('<F7>', S.toggle_focus, 'Toggle Codex / Neovim focus')
bind('<F10>', S.quit, 'Quit workspace')
bind('<' .. focus_modifier .. '-Left>', S.toggle_focus, 'Toggle Codex / Neovim focus')
bind('<' .. focus_modifier .. '-Right>', S.toggle_focus, 'Toggle Codex / Neovim focus')
if focus_modifier == 'C-S' then
  -- Some macOS terminals discard Shift from modified arrow sequences. Keep
  -- the unshifted form available after the system Spaces shortcuts are freed.
  bind('<C-Left>', S.toggle_focus, 'Toggle Codex / Neovim focus')
  bind('<C-Right>', S.toggle_focus, 'Toggle Codex / Neovim focus')
end
for key, action in pairs({
  e = function() S.browser('files') end, f = S.find,
  g = function() S.refresh_changes(function() S.browser('changes') end) end,
  d = S.diff, c = S.codex, q = S.quit, h = S.help,
}) do vim.keymap.set('n', '<leader>' .. key, action, { desc = 'cwork action' }) end
vim.keymap.set({ 'n', 'i' }, '<C-s>', function() local ok, err = pcall(vim.cmd.write); if not ok then tell(tostring(err)) end end, { desc = 'Save file' })
api.nvim_create_user_command('Files', function() S.browser('files') end, {})
api.nvim_create_user_command('Changes', function() S.refresh_changes(function() S.browser('changes') end) end, {})
api.nvim_create_user_command('Review', S.diff, {})
api.nvim_create_user_command('Shortcuts', S.help, {})
api.nvim_create_user_command('FindFile', S.find, {})
api.nvim_create_user_command('Codex', S.codex, {})
api.nvim_create_user_command('ToggleFocus', S.toggle_focus, {})
api.nvim_create_user_command('CworkQuit', S.quit, {})

api.nvim_create_autocmd('VimEnter', { once = true, callback = function()
  S.edit_win = api.nvim_get_current_win()
  S.nav_buf = scratch('cwork://files')
  S.changes = {}
  local function navmap(key, fn) vim.keymap.set('n', key, fn, { buffer = S.nav_buf, silent = true }) end
  navmap('<CR>', S.select); navmap('l', S.select); navmap('<2-LeftMouse>', S.select)
  navmap('h', function()
    local entry = S.rows[api.nvim_win_get_cursor(0)[1]]
    if not entry or not entry.path then return end
    if S.expanded[entry.path] then S.expanded[entry.path] = nil else S.expanded[vim.fs.dirname(entry.path)] = nil end
    S.render()
  end)
  navmap('<BS>', function() api.nvim_feedkeys('h', 'm', false) end)
  navmap('H', function() S.show_hidden = not S.show_hidden; S.render() end)
  navmap('r', function() S.refresh_changes(); S.render() end)
  navmap('/', function() vim.ui.input({ prompt = 'Filter visible filenames (empty clears): ' }, function(value) if value ~= nil then S.filter = value; S.render() end end) end)
  navmap('<Esc>', function() if S.file_buf and api.nvim_buf_is_valid(S.file_buf) then api.nvim_win_set_buf(S.edit_win, S.file_buf) end end)
  S.browser('files')
  S.refresh_changes()
  if vim.env.CWORK_MODE ~= 'editor' then
    vim.cmd('topleft vsplit')
    S.term_win = api.nvim_get_current_win()
    S.term_buf = api.nvim_create_buf(false, true)
    api.nvim_win_set_buf(S.term_win, S.term_buf)
    api.nvim_win_set_width(S.term_win, math.floor(vim.o.columns * 0.50))
    vim.wo[S.term_win].number = false; vim.wo[S.term_win].signcolumn = 'no'
    vim.wo[S.term_win].winhighlight = 'Normal:CodexTerminal,NormalNC:CodexTerminal,EndOfBuffer:CodexTerminal'
    vim.wo[S.term_win].winbar = ' CODEX  |  F2 files   F6 return here'
    local command
    if vim.env.CWORK_MODE == 'shell' then command = { vim.fn.has('win32') == 1 and (vim.env.ComSpec or 'cmd.exe') or (vim.env.SHELL or '/bin/sh') }
    else
      local executable = vim.env.CWORK_CODEX or 'codex'
      -- cwork has a dark terminal background. The user's custom
      -- inspired-github theme uses near-black input text, so override the
      -- theme for this embedded Codex instance without changing ~/.codex.
      local theme_args = { '-c', 'tui.theme="dark"' }
      local codex_args = vim.env.CWORK_MODE == 'resume' and { 'resume' } or {}
      if executable:lower():match('%.js$') then
        command = { vim.env.CWORK_NODE or 'node', executable }
        vim.list_extend(command, theme_args)
        vim.list_extend(command, codex_args)
      elseif executable:lower():match('%.cmd$') or executable:lower():match('%.bat$') then
        local command_line = '""' .. executable .. '""' .. (vim.env.CWORK_MODE == 'resume' and ' resume' or '')
        command = { vim.env.ComSpec or 'cmd.exe', '/d', '/s', '/c', command_line }
      else
        command = { executable }
        vim.list_extend(command, theme_args)
        vim.list_extend(command, codex_args)
      end
    end
    -- Apple Terminal does not set COLORTERM, so the embedded Codex process
    -- can select its low-color fallback and render the prompt as black.
    local terminal_env = vim.fn.has('macunix') == 1 and {
      COLORTERM = 'truecolor',
      -- Apple Terminal and Neovim disagree about the ANSI palette used by
      -- Codex's prompt. Let the prompt inherit cwork's readable foreground.
      NO_COLOR = '1',
    } or {}
    S.job = vim.fn.jobstart(command, { term = true, cwd = S.root, env = terminal_env, on_exit = function(_, code) vim.schedule(function() tell('Terminal exited (' .. code .. '). F2 still opens your files.') end) end })
    if S.job <= 0 then tell('Unable to launch terminal process.', vim.log.levels.ERROR) else vim.cmd.startinsert() end
  end
  S.timer = uv.new_timer()
  S.timer:start(1800, 1800, vim.schedule_wrap(function()
    if S.file_buf and api.nvim_buf_is_valid(S.file_buf) and not vim.bo[S.file_buf].modified then pcall(api.nvim_buf_call, S.file_buf, function() vim.cmd('checktime') end) end
    S.refresh_changes(function() if valid(S.diff_win) then S.diff(true) end end)
  end))
end })
api.nvim_create_autocmd('TermEnter', { callback = function() vim.wo.number = false; vim.wo.relativenumber = false end })
api.nvim_create_autocmd('VimLeavePre', { callback = function() if S.timer then S.timer:stop(); S.timer:close() end end })
