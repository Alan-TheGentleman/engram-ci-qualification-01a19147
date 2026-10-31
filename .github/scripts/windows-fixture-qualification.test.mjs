import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cli = new URL('./windows-fixture-qualification.mjs', import.meta.url).pathname;
const pkg = 'github.com/Gentleman-Programming/engram/v3/plugin';
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
function fixture(ref = 'base') {
  const g = { ...groups, ...(ref === 'candidate' ? { TestCodexWindowsEngramPrivateCopyReused: ['first_owner', 'second_owner'] } : {}) };
  const paths = Object.entries(g).flatMap(([top, subs]) => [top, ...subs.map(sub => `${top}/${sub}`)]);
  const record = (Action, Test) => ({ Time: '2026-01-01T00:00:00Z', Action, Package: pkg, ...(Test ? { Test } : {}) });
  return { ref, exit: 0, listExit: 0, list: Object.keys(g).join('\n') + `\nok  ${pkg}  0.1s\n`,
    events: [record('start'), ...paths.flatMap(name => [record('run', name), record('pass', name)]), record('pass')].map(JSON.stringify).join('\n') + '\n' };
}
function call(args, input = '') {
  return spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8' });
}
function verify(f) { return call(['verify'], JSON.stringify(f)); }
function reject(f) {
  const before = JSON.stringify(f), r = verify(f);
  assert.equal(JSON.stringify(f), before, 'input unchanged');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^qualification: .+\n$/);
  assert.deepEqual(verify(f).stderr, r.stderr, 'deterministic error');
}
for (const ref of ['base', 'candidate']) {
  test(`${ref}: exact public list and completed JSON`, () => {
    const r = verify(fixture(ref));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    assert.deepEqual(JSON.parse(r.stdout), { coverage: 'complete', ref, tops: ref === 'base' ? 18 : 19, paths: ref === 'base' ? 47 : 50 });
  });
}
test('accept valid output and pause/resume records without changing counts', () => {
  const f = fixture();
  const event = (Action, extra = {}) => JSON.stringify({ Action, Package: pkg, Test: 'TestCodexFixtureCLIReused', ...extra }) + '\n';
  f.events = f.events.replace(/(\{"Time":"[^"]+","Action":"run","Package":"[^"]+","Test":"TestCodexFixtureCLIReused"\}\n)/,
    '$1' + event('output', { Output: 'running\n' }) + event('pause') + event('cont'));
  const result = verify(f);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { coverage: 'complete', ref: 'base', tops: 18, paths: 47 });
});
for (const [name, mutate] of Object.entries({
  'nonzero Go exit': f => f.exit = 1,
  'nonzero list exit': f => f.listExit = 1,
  'missing top-level list item': f => f.list = f.list.replace('TestCodexFixtureCLIReused\n', ''),
  'duplicate top-level list item': f => f.list = 'TestCodexFixtureCLIReused\n' + f.list,
  'unknown top-level list item': f => f.list = 'TestUnrelated\n' + f.list,
  'zero tests warning': f => f.list = '? plugin [no tests to run]\n',
  'wrong package': f => f.events = f.events.replaceAll(pkg, 'example/other'),
  'invalid JSON record': f => f.events += '{broken\n',
  'truncated JSON stream': f => f.events = f.events.slice(0, -2),
  'missing run': f => f.events = f.events.replace(/^.*"Action":"run","Package":"[^"]+","Test":"TestCodexFixtureCLIReused".*\n/m, ''),
  'missing pass': f => f.events = f.events.replace(/^.*"Action":"pass","Package":"[^"]+","Test":"TestCodexFixtureCLIReused".*\n/m, ''),
  'duplicate run': f => { const line = f.events.match(/^.*"Action":"run","Package":"[^"]+","Test":"TestCodexFixtureCLIReused".*\n/m)[0]; f.events += line; },
  'duplicate pass': f => { const line = f.events.match(/^.*"Action":"pass","Package":"[^"]+","Test":"TestCodexFixtureCLIReused".*\n/m)[0]; f.events += line; },
  'failed test': f => f.events = f.events.replace('"Action":"pass","Package":"' + pkg + '","Test"', '"Action":"fail","Package":"' + pkg + '","Test"'),
  'skipped test': f => f.events = f.events.replace('"Action":"pass","Package":"' + pkg + '","Test"', '"Action":"skip","Package":"' + pkg + '","Test"'),
  'unknown test': f => f.events = f.events.replaceAll('TestCodexFixtureCLIReused', 'TestUnrelated'),
  'missing package completion': f => f.events = f.events.replace(/\{"Time":"[^"]+","Action":"pass","Package":"[^"]+"\}\n$/, ''),
  'duplicate package completion': f => f.events += JSON.stringify({ Action: 'pass', Package: pkg }) + '\n',
  'no-tests output': f => f.events += JSON.stringify({ Action: 'output', Package: pkg, Output: 'testing: warning: no tests to run\n' }) + '\n',
  'unfinished candidate subtest': f => { Object.assign(f, fixture('candidate')); f.events = f.events.replace(/^.*"Action":"pass","Package":"[^"]+","Test":"TestCodexWindowsEngramPrivateCopyReused\/second_owner".*\n/m, ''); },
  'output after a completed test': f => { const output = JSON.stringify({ Action: 'output', Package: pkg, Test: 'TestCodexFixtureCLIReused', Output: 'late\n' }); f.events = f.events.replace(/(\{"Time":"[^"]+","Action":"pass","Package":"[^"]+","Test":"TestCodexFixtureCLIReused"\}\n)/, '$1' + output + '\n'); },
  'duplicate pause': f => { const pause = JSON.stringify({ Action: 'pause', Package: pkg, Test: 'TestCodexFixtureCLIReused' }) + '\n'; f.events = f.events.replace(/(\{"Time":"[^"]+","Action":"run","Package":"[^"]+","Test":"TestCodexFixtureCLIReused"\}\n)/, '$1' + pause + pause); },
})) {
  test(`reject ${name}`, () => { const f = fixture(); mutate(f); reject(f); });
}
test('selectors are anchored, closed and match exactly the expected top-level names', () => {
  for (const ref of ['base', 'candidate']) {
    const result = call(['selector', ref]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const selector = result.stdout.trim();
    assert.ok(selector.startsWith('^(') && selector.endsWith(')$'));
    const expression = new RegExp(selector);
    const expected = fixture(ref).list.split('\n').filter(line => line.startsWith('Test'));
    assert.ok(expected.every(name => expression.test(name)));
    assert.equal(expression.test('TestCodexWindowsNativeUserPromptSurprise'), false);
    assert.equal(expression.test('TestCodexFixtureCLIReusedExtra'), false);
    assert.equal(expression.test('TestCodexWindowsEngramPrivateCopyReused'), ref === 'candidate');
  }
  const help = call(['--help']);
  assert.equal(help.status, 0); assert.equal(help.stderr, ''); assert.match(help.stdout, /selector base\|candidate/);
});
test('reject malformed input and arguments without side effects', () => {
  for (const [args, input] of [[['verify'], '{'], [['verify', 'extra'], '{}'], [['unknown'], ''], [['verify'], '{}']]) {
    const r = call(args, input); assert.equal(r.status, 1); assert.equal(r.stdout, ''); assert.match(r.stderr, /^qualification: .+\n$/);
  }
});

const workflow = readFileSync(new URL('../workflows/windows-fixture-qualification.yml', import.meta.url), 'utf8');
for (const [name, values] of Object.entries({
  'fork-only push and isolated concurrency': ['ci/2195-native-qualification-01a19147', "github.repository == 'Alan-TheGentleman/engram-ci-qualification-01a19147'", 'github.run_id', 'github.run_attempt', 'cancel-in-progress: false'],
  'pinned immutable checkouts': ['github.sha', 'Gentleman-Programming/engram', '7cf4ed29b6f99ffbebb5f74e2cf33819b24775c6', 'dnlrsls/engram', 'f3c247d48b217eba121bbf7e84eab132fefe13a3', 'persist-credentials: false'],
  'native toolchain and read-only permissions': ['windows-2025', 'timeout-minutes: 30', 'contents: read', 'go-version: "1.26.10"', 'node-version: "24"', 'GOTOOLCHAIN: local', 'cache: false'],
  'native prerequisites': ["'usr\\bin\\bash.exe'", 'CODEX_TEST_TRUSTED_BASH', 'CODEX_TEST_TRUSTED_JQ', 'command -v bash jq curl', "(go env GOOS) -ne 'windows'", "(go env GOARCH) -ne 'amd64'"],
  'separate isolated state': ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ENGRAM_DATA_DIR', 'TEMP', 'TMP', 'TMPDIR', 'GOPATH', 'GOCACHE', 'GOMODCACHE'],
  'symmetric preparation and evidence': ['go mod download', 'go test -list', 'go test -json -count=1 -timeout=10m', 'ENGRAM_TIMING_TESTS', 'elapsed_seconds', 'listExit', 'exit $overall', 'if: ${{ always() }}'],
})) test(`workflow ${name}`, () => { for (const value of values) assert.ok(workflow.includes(value), value); });
test('workflow cannot broaden execution or mask failure', () => {
  assert.doesNotMatch(workflow, /workflow_dispatch|pull_request:|continue-on-error|secrets\.|actions\/cache|: write/);
  assert.equal((workflow.match(/uses: actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/g) ?? []).length, 3);
});
