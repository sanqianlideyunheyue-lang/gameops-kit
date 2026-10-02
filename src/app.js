(function () {
  'use strict';
  const core = globalThis.GameOpsCore;
  const samples = globalThis.GameOpsSamples;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const formatPct = value => value === null ? '—' : (value * 100).toFixed(1) + '%';
  const formatNum = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  const formatMoney = value => (source === '模拟数据' ? '$' : '') + Number(value || 0).toFixed(2);
  let events = [...samples.create('puzzle'), ...samples.create('arcade')];
  let source = '模拟数据';
  let activeTab = 'overview';
  let pendingCSV = null;
  let annotations = [];
  try { annotations = JSON.parse(localStorage.getItem('gameops-annotations-v1') || '[]'); } catch (_) { annotations = []; }
  const reviewDraft = { finding: '', hypothesis: '', action: '', conclusion: '' };

  function saveAnnotations() {
    try { localStorage.setItem('gameops-annotations-v1', JSON.stringify(annotations)); }
    catch (_) { notice('浏览器未允许本地保存；本次会话中的记录仍可使用。'); }
  }
  function notice(message = '') { $('notice').textContent = message; }
  function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
  function optionList(values, current, allLabel) {
    return `<option value="">${esc(allLabel)}</option>` + values.map(v => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }
  function setupGames(preferred) {
    const games = unique(events.map(e => e.game_id));
    $('gameSelect').innerHTML = games.map(g => `<option value="${esc(g)}">${esc(samples.CATALOG[g]?.name || g)}</option>`).join('');
    $('gameSelect').value = games.includes(preferred) ? preferred : games[0];
    resetDates(); refreshFilters();
  }
  function resetDates() {
    const selected = events.filter(e => e.game_id === $('gameSelect').value);
    const dates = selected.map(e => e.event_date).sort();
    $('startDate').value = dates[0] || '';
    $('endDate').value = dates.at(-1) || '';
    for (const id of ['startDate', 'endDate']) { $(id).min = dates[0] || ''; $(id).max = dates.at(-1) || ''; }
  }
  function refreshFilters() {
    const game = $('gameSelect').value;
    const records = events.filter(e => e.game_id === game);
    for (const [id, field] of [['channelFilter', 'channel'], ['platformFilter', 'platform'], ['versionFilter', 'version']]) {
      const old = $(id).value;
      const values = unique(records.map(e => e[field] || '未标记'));
      $(id).innerHTML = optionList(values, old, '全部');
      if (values.includes(old)) $(id).value = old;
    }
    $('gameDescription').textContent = samples.CATALOG[game]?.description || '使用导入数据分析。';
  }
  function filters() {
    return { game: $('gameSelect').value, start: $('startDate').value, end: $('endDate').value,
      channel: $('channelFilter').value, platform: $('platformFilter').value, version: $('versionFilter').value };
  }
  function metric(label, value, hint) { return `<article class="card"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="hint">${esc(hint)}</div></article>`; }
  function chart(series, field, markers = []) {
    if (!series.length) return '<div class="empty">当前范围没有数据</div>';
    const width = 800, height = 210, padL = 44, padR = 14, padT = 15, padB = 33;
    const max = Math.max(1, ...series.map(x => x[field]));
    const x = i => padL + i * (width - padL - padR) / Math.max(1, series.length - 1);
    const y = v => padT + (1 - v / max) * (height - padT - padB);
    const path = series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[field]).toFixed(1)}`).join(' ');
    const ticks = [0, .5, 1].map(t => `<line x1="${padL}" y1="${y(max * t)}" x2="${width - padR}" y2="${y(max * t)}" stroke="#e5eeee"/><text x="${padL - 7}" y="${y(max * t) + 4}" text-anchor="end" fill="#8ba0a5" font-size="11">${Math.round(max * t)}</text>`).join('');
    const marked = markers.map(m => {
      const i = series.findIndex(d => d.date === m.date);
      return i < 0 ? '' : `<circle cx="${x(i)}" cy="${y(series[i][field])}" r="5" fill="#ef9e47"><title>${esc(m.date + ' · ' + m.text)}</title></circle>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(field)} 按日趋势">${ticks}<path d="${path}" fill="none" stroke="#26aa8c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${marked}<text x="${padL}" y="${height - 8}" fill="#8ba0a5" font-size="11">${esc(series[0].date)}</text><text x="${width - padR}" y="${height - 8}" text-anchor="end" fill="#8ba0a5" font-size="11">${esc(series.at(-1).date)}</text></svg>`;
  }
  function gameAnnotations(game) { return annotations.filter(a => a.game === game && a.source === source).sort((a, b) => b.date.localeCompare(a.date)); }
  function overview(result) {
    const notes = gameAnnotations(filters().game);
    return `<div class="grid metrics">
      ${metric('区间新增玩家', formatNum(result.installs), '首次事件日期作为安装日期')}
      ${metric('日均活跃 DAU', formatNum(result.avgDau), '有 session_start 的去重玩家')}
      ${metric('D1 留存', formatPct(result.d1.rate), `可观察样本 ${result.d1.eligible} 人`)}
      ${metric('D7 留存', formatPct(result.d7.rate), `可观察样本 ${result.d7.eligible} 人`)}
    </div><p class="kpi-note">区间活跃玩家 ${formatNum(result.activeUsers)} · 区间收入 ${formatMoney(result.revenue)} · 收入沿用导入数据的币种，模拟数据以美元计。</p>
    <div class="grid two"><article class="panel"><h2>每日活跃</h2><p>观察整体趋势；橙色点代表已记录的运营动作。</p>${chart(result.daily, 'dau', notes)}</article>
    <article class="panel"><h2>每日新增</h2><p>新增波动有助于判断留存变化是否来自用户结构变化。</p>${chart(result.daily, 'installs')}</article></div>
    <article class="panel"><h2>阅读这组数字</h2><div class="callout">先看 D1 与 D7，再到「问题定位」比较不同版本、渠道和设备。筛选后留存只计算已到达观察日的玩家，样本量显示在指标下方。</div></article>`;
  }
  function diagnosis(result) {
    const dimension = $('content').dataset.dimension || 'version';
    const rows = core.breakdown(events, filters(), dimension);
    const allEventNames = unique(result.events.map(e => e.event_name));
    const proposed = source === '模拟数据' ? (samples.CATALOG[filters().game]?.funnel || ['install', 'session_start']) : ['install', 'session_start'];
    const steps = proposed.filter(name => allEventNames.includes(name));
    const stages = core.funnel(result, steps);
    const table = rows.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${formatNum(r.installs)}</td><td>${formatPct(r.d1)} <span class="mini">n=${r.d1N}</span></td><td>${formatPct(r.d7)} <span class="mini">n=${r.d7N}</span></td><td>${formatNum(r.avgDau)}</td><td>${formatMoney(r.revenue)}</td></tr>`).join('');
    return `<article class="panel"><div class="panel-head"><div><h2>人群对比</h2><p>同一指标口径下观察差异，再结合样本量判断是否值得调查。</p></div><select id="dimensionSelect" aria-label="选择对比维度"><option value="version" ${dimension === 'version' ? 'selected' : ''}>版本</option><option value="channel" ${dimension === 'channel' ? 'selected' : ''}>渠道</option><option value="platform" ${dimension === 'platform' ? 'selected' : ''}>设备</option></select></div>
      <div class="table-wrap"><table><thead><tr><th>人群</th><th>新增</th><th>D1 留存</th><th>D7 留存</th><th>日均 DAU</th><th>收入</th></tr></thead><tbody>${table || '<tr><td colspan="6">当前范围没有数据</td></tr>'}</tbody></table></div></article>
      <article class="panel"><h2>关键流程漏斗</h2><p>以下步骤由示例游戏配置；导入数据时默认使用安装与启动事件。</p>${stages.map(s => `<div class="bar-row"><span>${esc(s.step)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, (s.rate || 0) * 100)}%"></div></div><strong>${formatNum(s.count)} · ${formatPct(s.rate)}</strong></div>`).join('') || '<div class="empty">缺少可用于漏斗的事件</div>'}</article>
      <article class="panel"><h2>解读提示</h2><div class="callout">版本、人群之间的差异只能作为排查线索。若要判断某项运营动作的实际效果，需要控制同期投放、版本变化和玩家构成等因素；必要时设计对照实验。</div></article>`;
  }
  function timeline(result) {
    const notes = gameAnnotations(filters().game);
    return `<article class="panel"><h2>记录运营动作</h2><p>登记版本更新、活动、投放等节点，回看指标变化。记录保存在当前浏览器。</p>
      <form id="annotationForm"><div class="form-grid"><label>日期<input name="date" type="date" min="${esc(result.start)}" max="${esc(result.end)}" value="${esc(result.end)}" required></label>
      <label>类型<select name="type"><option>版本更新</option><option>活动</option><option>投放</option><option>其他</option></select></label>
      <label>简要说明<input name="text" type="text" maxlength="120" placeholder="例如：新手引导文案调整" required></label></div><div class="actions"><button class="btn" type="submit">添加记录</button></div></form></article>
      <article class="panel"><h2>活跃趋势与动作节点</h2>${chart(result.daily, 'dau', notes)}<div>${notes.map((a, i) => `<div class="annotation"><span><strong>${esc(a.date)}</strong> · ${esc(a.type)} · ${esc(a.text)}</span><button class="btn secondary" data-remove="${i}" type="button">删除</button></div>`).join('') || '<div class="empty">尚无记录，可从上方添加。</div>'}</div></article>`;
  }
  function reportMarkdown(result) {
    const game = filters().game;
    const scope = ['channel', 'platform', 'version'].map(k => filters()[k] || '全部').join(' / ');
    const notes = gameAnnotations(game).map(a => `- ${a.date}｜${a.type}｜${a.text}`).join('\n') || '- 暂无记录';
    return `# 游戏运营复盘｜${source === '模拟数据' ? (samples.CATALOG[game]?.name || game) : game}\n\n> 数据来源：${source}。${source === '模拟数据' ? '模拟数据仅用于展示分析流程，不能代表真实业务效果。' : '请核实数据授权、币种与安装事件口径。'}\n\n## 分析范围\n\n- 日期：${result.start} 至 ${result.end}\n- 渠道 / 设备 / 版本：${scope}\n\n## 核心指标\n\n- 区间新增：${result.installs}\n- 日均 DAU：${result.avgDau.toFixed(1)}\n- D1 留存：${formatPct(result.d1.rate)}（可观察样本 ${result.d1.eligible}）\n- D7 留存：${formatPct(result.d7.rate)}（可观察样本 ${result.d7.eligible}）\n- 区间收入：${formatMoney(result.revenue)}\n\n## 发现\n\n${reviewDraft.finding || '待填写'}\n\n## 假设与验证方式\n\n${reviewDraft.hypothesis || '待填写'}\n\n## 运营动作\n\n${reviewDraft.action || '待填写'}\n\n### 动作时间线\n\n${notes}\n\n## 结果与下一步\n\n${reviewDraft.conclusion || '待填写'}\n\n---\n指标口径见 docs/metrics.md。时间先后和相关性不足以证明因果关系。\n`;
  }
  function review(result) {
    const fields = [['finding', '发现了什么', '描述具体指标、变化幅度和受影响的人群。'], ['hypothesis', '假设与验证方式', '写明可能原因，以及还需要查看哪些证据。'], ['action', '计划或已执行的动作', '说明目标人群、触达方式、成本和观察窗口。'], ['conclusion', '结果与下一步', '陈述观察结果、局限和下一步决策。']];
    return `<article class="panel"><h2>把分析写成运营判断</h2><p>以下内容会与当前指标和运营动作一起导出为 Markdown，可直接放入 GitHub 案例文档。</p><div class="form-stack">${fields.map(([key, label, placeholder]) => `<label>${label}<textarea id="review-${key}" placeholder="${esc(placeholder)}">${esc(reviewDraft[key])}</textarea></label>`).join('')}</div><div class="actions"><button id="downloadReport" class="btn">下载复盘 Markdown</button></div></article>
      <article class="panel"><h2>当前范围摘要</h2><div class="callout">${esc(result.start)} 至 ${esc(result.end)} · 新增 ${formatNum(result.installs)} · D1 ${formatPct(result.d1.rate)} · D7 ${formatPct(result.d7.rate)}。这些数字随左侧筛选条件变化。</div></article>`;
  }
  function render() {
    try {
      const result = core.analyze(events, filters());
      $('sourceBadge').textContent = source;
      $('content').innerHTML = ({ overview, diagnosis, timeline, review })[activeTab](result);
      document.querySelectorAll('.tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
      if (activeTab === 'diagnosis') $('dimensionSelect').addEventListener('change', e => { $('content').dataset.dimension = e.target.value; render(); });
      if (activeTab === 'timeline') {
        $('annotationForm').addEventListener('submit', e => {
          e.preventDefault(); const data = new FormData(e.target);
          annotations.push({ game: filters().game, source, date: data.get('date'), type: data.get('type'), text: String(data.get('text')).trim() });
          saveAnnotations(); render();
        });
        document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
          const note = gameAnnotations(filters().game)[Number(button.dataset.remove)];
          annotations.splice(annotations.indexOf(note), 1); saveAnnotations(); render();
        }));
      }
      if (activeTab === 'review') {
        for (const key of Object.keys(reviewDraft)) $(`review-${key}`).addEventListener('input', e => { reviewDraft[key] = e.target.value; });
        $('downloadReport').addEventListener('click', () => download('gameops-review.md', reportMarkdown(result), 'text/markdown;charset=utf-8'));
      }
    } catch (error) { $('content').innerHTML = `<div class="panel">${esc(error.message)}</div>`; }
  }
  function download(name, content, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  function showMapping(parsed) {
    pendingCSV = parsed;
    const fields = [...core.REQUIRED, ...core.OPTIONAL];
    $('mappingPanel').innerHTML = `<div class="mapping"><strong>字段映射</strong>${fields.map(field => `<label>${field}${core.REQUIRED.includes(field) ? ' *' : ''}<select data-field="${field}"><option value="">不映射</option>${parsed.headers.map(h => `<option value="${esc(h)}" ${h === field ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}<button class="btn" id="applyImport">载入 CSV</button></div>`;
    $('applyImport').addEventListener('click', () => {
      try {
        const mapping = Object.fromEntries([...document.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el.value]));
        const imported = core.normalize(pendingCSV.rows, mapping);
        events = imported; source = '导入数据';
        setupGames(imported[0].game_id); $('mappingPanel').innerHTML = ''; notice(`已载入 ${formatNum(imported.length)} 条事件；数据只保存在当前页面。`); render();
      } catch (error) { notice(error.message); }
    });
  }
  for (const id of ['startDate', 'endDate', 'channelFilter', 'platformFilter', 'versionFilter']) $(id).addEventListener('change', render);
  $('gameSelect').addEventListener('change', () => { resetDates(); refreshFilters(); render(); });
  document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.tab; render(); }));
  $('csvFile').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notice('CSV 文件请控制在 10 MB 以内。'); return; }
    try { showMapping(core.parseCSV(await file.text())); notice('请检查字段映射，然后载入 CSV。'); }
    catch (error) { notice(error.message); }
  });
  setupGames('puzzle'); render();
})();
