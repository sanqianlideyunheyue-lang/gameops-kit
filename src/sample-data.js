(function (root, factory) {
  const api = factory(root.GameOpsCore || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameOpsSamples = api;
})(globalThis, function (core) {
  function rng(seed) { return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); }
  function create(gameId) {
    const random = rng(gameId === 'puzzle' ? 20260901 : 20260902);
    const events = [];
    const start = '2026-07-01';
    const end = '2026-09-30';
    const isPuzzle = gameId === 'puzzle';
    const add = (base, date, name, stage = '', revenueType = '', revenue = 0) =>
      events.push({ ...base, event_date: date, event_name: name, stage, revenue_type: revenueType, revenue });
    for (let i = 0; i < 720; i++) {
      const installDate = core.dateAdd(start, Math.floor(random() * 64));
      const base = { game_id: gameId, player_id: `${gameId}-${String(i + 1).padStart(4, '0')}`,
        channel: random() < 0.58 ? '自然流量' : '投放', platform: random() < 0.68 ? 'Android' : 'iOS',
        version: random() < 0.49 ? '1.0' : '1.1' };
      add(base, installDate, 'install');
      let completed = false;
      for (let day = 0; day < 31; day++) {
        const date = core.dateAdd(installDate, day);
        if (date > end) break;
        const chance = day === 0 ? 1 : (completed ? 0.60 : 0.39) * Math.exp(-day / (isPuzzle ? 12 : 10)) + 0.07;
        if (random() > chance) continue;
        add(base, date, 'session_start');
        if (day === 0) {
          if (isPuzzle) {
            if (random() < 0.96) {
              add(base, date, 'tutorial_1', '1');
              if (random() < 0.86) {
                add(base, date, 'tutorial_2', '2');
                const finalRate = base.version === '1.1' && base.platform === 'Android' ? 0.49 : 0.82;
                if (random() < finalRate) { add(base, date, 'tutorial_3', '3'); completed = true; }
              }
            }
          } else {
            if (random() < 0.88) {
              add(base, date, 'score_100', '100');
              if (random() < 0.62) { add(base, date, 'score_500', '500'); completed = true; }
            }
          }
        }
        if (isPuzzle && completed && random() < 0.30) add(base, date, 'level_complete', String(1 + Math.floor(random() * 8)));
        const adCount = isPuzzle ? (random() < 0.45 ? 1 : 0) : Math.floor(random() * 4);
        for (let a = 0; a < adCount; a++) add(base, date, 'ad_impression', '', 'ads', +(0.002 + random() * 0.007).toFixed(4));
        if (isPuzzle && day > 0 && random() < 0.018) add(base, date, 'purchase', '', 'iap', 0.99);
      }
    }
    return events;
  }
  const CATALOG = {
    puzzle: { name: '关卡型小游戏', description: '新手教程、关卡推进、混合变现；包含一个预设异常，供定位练习。', funnel: ['install', 'tutorial_1', 'tutorial_2', 'tutorial_3'] },
    arcade: { name: '休闲街机小游戏', description: '分数里程碑、广告变现；用同一套指标流程分析。', funnel: ['install', 'session_start', 'score_100', 'score_500'] }
  };
  return { create, CATALOG };
});
