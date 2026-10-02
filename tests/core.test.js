const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');
const samples = require('../src/sample-data.js');

test('CSV parser supports quoted commas and escaped quotes', () => {
  const parsed = core.parseCSV('game_id,player_id,event_date,event_name\n"g,1",p1,2026-09-01,"session_""start"""\n');
  assert.equal(parsed.rows[0].game_id, 'g,1');
  assert.equal(parsed.rows[0].event_name, 'session_"start"');
});

test('D1 and D7 use eligible install cohorts', () => {
  const raw = [
    ['a', '2026-09-01', 'install'], ['a', '2026-09-01', 'session_start'], ['a', '2026-09-02', 'session_start'], ['a', '2026-09-08', 'session_start'],
    ['b', '2026-09-07', 'install'], ['b', '2026-09-07', 'session_start'], ['b', '2026-09-08', 'session_start'],
    ['c', '2026-09-08', 'install'], ['c', '2026-09-08', 'session_start']
  ];
  const events = raw.map(([player_id, event_date, event_name]) => ({ game_id: 'g', player_id, event_date, event_name, channel: 'x', platform: 'Android', version: '1', revenue: 0 }));
  const result = core.analyze(events, { game: 'g', start: '2026-09-01', end: '2026-09-08' });
  assert.equal(result.installs, 3);
  assert.deepEqual(result.d1, { rate: 1, eligible: 2 });
  assert.deepEqual(result.d7, { rate: 1, eligible: 1 });
  assert.equal(result.daily.at(-1).dau, 3);
});

test('sample datasets share the same event contract and expose a diagnostic pattern', () => {
  const puzzle = samples.create('puzzle');
  const arcade = samples.create('arcade');
  assert.ok(puzzle.length > 1000 && arcade.length > 1000);
  for (const game of [puzzle, arcade]) {
    assert.ok(game.every(e => e.game_id && e.player_id && e.event_date && e.event_name));
    assert.ok(core.analyze(game, { game: game[0].game_id }).d1.eligible > 0);
  }
  const android = core.analyze(puzzle, { game: 'puzzle', platform: 'Android' });
  const v10 = core.analyze(puzzle, { game: 'puzzle', platform: 'Android', version: '1.0' });
  const v11 = core.analyze(puzzle, { game: 'puzzle', platform: 'Android', version: '1.1' });
  assert.ok(android.installs > 100);
  assert.ok(core.funnel(v10, samples.CATALOG.puzzle.funnel).at(-1).rate > core.funnel(v11, samples.CATALOG.puzzle.funnel).at(-1).rate);
});

test('normalization rejects missing fields and negative revenue', () => {
  const mapping = { game_id: 'game', player_id: 'player', event_date: 'date', event_name: 'event', revenue: 'revenue' };
  assert.throws(() => core.normalize([{ game: 'x', player: 'p', date: '2026-09-01', event: '', revenue: '0' }], mapping));
  assert.throws(() => core.normalize([{ game: 'x', player: 'p', date: '2026-09-01', event: 'session_start', revenue: '-1' }], mapping));
});
