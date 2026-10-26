
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const DUR = 222;
const CHAPTERS = { 0: 'Intro', 58: 'The problem', 74: 'How it works', 141: 'Demo', 196: 'Status' };
const TRANSCRIPT = [
  [0, "Partial prerendering is a new rendering model we've been working on in Next.js."],
  [14, "So, um, the idea is simple. You shouldn't have to pick static or dynamic for a whole route."],
  [29, 'Most pages are mostly static. A header, a product description, some layout.'],
  [41, "But there's usually a small part that's, you know, personal. A cart, recommendations, a signed-in state."],
  [58, 'Today, that one dynamic piece forces the whole page to render on every request.'],
  [74, 'With partial prerendering, we prerender a static shell at build time and serve it from the edge.'],
  [92, 'The dynamic parts stream in afterward, in the same HTTP request.'],
  [108, "And, uh, there's no new API. You wrap the dynamic part in a Suspense boundary."],
  [125, 'The fallback you pass to Suspense becomes part of the static shell.'],
  [141, "Let's look at a demo. Here's an e-commerce page with a product and a cart."],
  [160, 'Notice the product info loads instantly. The cart streams in a moment later.'],
  [178, "That's the point. Fast initial load, and still fully dynamic where it matters."],
  [196, "It's experimental in Next.js 14, on the canary channel. Try it and tell us what breaks."]
];
const clean = (t, on) => on ? t.replace(/,?\s*\b(um|uh|you know)\b,?/gi, '').replace(/\s{2,}/g, ' ') : t;
const MODELS = [
  { id: 'gpt-5-mini', name: 'GPT-5 mini', note: 'Fast. Good for summaries' },
  { id: 'gpt-5', name: 'GPT-5', note: 'Slower. Better reasoning' },
  { id: 'claude', name: 'Claude Sonnet 4.5', note: 'Best on long videos' },
  { id: 'gemini', name: 'Gemini 2.5 Flash', note: 'Fastest' }
];
const STYLES = [
  { id: 'detailed', name: 'Detailed', note: 'Summary, moments, notes' },
  { id: 'tldr', name: 'TL;DR', note: '2–3 sentences' },
  { id: 'moments', name: 'Key moments', note: 'Timestamped outline' }
];
const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', hint: 'sk-…', models: 'GPT-5, GPT-5 mini', tag: 'Most used', found: ['GPT-5', 'GPT-5 mini', 'GPT-4.1', 'GPT-4.1 mini', 'o4-mini', 'GPT-4o'] },
  { id: 'anthropic', name: 'Anthropic', hint: 'sk-ant-…', models: 'Claude Sonnet 4.5, Haiku 4.5', tag: 'Long videos', found: ['Claude Sonnet 4.5', 'Claude Haiku 4.5', 'Claude Opus 4.1'] },
  { id: 'google', name: 'Google AI', hint: 'AIza…', models: 'Gemini 2.5 Flash, Pro', tag: 'Free tier', found: ['Gemini 2.5 Flash', 'Gemini 2.5 Pro', 'Gemini 2.5 Flash-Lite'] },
  { id: 'openrouter', name: 'OpenRouter', hint: 'sk-or-…', models: 'One key, 300+ models', tag: '', found: ['GPT-5 mini', 'Claude Sonnet 4.5', 'Gemini 2.5 Flash', 'Llama 4', 'DeepSeek V3'] }
];
const LANGS = ['Match video', 'English', 'Español', 'Deutsch', 'Français', 'Português', '日本語'];
const MOMENTS = [
  [14, "Static vs dynamic shouldn't be a per-route choice"],
  [58, 'One dynamic component makes the whole page dynamic'],
  [74, 'Static shell is prerendered and served from the edge'],
  [108, 'No new API — Suspense boundaries define the split'],
  [160, 'Demo: product renders instantly, cart streams in']
];
const NOTES = [
  'The static shell includes every Suspense fallback, so loading states ship with the first byte.',
  'Dynamic content streams in the same HTTP request — no extra round trip.',
  'Works with existing App Router code. Nothing to rewrite.',
  'Experimental in Next.js 14, canary only. Not for production yet.'
];
const SUGGEST = ["What's the main takeaway?", 'How does it decide what\u2019s static?', 'Is it production-ready?'];
const REPLIES = {
  [SUGGEST[0]]: { text: "You don't have to choose static or dynamic per route anymore. Next.js prerenders a static shell and streams the dynamic parts into it, using the Suspense boundaries you already write.", cites: [14, 108], follow: ['Show me the demo part', 'How is this different from ISR?'] },
  [SUGGEST[1]]: { text: 'Anything outside a Suspense boundary gets prerendered. The fallback you pass to Suspense becomes part of the shell, and the wrapped component streams in at request time.', cites: [108, 125], follow: ['Does this work with the Pages Router?'] },
  [SUGGEST[2]]: { text: "Not yet. It's experimental in Next.js 14 and only on the canary channel — he asks people to try it and report what breaks.", cites: [196], follow: ['How do I turn it on?'] }
};
const FALLBACK = { text: 'From the transcript: the talk pairs a prerendered static shell with dynamic content that streams in. The demo shows it best — the product loads instantly and the cart arrives a moment later.', cites: [141, 160], follow: ['Summarize the demo in 3 bullets'] };
const QUICK = [
  { icon: 'ph ph-graduation-cap', label: 'Explain simply', note: 'No jargon', prompt: 'Explain this video like I\u2019m new to web dev' },
  { icon: 'ph ph-exam', label: 'Quiz me', note: '3 questions', prompt: 'Quiz me on this video' },
  { icon: 'ph ph-notebook', label: 'Study notes', note: 'With timestamps', prompt: 'Turn this into study notes' },
  { icon: 'ph ph-magnifying-glass', label: 'Find a moment', note: 'Where does he…', draft: 'Where does he talk about ' }
];
Object.assign(REPLIES, {
  [QUICK[0].prompt]: { text: 'Most of a page never changes, like the header or a product description. A small part does, like your cart. Next.js now builds the unchanging part ahead of time so it shows up instantly, then fills in the personal part a moment later.', cites: [29, 74], follow: ['What is a Suspense boundary?'] },
  [QUICK[1].prompt]: { text: '1. What decides which parts of a page are prerendered? 2. Does the dynamic content need a second request? 3. Which release channel is this available on? Reply with your answers and I\u2019ll check them.', cites: [], follow: ['Show me the answers'] },
  [QUICK[2].prompt]: { text: 'Problem: one dynamic component makes the whole route dynamic. Fix: prerender a static shell, stream the rest in the same request. API: none new, Suspense boundaries mark the split. Status: experimental, canary only.', cites: [58, 74, 108, 196], follow: ['Copy as Markdown'] },
  'Explain what he means here': { text: 'He means the page is sent as a ready-made shell from the edge first, so you see it immediately. The parts that depend on you are rendered on the server afterwards and streamed into that same response.', cites: [74, 92], follow: ['Why does that make it faster?'] }
});
const HIST = () => [{ role: 'user', text: 'How is this different from ISR?' }, { role: 'assistant', text: 'ISR regenerates a whole page in the background on a timer. Partial prerendering splits a single page: the shell is static, and the personal parts render per request and stream in. You can use both.', cites: [74, 92], follow: ['When would I still use ISR?'] }];
const CH = Object.keys(CHAPTERS).map(Number);
const SHORTCUTS = [['Toggle panel', '⌥ Y'], ['Focus chat', '/'], ['Summarize video', '⌥ S'], ['Search transcript', '⌥ F']];
const LOAD_STEPS = ['Fetching transcript', 'Reading 13 segments', 'Writing summary'];
const SEED = () => [{ role: 'user', text: SUGGEST[0] }, { role: 'assistant', ...REPLIES[SUGGEST[0]] }];
const SCEN = {
  onboarding: { view: 'onboarding', hasKey: false },
  'byok-invalid': { view: 'onboarding', hasKey: false, keyDraft: 'sk-proj-8f2kQ', keyStatus: 'invalid' },
  'byok-valid': { view: 'onboarding', hasKey: false, keyDraft: 'sk-proj-8f2kQ7vLx0aN4f2a', keyStatus: 'valid' },
  'no-key': { hasKey: false, tab: 'chat' },
  'chat-empty': { tab: 'chat' },
  'summary-idle': { summary: 'idle' },
  'summary-loading': { summary: 'loading', loadStep: 1 },
  error: { summary: 'error' },
  'no-captions': { summary: 'nocaptions', transcript: 'none' },
  'transcript-search': { tab: 'transcript', query: 'suspense', follow: false },
  chat: { tab: 'chat', messages: SEED() },
  'chat-streaming': { tab: 'chat', messages: [{ role: 'user', text: SUGGEST[1], at: '01:48' }], stream: { ...REPLIES[SUGGEST[1]], n: 17 } },
  'chat-quote': { tab: 'chat', messages: SEED(), quote: 8, draft: 'So where does the fallback actually render?' },
  settings: { view: 'settings' },
  collapsed: { collapsed: true },
  'no-video': { view: 'novideo' }
};

class Component extends DCLogic {
  state = Object.assign({
    tab: this.props.initialTab ?? 'summary', view: 'main', collapsed: false, menu: null,
    model: 'gpt-5-mini', style: 'detailed', summary: 'done', loadStep: 0, transcript: 'ok', pct: 0,
    query: '', matchIdx: 0, follow: true, hover: -1, t: 96,
    messages: [], stream: null, draft: '', quote: null, attachTime: false, toast: null, feedback: null,
    provider: 'openai', keyDraft: '', keyError: false, keyStatus: 'idle', showKey: false, hasKey: true, limit: 5,
    set: { theme: 'youtube', size: 'm', font: null, lang: 'Match video', autoSum: true, follow: true, fillers: true }
  }, SCEN[this.props.scenario] || {});
  tRef = React.createRef();
  cRef = React.createRef();
  componentDidMount() {
    this.iv = setInterval(() => {
      if ((this.props.playing ?? true) && this.state.view === 'main') this.setState(s => ({ t: (s.t + 1) % DUR }));
    }, 1000);
    setTimeout(() => this.componentDidUpdate(this.props, { ...this.state, tab: null, messages: null }), 60);
  }
  componentWillUnmount() { [this.iv, this.si, this.ti].forEach(clearInterval); [this.tt, this.g1, this.g2, this.g3, this.st].forEach(clearTimeout); }
  ai(t) { let i = 0; TRANSCRIPT.forEach((r, j) => { if (r[0] <= t) i = j; }); return i; }
  componentDidUpdate(pp, ps) {
    if (pp.initialTab !== this.props.initialTab && this.props.initialTab) this.setState({ tab: this.props.initialTab });
    const s = this.state, c = this.tRef.current;
    if (c && s.tab === 'transcript') {
      if (s.query) {
        if (ps.query !== s.query || ps.matchIdx !== s.matchIdx || ps.tab !== s.tab) {
          const el = c.querySelector('[data-match="true"]');
          if (el) c.scrollTo({ top: el.offsetTop - c.clientHeight / 3, behavior: 'smooth' });
        }
      } else if (s.follow && (this.ai(ps.t) !== this.ai(s.t) || ps.tab !== s.tab || ps.follow !== s.follow || ps.query !== s.query)) {
        const el = c.querySelector('[data-active="true"]');
        if (el) c.scrollTo({ top: el.offsetTop - c.clientHeight / 3, behavior: ps.tab !== s.tab ? 'auto' : 'smooth' });
      }
    }
    const cc = this.cRef.current;
    if (cc && (ps.messages !== s.messages || ps.stream !== s.stream || ps.tab !== s.tab)) cc.scrollTop = cc.scrollHeight;
  }
  toast(msg) { this.setState({ toast: msg }); clearTimeout(this.tt); this.tt = setTimeout(() => this.setState({ toast: null }), 1800); }
  seek(sec) { this.setState({ t: sec }); this.toast('Jumped to ' + fmt(sec)); }
  generate() {
    [this.g1, this.g2, this.g3].forEach(clearTimeout);
    this.setState({ summary: 'loading', loadStep: 0, menu: null, feedback: null });
    this.g1 = setTimeout(() => this.setState({ loadStep: 1 }), 600);
    this.g2 = setTimeout(() => this.setState({ loadStep: 2 }), 1200);
    this.g3 = setTimeout(() => this.setState({ summary: 'done' }), 1900);
  }
  transcribe() {
    clearInterval(this.ti);
    this.setState({ transcript: 'transcribing', pct: 0 });
    this.ti = setInterval(() => {
      const p = this.state.pct + 3;
      if (p >= 100) { clearInterval(this.ti); this.setState({ transcript: 'ok', summary: 'idle', pct: 100 }); this.toast('Transcript ready'); }
      else this.setState({ pct: p });
    }, 80);
  }
  line(i) { return clean(TRANSCRIPT[i][1], this.state.set.fillers); }
  send(text) {
    const s = this.state;
    text = (text ?? s.draft).trim();
    if (!text || s.stream) return;
    const at = s.attachTime ? fmt(s.t) : null;
    const quote = s.quote != null ? { time: fmt(TRANSCRIPT[s.quote][0]), text: this.line(s.quote) } : null;
    const r = REPLIES[text] || FALLBACK;
    this.setState({ messages: [...s.messages, { role: 'user', text, at, quote }], draft: '', attachTime: false, quote: null, stream: { ...r, n: 0 }, menu: null, tab: 'chat' });
    clearInterval(this.si); clearTimeout(this.st);
    this.st = setTimeout(() => {
      this.si = setInterval(() => {
        const st = this.state.stream;
        if (!st) { clearInterval(this.si); return; }
        if (st.n >= st.text.split(' ').length) {
          clearInterval(this.si);
          this.setState(x => ({ stream: null, messages: [...x.messages, { role: 'assistant', text: st.text, cites: st.cites, follow: st.follow }] }));
        } else this.setState({ stream: { ...st, n: st.n + 1 } });
      }, 45);
    }, 600);
  }
  stop() {
    clearInterval(this.si); clearTimeout(this.st);
    const st = this.state.stream; if (!st) return;
    const partial = st.text.split(' ').slice(0, st.n).join(' ');
    this.setState(x => ({ stream: null, messages: [...x.messages, { role: 'assistant', text: partial, cites: [], stopped: true }] }));
  }
  connect() {
    const s = this.state, prov = PROVIDERS.find(p => p.id === s.provider);
    if (s.keyStatus === 'checking') return;
    if (s.keyStatus === 'valid') { this.setState({ view: 'main', hasKey: true, keyDraft: '', keyStatus: 'idle' }); this.toast('Connected to ' + prov.name); return; }
    if (!s.keyDraft.trim()) { this.setState({ keyError: true }); return; }
    this.setState({ keyStatus: 'checking', keyError: false });
    clearTimeout(this.ct);
    this.ct = setTimeout(() => this.setState({ keyStatus: this.state.keyDraft.trim().length < 20 ? 'invalid' : 'valid' }), 1100);
  }
  setSet(k, v) { this.setState(s => ({ set: { ...s.set, [k]: v }, ...(k === 'follow' ? { follow: v } : {}) })); }
  renderVals() {
    const s = this.state, p = this.props, set = s.set;
    const theme = set.theme === 'youtube' ? (p.theme ?? 'dark') : set.theme;
    const font = set.font ?? p.font ?? 'youtube';
    const fs = { s: '13px', m: '14px', l: '16px' }[set.size], lh = { s: '19px', m: '21px', l: '24px' }[set.size];
    const model = MODELS.find(m => m.id === s.model), style = STYLES.find(x => x.id === s.style), prov = PROVIDERS.find(x => x.id === s.provider);
    const ai = this.ai(s.t);
    const menu = id => () => this.setState(st => ({ menu: st.menu === id ? null : id }));
    const opts = (list, cur, fn) => list.map(o => ({ name: o.name, note: o.note, check: o.id === cur ? 'visible' : 'hidden', pick: () => fn(o.id) }));
    const main = s.view === 'main';
    // transcript
    const q = s.query.trim().toLowerCase();
    const lines = TRANSCRIPT.map((r, i) => ({ i, sec: r[0], text: clean(r[1], set.fillers) }));
    const matches = q ? lines.filter(l => l.text.toLowerCase().includes(q)).map(l => l.i) : [];
    const mi = matches.length ? ((s.matchIdx % matches.length) + matches.length) % matches.length : 0;
    const cur = matches.length ? matches[mi] : -1;
    const items = [];
    lines.forEach(l => {
      if (CHAPTERS[l.sec] != null) items.push({ isChapter: true, isLine: false, title: CHAPTERS[l.sec], time: fmt(l.sec) });
      const active = l.i === ai && !q, hovered = s.hover === l.i;
      let parts = [{ text: l.text, bg: 'transparent', color: 'inherit' }];
      if (q && l.text.toLowerCase().includes(q)) {
        parts = []; const low = l.text.toLowerCase(); let i = 0;
        while (i < l.text.length) {
          const k = low.indexOf(q, i);
          if (k < 0) { parts.push({ text: l.text.slice(i), bg: 'transparent', color: 'inherit' }); break; }
          if (k > i) parts.push({ text: l.text.slice(i, k), bg: 'transparent', color: 'inherit' });
          parts.push({ text: l.text.slice(k, k + q.length), bg: l.i === cur ? 'var(--warning)' : 'var(--warning-soft)', color: l.i === cur ? '#0f0f0f' : 'var(--fg)' });
          i = k + q.length;
        }
      }
      items.push({
        isChapter: false, isLine: true, time: fmt(l.sec), parts, hovered,
        activeStr: String(active), matchStr: String(l.i === cur),
        bg: active ? 'var(--bg-overlay)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        timeColor: active ? 'var(--info)' : 'var(--fg-muted)',
        textColor: active ? 'var(--fg)' : 'var(--card-foreground)',
        onClick: () => this.seek(l.sec),
        onEnter: () => this.setState({ hover: l.i }), onLeave: () => this.setState(st => st.hover === l.i ? { hover: -1 } : null),
        onAsk: e => { e.stopPropagation(); this.setState({ tab: 'chat', quote: l.i, hover: -1 }); },
        onCopy: e => { e.stopPropagation(); this.toast('Line copied'); }
      });
    });
    // chat
    let lastA = -1; s.messages.forEach((m, i) => { if (m.role === 'assistant') lastA = i; });
    const caret = React.createElement('span', { style: { display: 'inline-block', width: 7, height: 14, marginLeft: 2, verticalAlign: '-2px', background: 'var(--fg-muted)', animation: 'yt-blink 0.9s steps(2) infinite' } });
    const msgVals = (m, o) => ({
      isUser: m.role === 'user', isAssistant: m.role === 'assistant', text: m.text,
      hasAt: !!m.at, at: m.at, hasQuote: !!m.quote, quoteTime: m.quote && m.quote.time, quoteText: m.quote && m.quote.text,
      waiting: !!o.waiting, hasText: !o.waiting, caret: o.streaming ? caret : null, stopped: !!m.stopped,
      hasCites: !!(m.cites && m.cites.length), cites: (m.cites || []).map(sec => ({ label: fmt(sec), onClick: () => this.seek(sec) })),
      showActions: m.role === 'assistant' && !o.streaming,
      hasFollowups: !!(o.last && m.follow), followups: (o.last && m.follow ? m.follow : []).map(f => ({ text: f, onClick: () => this.send(f) })),
      onCopy: () => this.toast('Copied'), onRetry: () => this.toast('Regenerating…')
    });
    const msgs = s.messages.map((m, i) => msgVals(m, { last: i === lastA && !s.stream }));
    if (s.stream) msgs.push(msgVals({ role: 'assistant', text: s.stream.text.split(' ').slice(0, s.stream.n).join(' ') }, { streaming: true, waiting: s.stream.n === 0 }));
    // elements
    const spinner = React.createElement('i', { className: 'ph ph-circle-notch', style: { fontSize: 14, display: 'inline-block', animation: 'yt-spin 0.8s linear infinite' } });
    const bar = (w, h, key, mt) => React.createElement('div', { key, style: { width: w, height: h, marginTop: mt || 0, borderRadius: 4, background: 'var(--bg-overlay)', animation: 'yt-shimmer 1.4s infinite cubic-bezier(0.2,0,0,1)' } });
    const skeleton = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      bar(72, 10, 'h'), bar('100%', 12, 'a', 6), bar('94%', 12, 'b'), bar('66%', 12, 'c'), bar(96, 10, 'h2', 20),
      ...[0, 1, 2, 3].map(i => bar(`${90 - i * 8}%`, 12, 'm' + i, 8)));
    const dots = React.createElement('div', { style: { display: 'flex', gap: 4, alignItems: 'center', height: 21 } },
      [0, 1, 2].map(i => React.createElement('span', { key: i, style: { width: 6, height: 6, borderRadius: 99, background: 'var(--fg-muted)', animation: `yt-pulse 1s ${i * 0.15}s infinite cubic-bezier(0.2,0,0,1)` } })));
    const tg = (on, k) => ({ bg: on ? 'var(--info)' : 'var(--muted)', x: on ? '16px' : '0px', onClick: () => this.setSet(k, !on) });
    const seg = (list, val, k) => list.map(([v, label]) => ({ label, bg: v === val ? 'var(--bg)' : 'transparent', color: v === val ? 'var(--fg)' : 'var(--fg-muted)', onClick: () => this.setSet(k, v) }));
    const canSend = !!s.draft.trim() && !s.stream;
    return {
      rootClass: `yt-${theme} yt-font-${font}`,
      panelH: s.collapsed ? 'auto' : (p.height ?? '640px'),
      anyMenu: !!s.menu, closeMenu: () => this.setState({ menu: null }),
      isMainHead: s.view !== 'settings', isSettingsHead: s.view === 'settings',
      hasVideo: s.view !== 'novideo',
      headTitle: s.view === 'novideo' ? 'YouTube AI' : 'Partial Prerendering in Next.js 14 (Preview)',
      headSub: s.view === 'novideo' ? 'No video open' : 'Lee Robinson',
      playIcon: (p.playing ?? true) ? 'ph-fill ph-play' : 'ph-fill ph-pause',
      timeLabel: fmt(s.t),
      showNewChat: main && !s.collapsed && s.tab === 'chat' && s.hasKey && s.messages.length > 0,
      newChat: () => { this.stop(); this.setState({ messages: [], stream: null, draft: '', quote: null }); },
      openSettings: () => this.setState({ view: 'settings', menu: null, collapsed: false }),
      closeSettings: () => this.setState({ view: 'main' }),
      openMore: menu('more'), moreMenu: s.menu === 'more',
      moreItems: [
        { icon: 'ph ph-link-simple', label: `Copy link at ${fmt(s.t)}`, kbd: '', onClick: () => { this.setState({ menu: null }); this.toast('Link copied'); } },
        { icon: 'ph ph-arrow-square-out', label: 'Open in side panel', kbd: '', onClick: () => this.setState({ menu: null }) },
        { icon: 'ph ph-download-simple', label: 'Export as Markdown', kbd: '', onClick: () => { this.setState({ menu: null }); this.toast('Saved summary.md'); } },
        { icon: 'ph ph-keyboard', label: 'Keyboard shortcuts', kbd: '?', onClick: () => this.setState({ menu: null, view: 'settings' }) },
        { icon: 'ph ph-chat-teardrop-text', label: 'Send feedback', kbd: '', onClick: () => this.setState({ menu: null }) }
      ],
      isCollapsed: s.collapsed && main,
      collapseIcon: s.collapsed ? 'ph ph-caret-down' : 'ph ph-caret-up', collapseTitle: s.collapsed ? 'Expand' : 'Collapse',
      toggleCollapse: () => this.setState(st => ({ collapsed: !st.collapsed, menu: null })),
      expandIfCollapsed: () => { if (this.state.collapsed) this.setState({ collapsed: false }); },
      showTabs: main && !s.collapsed,
      showBody: !s.collapsed || !main,
      tabs: [['summary', 'Summary'], ['transcript', 'Transcript'], ['chat', 'Chat']].map(([id, label]) => ({ label, on: s.tab === id, off: s.tab !== id, onClick: () => this.setState({ tab: id, menu: null }) })),
      isSummary: main && s.tab === 'summary' && s.hasKey, isTranscript: main && s.tab === 'transcript', isChat: main && s.tab === 'chat' && s.hasKey,
      isSettings: s.view === 'settings', isOnboarding: s.view === 'onboarding', isNoVideo: s.view === 'novideo',
      openStyle: menu('style'), openModelS: menu('model-s'), openModelC: menu('model-c'),
      styleMenu: s.menu === 'style', modelMenuS: s.menu === 'model-s', modelMenuC: s.menu === 'model-c',
      modelName: model.name, styleName: style.name, providerName: prov.name,
      modelOpts: opts(MODELS, s.model, id => this.setState({ model: id, menu: null })),
      styleOpts: opts(STYLES, s.style, id => { this.setState({ style: id }); this.generate(); }),
      generate: () => this.generate(),
      copySummary: () => this.toast('Copied as Markdown'),
      goChat: () => this.setState({ tab: 'chat' }),
      sumIdle: s.summary === 'idle', sumLoading: s.summary === 'loading', sumError: s.summary === 'error', sumNoCaptions: s.summary === 'nocaptions', sumDone: s.summary === 'done',
      loadSteps: LOAD_STEPS.map((label, j) => ({ label, done: j < s.loadStep, active: j === s.loadStep, pending: j > s.loadStep, color: j <= s.loadStep ? 'var(--fg)' : 'var(--fg-subtle)' })),
      spinner, skeleton, dots,
      showTldr: s.style !== 'moments', showMoments: s.style !== 'tldr', showDetail: s.style === 'detailed',
      moments: MOMENTS.map(([sec, text], j) => {
        const on = MOMENTS.reduce((k, m, x) => m[0] <= s.t ? x : k, -1) === j;
        return { time: fmt(sec), text, onClick: () => this.seek(sec), bg: on ? 'var(--bg-elevated)' : 'transparent', color: on ? 'var(--fg)' : 'var(--card-foreground)' };
      }),
      notes: NOTES, fs, lh,
      fbUp: () => { this.setState({ feedback: 'up' }); this.toast('Thanks — noted'); },
      fbDown: () => { this.setState({ feedback: 'down' }); this.toast("Thanks. I'll use that to tune the prompt"); },
      upIcon: s.feedback === 'up' ? 'ph-fill ph-thumbs-up' : 'ph ph-thumbs-up', downIcon: s.feedback === 'down' ? 'ph-fill ph-thumbs-down' : 'ph ph-thumbs-down',
      upColor: s.feedback === 'up' ? 'var(--fg)' : 'var(--fg-muted)', downColor: s.feedback === 'down' ? 'var(--fg)' : 'var(--fg-muted)',
      askFollowUp: () => this.setState({ tab: 'chat', draft: 'Explain the Suspense part like I\u2019m new to React' }),
      summaryMeta: `${model.name} · ${style.name} · ${set.lang === 'Match video' ? 'English' : set.lang}`,
      tOk: s.transcript === 'ok', tNotOk: s.transcript !== 'ok', tNone: s.transcript === 'none', tTranscribing: s.transcript === 'transcribing',
      transcribe: () => this.transcribe(), pctLabel: s.pct + '%',
      query: s.query, hasQuery: !!q, searchPadR: q ? '120px' : '12px',
      onQuery: e => this.setState({ query: e.target.value, matchIdx: 0 }),
      onSearchKey: e => {
        if (e.key === 'Enter') { e.preventDefault(); this.setState(st => ({ matchIdx: st.matchIdx + (e.shiftKey ? -1 : 1) })); }
        if (e.key === 'Escape') this.setState({ query: '' });
      },
      matchLabel: matches.length ? `${mi + 1}/${matches.length}` : '0/0',
      prevMatch: () => this.setState(st => ({ matchIdx: st.matchIdx - 1 })), nextMatch: () => this.setState(st => ({ matchIdx: st.matchIdx + 1 })),
      clearQuery: () => this.setState({ query: '' }),
      follow: s.follow, notFollow: !s.follow,
      toggleFollow: () => this.setState(st => ({ follow: !st.follow })),
      onTranscriptWheel: () => { if (this.state.follow && !this.state.query) this.setState({ follow: false }); },
      showJump: !s.follow && !q,
      jumpNow: () => this.setState({ follow: true }),
      copyTranscript: () => this.toast('Transcript copied with timestamps'),
      items, noMatches: !!q && matches.length === 0,
      tRef: this.tRef, cRef: this.cRef,
      chatEmpty: s.messages.length === 0 && !s.stream,
      suggestions: SUGGEST.map(text => ({ text, onClick: () => this.send(text) })),
      msgs,
      hasQuote: s.quote != null, quoteTime: s.quote != null ? fmt(TRANSCRIPT[s.quote][0]) : '', quoteText: s.quote != null ? this.line(s.quote) : '',
      clearQuote: () => this.setState({ quote: null }),
      draft: s.draft, onDraft: e => this.setState({ draft: e.target.value }),
      onKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } },
      sendDraft: () => this.send(), stop: () => this.stop(),
      isStreaming: !!s.stream, canSend, sendDisabled: !canSend && !s.stream,
      attachTime: s.attachTime, noAttach: !s.attachTime, toggleAttach: () => this.setState(st => ({ attachTime: !st.attachTime })),
      provider: s.provider, model: s.model, styleId: s.style, lang: set.lang,
      providerSel: PROVIDERS.map(x => ({ value: x.id, label: x.name })),
      modelSel: MODELS.map(x => ({ value: x.id, label: x.name })),
      styleSel: STYLES.map(x => ({ value: x.id, label: x.name })),
      langSel: LANGS.map(x => ({ value: x, label: x })),
      onProvider: e => this.setState({ provider: e.target.value }),
      onModel: e => this.setState({ model: e.target.value }),
      onStyle: e => this.setState({ style: e.target.value }),
      onLang: e => this.setSet('lang', e.target.value),
      keyMask: { openai: 'sk-…4f2a', anthropic: 'sk-ant-…91cd', google: 'AIza…x7Qe', openrouter: 'sk-or-…b03e' }[s.provider],
      replaceKey: () => this.setState({ view: 'onboarding' }),
      tgAutoSum: tg(set.autoSum, 'autoSum'), tgFollow: tg(set.follow, 'follow'), tgFillers: tg(set.fillers, 'fillers'),
      themeSeg: seg([['youtube', 'Match YouTube'], ['dark', 'Dark'], ['light', 'Light']], set.theme, 'theme'),
      sizeSeg: seg([['s', 'S'], ['m', 'M'], ['l', 'L']], set.size, 'size'),
      fontSeg: seg([['youtube', 'Roboto'], ['geist', 'Geist']], font, 'font'),
      shortcuts: SHORTCUTS.map(([label, keys]) => ({ label, keys })),
      exportChats: () => this.toast('Exported 12 chats'),
      clearHistory: () => { this.setState({ messages: [] }); this.toast('Chat history cleared'); },
      providerOpts: PROVIDERS.map(x => ({ name: x.name, models: x.models, tag: x.tag, bg: x.id === s.provider ? 'var(--bg-overlay)' : 'var(--bg-elevated)', ring: x.id === s.provider ? '5px solid var(--fg)' : '1.5px solid var(--fg-subtle)', onClick: () => this.setState({ provider: x.id, keyStatus: 'idle' }) })),
      keyDraft: s.keyDraft, onKeyDraft: e => this.setState({ keyDraft: e.target.value, keyError: false, keyStatus: 'idle' }),
      keyPlaceholder: 'Paste your key (' + prov.hint + ')', keyError: s.keyError, keyBorder: (s.keyError || s.keyStatus === 'invalid') ? 'var(--danger)' : s.keyStatus === 'valid' ? 'var(--success)' : 'var(--border-strong)',
      connect: () => this.connect(), connectOpacity: s.keyStatus === 'checking' ? '0.5' : '1',
      connectLabel: { idle: 'Test key', checking: 'Checking…', invalid: 'Test again', valid: 'Save and continue' }[s.keyStatus],
      keyChecking: s.keyStatus === 'checking', keyInvalid: s.keyStatus === 'invalid', keyValid: s.keyStatus === 'valid',
      foundModels: prov.found.map(name => ({ name })), foundCount: prov.found.length,
      keyType: s.showKey ? 'text' : 'password', eyeIcon: s.showKey ? 'ph ph-eye-slash' : 'ph ph-eye',
      toggleShowKey: () => this.setState(st => ({ showKey: !st.showKey })),
      pasteKey: () => this.setState({ keyDraft: 'sk-proj-8f2kQ7vLx0aN4f2a', keyError: false, keyStatus: 'idle' }),
      privacyRows: [{ icon: 'ph ph-hard-drives', text: 'Stored in chrome.storage on this device' }, { icon: 'ph ph-lock-simple', text: 'Never sent to my server — there isn\u2019t one' }, { icon: 'ph ph-trash', text: 'Remove it anytime in settings' }],
      showProgress: s.view === 'main',
      segs: CH.map((c, j) => { const end = j < CH.length - 1 ? CH[j + 1] : DUR, len = end - c, fr = Math.max(0, Math.min(1, (s.t - c) / len)); return { w: String(len), fill: (fr * 100).toFixed(1) + '%', title: CHAPTERS[c] + ' · ' + fmt(c), onClick: () => this.seek(c) }; }),
      isSummaryTab: main && !s.collapsed && s.tab === 'summary' && s.hasKey,
      openOpts: menu('opts'), optsMenu: s.menu === 'opts',
      leadFs: { s: '14px', m: '15px', l: '17px' }[set.size], leadLh: { s: '21px', m: '23px', l: '26px' }[set.size],
      isGate: main && s.tab !== 'transcript' && !s.hasKey,
      gateVerb: s.tab === 'chat' ? 'chat with videos' : 'summarize videos',
      gateRows: [{ icon: 'ph ph-coins', title: 'About $0.002 per summary', note: '4-minute video on GPT-5 mini' }, { icon: 'ph ph-lock-simple', title: 'Stays on this device', note: 'Sent only to the provider you pick' }, { icon: 'ph ph-closed-captioning', title: 'Transcript works without one', note: 'Search, follow and jump are free' }],
      openOnboarding: () => this.setState({ view: 'onboarding', menu: null }),
      goTranscript: () => this.setState({ tab: 'transcript' }),
      nowChapter: CHAPTERS[CH.filter(c => c <= s.t).pop()],
      nowLine: this.line(ai),
      explainNow: () => this.setState({ quote: ai }, () => this.send('Explain what he means here')),
      quoteNow: () => this.setState({ quote: ai }),
      quickActions: QUICK.filter(q => !q.draft).map(q => ({ icon: q.icon, label: q.label, note: q.note, onClick: () => q.draft ? this.setState({ draft: q.draft }) : this.send(q.prompt) })),
      hasHistory: true,
      history: [{ text: 'How is this different from ISR?', when: 'Yesterday', onClick: () => this.setState({ messages: HIST() }) }],
      usagePct: s.limit ? Math.min(100, 0.41 / s.limit * 100).toFixed(1) + '%' : '0%',
      limitLabel: s.limit ? '$0.41 of $' + s.limit + ' limit' : 'No limit set',
      limitSeg: [[1, '$1'], [5, '$5'], [20, '$20'], [0, 'Off']].map(([v, label]) => ({ label, bg: v === s.limit ? 'var(--bg)' : 'transparent', color: v === s.limit ? 'var(--fg)' : 'var(--fg-muted)', onClick: () => this.setState({ limit: v }) })),
      hasToast: !!s.toast, toast: s.toast
    };
  }
}
