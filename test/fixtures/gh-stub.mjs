// Minimal fake `gh` for tests: repo list / auth setup-git / issue list+view / pr create.
const args = process.argv.slice(2);
if (args.length === 0) process.exit(0); // direct execution (e.g. test discovery) is a no-op
const j = o => console.log(JSON.stringify(o));
if (args[0] === 'repo' && args[1] === 'list') { j([{ nameWithOwner: 'octo/demo', description: 'Demo repo', url: 'https://github.com/octo/demo', isPrivate: true, updatedAt: '2026-10-01T00:00:00Z', defaultBranchRef: { name: 'main' } }]); process.exit(0); }
if (args[0] === 'auth' && args[1] === 'token') { console.log('test-token-never-real'); process.exit(0); }
if (args[0] === 'auth' && args[1] === 'setup-git') process.exit(0);
if (args[0] === 'issue' && args[1] === 'list') { j([{ number: 7, title: 'Fix login', url: 'https://github.com/octo/demo/issues/7', createdAt: '2026-10-02T00:00:00Z' }]); process.exit(0); }
if (args[0] === 'issue' && args[1] === 'view') { j({ title: 'Fix login', body: 'Users cannot sign in with email.', url: 'https://github.com/octo/demo/issues/7' }); process.exit(0); }
if (args[0] === 'pr' && args[1] === 'create') { console.log('https://github.com/octo/demo/pull/42'); process.exit(0); }
console.error('stub gh: unhandled', args.join(' ')); process.exit(1);
