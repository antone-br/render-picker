# RTK - Rust Token Killer

**Usage**: Token-optimized CLI proxy (60-90% savings on dev operations)
**Version**: 1.0.1 (`C:\Users\Antone\.local\bin\rtk.exe`, ancienne version gardée en `rtk-0.42.4.exe`)

## Meta Commands (always use rtk directly)

```bash
rtk gain              # Show token savings analytics
rtk gain --history    # Show command usage history with savings (+ recent commands)
rtk discover          # Analyze Claude Code history for missed opportunities
rtk bypass <cmd>      # Execute raw command without filtering, still tracked (v1.0: replaces `rtk proxy`, alias kept)
rtk recall <hash>     # Get back the full output a filter elided (lossy filters store originals in sqlite)
rtk pipe -f <filter>  # Filter stdin (e.g. `cat out.txt | rtk pipe -f vitest`) — filters: vitest, jest, grep, find, git-log, log...
```

## Pipeline (v1.0+)

```bash
rtk verify                          # Hook integrity + filter inline tests (should PASS)
rtk pipeline status                 # Active pipeline + load problems
rtk pipeline show [rtk:posthook]    # Rules of the active pipeline (or a built-in)
rtk pipeline explain --command "git status"   # What fires for a command and why
rtk methods list                    # Compression methods (lossy / recall / cost)
rtk pipeline search                 # Shared pipelines on GitHub (topic rtk-pipeline)
```

- Active pipeline: `rtk:default` → only rewrites commands before they run (`hook.before_tool.shell`); output of non-rtk commands is NOT compressed.
- `rtk:posthook` (opt-in, `extends = "rtk:posthook"` in a pipeline file) → also compresses every tool output after it runs (lossy, recoverable via `rtk recall`). Not enabled.
- `rtk llm-proxy` / `rtk-proxy` daemon → intercepts LLM API requests. Not enabled; `proxy.request` rules stay inert.

## Installation Verification

```bash
rtk --version         # Should show: rtk 1.0.1
rtk gain              # Should work (not "command not found")
rtk verify            # Hook registered (`rtk hook claude`) + tests pass
which rtk             # Verify correct binary
```

⚠️ **Name collision**: If `rtk gain` fails, you may have reachingforthejack/rtk (Rust Type Kit) installed instead.

## Hook-Based Usage

All other commands are automatically rewritten by the Claude Code hook.
Example: `git status` → `rtk git status` (transparent, 0 tokens overhead)

If rtk breaks a command's output (JSON parse, stdin scripts like `node - < script.js`), use `rtk bypass <cmd>`.

## v1.0 breaking changes

- `rtk proxy` → `rtk bypass` (alias kept)
- `--ultra-compact` removed
- `rtk gain` headline excludes oversized outputs
- Default binary licence changed (Apache-2.0 edition: `rtk-oss`) — see https://github.com/rtk-ai/rtk/blob/master/BREAKING_CHANGES.md
- Recovery hints moved to sqlite (`rtk recall <hash>`); legacy tee files mode: `rtk config recall tee`

Repo: https://github.com/rtk-ai/rtk

Refer to CLAUDE.md for full command reference.
