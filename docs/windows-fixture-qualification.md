# Windows fixture qualification for #2195

This auxiliary workflow compares the focused Codex Windows fixture tests on one
native Windows 2025 runner. It is **not** the full suite, a replacement for any
required check, or proof of a full-CI speedup. The existing full Windows suite,
its timeout, and the two-second assertions remain unchanged.

Only a push to `ci/2195-native-qualification-01a19147` in
`Alan-TheGentleman/engram-ci-qualification-01a19147` runs this job. The control
checkout is the pushed SHA. The source checkouts are pinned to canonical base
`7cf4ed29b6f99ffbebb5f74e2cf33819b24775c6` and candidate
`f3c247d48b217eba121bbf7e84eab132fefe13a3`. Both use Go 1.26.10,
Node 24, independent homes, temporary directories, module and build caches,
and no cache restore or publication. Each receives the same dependency download
and public Go test-list preparation before either timed execution.

The artifact contains revisions, tool/image metadata and module hashes, separate
preparation and execution durations, list output and stderr, full Go JSON and
stderr, exit codes, and verification results. Both tests are attempted after a
Go test failure; the first nonzero test exit remains the job exit. Preparation
or evidence failures also fail the job. Runner differences, execution order,
network variance and a single sample limit any timing conclusion. A successful
focused run does not certify the complete CI suite or by itself authorize merge.

## Internal verifier CLI

Run `node .github/scripts/windows-fixture-qualification.mjs --help` for usage.
`selector base` and `selector candidate` print the exact anchored Go selectors.
`verify` reads one JSON object from standard input with `ref` (`base` or
`candidate`), numeric `exit` and `listExit`, and the complete UTF-8 `list` and
`events` strings. It writes one deterministic JSON result to stdout on success;
on rejection it writes a diagnostic to stderr and exits nonzero. It never writes
input files. The fixed inventory is reviewable in the helper: 18 top-level tests
and 47 paths for base, 19 top-level tests and 50 paths for candidate, including
both named private-copy subtests. Successful Go exits, an exact public list,
exactly one run and pass for every expected test path, and one complete package
pass are mandatory. Unknown, duplicate, skipped, failed, malformed, or incomplete
records are rejected.
