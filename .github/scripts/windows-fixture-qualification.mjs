#!/usr/bin/env node
// Fixed inventory from the two reviewed snapshots and the hosted base inventory.
const groups = {
  TestCodexFixtureCLIReused: ['initial_owner'],
  TestCodexWindowsBashHookDispatcherBackground: [],
  TestCodexWindowsBashHookDispatcherContract: [],
  TestCodexWindowsBashHookDispatcherRealSessionContext: [],
  TestCodexWindowsBashHookDispatcherRuntime: ['fails_open_when_Git_Bash_cannot_be_discovered', 'missing_root_fails_open', 'rejects_unapproved_hook_names_without_output'],
  TestCodexWindowsBashHookDispatcherSurvivesConsoleEncodingMutation: [],
  TestCodexWindowsConsoleCodePagesRestoreIndependently: [],
  TestCodexWindowsEndEnvPortIsolation: [],
  TestCodexWindowsNativeUserPromptAcceptsSlashFormHomes: ['UNC_with_forward_slashes', 'drive_with_forward_slashes', 'profile_UNC_with_forward_slashes', 'profile_drive_with_forward_slashes'],
  TestCodexWindowsNativeUserPromptAdapterContract: [],
  TestCodexWindowsNativeUserPromptIgnoresInterpreterAndBinaryHijacks: [],
  TestCodexWindowsNativeUserPromptInvalidPinsFailOpenSilently: ['displaced_marker', 'malformed_JSON', 'missing_config', 'no_marker', 'non-string_JSON', 'relative_executable', 'stale_executable', 'wrong_extension'],
  TestCodexWindowsNativeUserPromptMissingPluginRootFailsOpen: [],
  TestCodexWindowsNativeUserPromptPreservesPinnedProcessIOAndExit: ['USERPROFILE_default', 'explicit_CODEX_HOME'],
  TestCodexWindowsNativeUserPromptRejectsPartialProfiles: ['blank', 'drive-relative', 'incomplete_UNC', 'relative', 'root-relative'],
  TestCodexWindowsNativeUserPromptTrustedPinForwardsInputAndMeetsTimingBudget: [],
  TestCodexWindowsNativeUserPromptUsesActiveConfigHome: ['default_despite_APPDATA', 'drive-relative_CODEX_HOME', 'explicit_CODEX_HOME', 'relative_CODEX_HOME', 'root-relative_CODEX_HOME', 'whitespace_CODEX_HOME'],
  TestCodexWindowsUserPromptManifestKeepsUnixScriptAndTimeout: [],
};
const pkg = 'github.com/Gentleman-Programming/engram/v3/plugin';
const fail = reason => { throw new Error(reason); };
function inventory(ref) {
  if (!['base', 'candidate'].includes(ref)) fail('invalid ref');
  return { ...groups, ...(ref === 'candidate' ? { TestCodexWindowsEngramPrivateCopyReused: ['first_owner', 'second_owner'] } : {}) };
}
function selector(ref) { return '^(' + Object.keys(inventory(ref)).join('|') + ')$'; }
function verify(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalid input');
  const all = inventory(data.ref), tops = Object.keys(all);
  if (data.exit !== 0 || data.listExit !== 0) fail('Go command failed');
  if (typeof data.list !== 'string' || typeof data.events !== 'string') fail('missing evidence');
  if (!data.list.endsWith('\n') || !data.events.endsWith('\n')) fail('truncated evidence');
  const lines = data.list.replaceAll('\r\n', '\n').slice(0, -1).split('\n');
  const summary = lines.pop();
  if (!new RegExp('^ok\\s+' + pkg.replaceAll('.', '\\.') + '\\s+[0-9.]+s$').test(summary)) fail('invalid list summary');
  if (lines.length !== tops.length || new Set(lines).size !== tops.length || lines.some(line => !tops.includes(line))) fail('list inventory mismatch');
  const paths = Object.entries(all).flatMap(([top, sub]) => [top, ...sub.map(name => top + '/' + name)]);
  const state = new Map(paths.map(path => [path, 'pending']));
  let packageState = 'pending';
  for (const line of data.events.replaceAll('\r\n', '\n').slice(0, -1).split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { fail('invalid JSON record'); }
    if (!e || typeof e !== 'object' || Array.isArray(e) || e.Package !== pkg || typeof e.Action !== 'string') fail('invalid package record');
    if (e.Test !== undefined && (typeof e.Test !== 'string' || !state.has(e.Test))) fail('unknown test');
    if (e.Action === 'output') {
      if (typeof e.Output !== 'string' || /no tests to run/i.test(e.Output)) fail('invalid output');
      if (packageState !== 'running' || (e.Test !== undefined && !['running', 'paused'].includes(state.get(e.Test)))) fail('output outside active execution');
      continue;
    }
    if (e.Test === undefined) {
      if (e.Action === 'start' && packageState === 'pending') packageState = 'running';
      else if (e.Action === 'pass' && packageState === 'running' && [...state.values()].every(s => s === 'passed')) packageState = 'passed';
      else fail('invalid package transition');
      continue;
    }
    if (packageState !== 'running') fail('test outside package');
    const prior = state.get(e.Test);
    if (e.Action === 'run' && prior === 'pending') state.set(e.Test, 'running');
    else if (e.Action === 'pass' && prior === 'running') state.set(e.Test, 'passed');
    else if (e.Action === 'pause' && prior === 'running') state.set(e.Test, 'paused');
    else if (e.Action === 'cont' && prior === 'paused') state.set(e.Test, 'running');
    else fail('invalid test transition');
  }
  if (packageState !== 'passed' || [...state.values()].some(s => s !== 'passed')) fail('incomplete execution');
  return { coverage: 'complete', ref: data.ref, tops: tops.length, paths: paths.length };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node windows-fixture-qualification.mjs selector base|candidate\n       node windows-fixture-qualification.mjs verify < evidence.json\nEvidence JSON: {ref, exit, listExit, list, events}. Read-only; see docs/windows-fixture-qualification.md.');
  } else if (args.length === 2 && args[0] === 'selector') console.log(selector(args[1]));
  else if (args.length === 1 && args[0] === 'verify') {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    let data;
    try { data = JSON.parse(input); } catch { fail('invalid input JSON'); }
    console.log(JSON.stringify(verify(data)));
  } else fail('invalid arguments; use --help');
}
try { await main(); } catch (error) { console.error('qualification: ' + error.message); process.exitCode = 1; }
