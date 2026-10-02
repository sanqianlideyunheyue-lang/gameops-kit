(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameOpsCore = api;
})(globalThis, function () {
  const DAY = 86400000;
  const REQUIRED = ['game_id', 'player_id', 'event_date', 'event_name'];
  const OPTIONAL = ['channel', 'platform', 'version', 'stage', 'revenue_type', 'revenue'];

  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); if (row.some(x => x !== '')) rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (quoted) throw new Error('CSV 引号未闭合');
    row.push(cell); if (row.some(x => x !== '')) rows.push(row);
    if (rows.length < 2) throw new Error('CSV 至少需要表头和一行数据');
    const headers = rows.shift().map(x => x.trim());
    if (new Set(headers).size !== headers.length) throw new Error('CSV 表头存在重复列名');
    return { headers, rows: rows.map((values, index) => {
      if (values.length !== headers.length) throw new Error(`第 ${index + 2} 行的列数与表头不符`);
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    }) };
  }

  function normalize(rows, mapping) {
    for (const field of REQUIRED) if (!mapping[field]) throw new Error(`请映射必填字段：${field}`);
    const events = rows.map((row, i) => {
      const get = key => mapping[key] ? String(row[mapping[key]] ?? '').trim() : '';
      const event = Object.fromEntries([...REQUIRED, ...OPTIONAL].map(key => [key, get(key)]));
      if (REQUIRED.some(key => !event[key])) throw new Error(`第 ${i + 2} 行缺少必填值`);
      const date = event.event_date.slice(0, 10);
      const parsedDate = new Date(date + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error(`第 ${i + 2} 行日期无效`);
      event.event_date = date;
      event.revenue = event.revenue === '' ? 0 : Number(event.revenue);
      if (!Number.isFinite(event.revenue) || event.revenue < 0) throw new Error(`第 ${i + 2} 行收入无效`);
      return event;
    });
    if (!events.some(e => e.event_name === 'session_start')) throw new Error('至少需要一个 session_start 事件以计算活跃与留存');
    return events;
  }

  const dateAdd = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const dateDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / DAY);
  const pct = (n, d) => d ? n / d : null;

  function prepare(events, filters = {}) {
    const byGame = events.filter(e => !filters.game || e.game_id === filters.game);
    const players = new Map();
    for (const e of byGame) {
      const key = e.game_id + '\u0000' + e.player_id;
      const existing = players.get(key);
      if (!existing || e.event_date < existing.install_date || (e.event_date === existing.install_date && e.event_name === 'install')) {
        players.set(key, { key, game_id: e.game_id, player_id: e.player_id, install_date: e.event_date,
          channel: e.channel || '未标记', platform: e.platform || '未标记', version: e.version || '未标记' });
      }
    }
    const filteredPlayers = [...players.values()].filter(p =>
      (!filters.channel || p.channel === filters.channel) &&
      (!filters.platform || p.platform === filters.platform) &&
      (!filters.version || p.version === filters.version));
    const keys = new Set(filteredPlayers.map(p => p.key));
    return { players: filteredPlayers, events: byGame.filter(e => keys.has(e.game_id + '\u0000' + e.player_id)) };
  }

  function analyze(events, filters = {}) {
    const { players, events: selected } = prepare(events, filters);
    const dates = selected.map(e => e.event_date).sort();
    const start = filters.start || dates[0] || '';
    const end = filters.end || dates.at(-1) || '';
    if (start && end && start > end) throw new Error('开始日期不能晚于结束日期');
    const windowEvents = selected.filter(e => e.event_date >= start && e.event_date <= end);
    const cohort = players.filter(p => p.install_date >= start && p.install_date <= end);
    const active = new Map();
    for (const e of selected) if (e.event_name === 'session_start') {
      const key = e.game_id + '\u0000' + e.player_id;
      if (!active.has(key)) active.set(key, new Set());
      active.get(key).add(e.event_date);
    }
    const retention = day => {
      const eligible = cohort.filter(p => dateAdd(p.install_date, day) <= end);
      return { rate: pct(eligible.filter(p => active.get(p.key)?.has(dateAdd(p.install_date, day))).length, eligible.length), eligible: eligible.length };
    };
    if (start && end && dateDiff(end, start) > 1825) throw new Error('单次分析范围请控制在 5 年以内');
    const dailyMap = new Map();
    for (const e of windowEvents) {
      if (!dailyMap.has(e.event_date)) dailyMap.set(e.event_date, { active: new Set(), revenue: 0 });
      const entry = dailyMap.get(e.event_date);
      if (e.event_name === 'session_start') entry.active.add(e.game_id + '\u0000' + e.player_id);
      entry.revenue += e.revenue;
    }
    const installCounts = new Map();
    for (const p of cohort) installCounts.set(p.install_date, (installCounts.get(p.install_date) || 0) + 1);
    const daily = [];
    if (start && end) for (let date = start; date <= end; date = dateAdd(date, 1)) {
      const entry = dailyMap.get(date);
      daily.push({ date, dau: entry?.active.size || 0, installs: installCounts.get(date) || 0, revenue: entry?.revenue || 0 });
    }
    const activeUsers = new Set(windowEvents.filter(e => e.event_name === 'session_start').map(e => e.game_id + '\u0000' + e.player_id)).size;
    const revenue = windowEvents.reduce((sum, e) => sum + e.revenue, 0);
    return { start, end, players, events: selected, windowEvents, cohort, active, daily,
      installs: cohort.length, activeUsers, revenue, d1: retention(1), d7: retention(7),
      avgDau: daily.length ? daily.reduce((sum, x) => sum + x.dau, 0) / daily.length : 0 };
  }

  function funnel(result, steps) {
    const byPlayer = new Map();
    for (const e of result.events) {
      const key = e.game_id + '\u0000' + e.player_id;
      if (!byPlayer.has(key)) byPlayer.set(key, []);
      byPlayer.get(key).push(e);
    }
    return steps.map((step, index) => {
      let count = 0;
      for (const p of result.cohort) {
        const seen = new Set((byPlayer.get(p.key) || []).filter(e => e.event_date <= result.end).map(e => e.event_name));
        if (steps.slice(0, index + 1).every(s => seen.has(s))) count++;
      }
      return { step, count, rate: pct(count, result.cohort.length) };
    });
  }

  function breakdown(events, baseFilters, dimension) {
    const values = [...new Set(prepare(events, baseFilters).players.map(p => p[dimension]))].sort();
    return values.map(value => {
      const result = analyze(events, { ...baseFilters, [dimension]: value });
      return { name: value, installs: result.installs, d1: result.d1.rate, d1N: result.d1.eligible,
        d7: result.d7.rate, d7N: result.d7.eligible, avgDau: result.avgDau, revenue: result.revenue };
    });
  }

  return { REQUIRED, OPTIONAL, parseCSV, normalize, prepare, analyze, funnel, breakdown, dateAdd, dateDiff };
});
