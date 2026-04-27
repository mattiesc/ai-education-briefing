/**
 * Daily AI + EdTech Brief
 *
 * Fetches recent articles from RSS feeds, asks Gemini to synthesize them
 * into a clean HTML email, then sends it via Gmail. Designed to run on a
 * daily Apps Script time-driven trigger.
 *
 * Setup instructions: see SETUP.md in this repo.
 */

// === CONFIG — edit these ===
const GEMINI_API_KEY = 'PASTE_YOUR_KEY_HERE';
const RECIPIENT = 'mattiesc@stanford.edu';

const FEEDS = [
  { name: 'EdSurge',          url: 'https://www.edsurge.com/articles_rss' },
  { name: 'Hechinger Report', url: 'https://hechingerreport.org/feed/' },
  { name: 'Inside Higher Ed', url: 'https://www.insidehighered.com/news/tech-innovation/feed' },
  { name: 'Education Week',   url: 'https://www.edweek.org/feed' },
  { name: 'The 74 Million',   url: 'https://www.the74million.org/feed/' },
  { name: 'VentureBeat AI',   url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'MIT Tech Review',  url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { name: 'TechCrunch AI',    url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
];

const MAX_ITEMS_PER_FEED = 8;
const HOURS_LOOKBACK = 36;
const GEMINI_MODEL = 'gemini-2.5-pro';  // Pro is meaningfully better for analytical writing; free tier covers 1/day easily
const USE_GOOGLE_SEARCH = true;  // let Gemini search the web for additional/fresher stories
// === end config ===


function dailyBrief() {
  const items = fetchAllFeeds();
  console.log('Fetched ' + items.length + ' articles from ' + FEEDS.length + ' feeds');
  const brief = synthesize(items);
  sendEmail(brief, items.length);
}


function fetchAllFeeds() {
  const cutoff = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000);
  const items = [];

  for (const feed of FEEDS) {
    try {
      const response = UrlFetchApp.fetch(feed.url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (Apps Script Daily Brief)' },
      });
      if (response.getResponseCode() !== 200) {
        console.warn('Skip ' + feed.name + ': HTTP ' + response.getResponseCode());
        continue;
      }

      const root = XmlService.parse(response.getContentText()).getRootElement();
      const channel = root.getChild('channel');
      const entries = channel
        ? channel.getChildren('item')
        : root.getChildren('entry', root.getNamespace());

      let kept = 0;
      for (const entry of entries) {
        if (kept >= MAX_ITEMS_PER_FEED) break;

        const title = (entry.getChildText('title') || '').trim();

        let link = entry.getChildText('link') || '';
        if (!link) {
          const linkEl = entry.getChild('link', root.getNamespace());
          const hrefAttr = linkEl ? linkEl.getAttribute('href') : null;
          if (hrefAttr) link = hrefAttr.getValue();
        }

        const pubDate = entry.getChildText('pubDate') || '';
        const date = pubDate ? new Date(pubDate) : null;
        if (date && !isNaN(date.getTime()) && date < cutoff) continue;

        const description = entry.getChildText('description') || '';

        items.push({
          source: feed.name,
          title: title,
          link: link.trim(),
          summary: stripHtml(description).slice(0, 400),
        });
        kept++;
      }
    } catch (e) {
      console.warn('Feed error ' + feed.name + ': ' + e.message);
    }
  }

  return items;
}


function stripHtml(s) {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}


function synthesize(items) {
  if (items.length === 0) {
    return '<p>No new articles fetched today. The script ran but the RSS feeds returned nothing — they may be temporarily down or have no recent posts.</p>';
  }

  const articleList = items.map(function (a, i) {
    return (i + 1) + '. [' + a.source + '] ' + a.title +
           '\n   Link: ' + a.link +
           '\n   ' + a.summary;
  }).join('\n\n');

  const tz = Session.getScriptTimeZone();
  const todayLong = Utilities.formatDate(new Date(), tz, 'MMMM d, yyyy');
  const dayOfWeek = Utilities.formatDate(new Date(), tz, 'EEEE');
  const edition = (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') ? 'Weekend edition' : 'Weekday edition';

  const prompt =
    'You are the editor of a daily AI × Education briefing for an education professional at Stanford. Today is ' + todayLong + ' (' + dayOfWeek + '). The reader works in higher education and wants to stay current on AI developments, edtech, and the market forces shaping both.\n\n' +
    'Below are articles pulled in the last ' + HOURS_LOOKBACK + ' hours from RSS feeds. Treat them as a STARTING POINT, not the brief itself. The RSS snippet is just a pointer — when a story is worth including, use Google Search to read the actual article and underlying primary source so your write-up reflects what the story actually says, not what the RSS blurb says.\n\n' +
    'Use Google Search to:\n' +
    '(a) read the full text of stories you decide to include (do not paraphrase the RSS snippet),\n' +
    '(b) find major AI or edtech news from the last 24-48 hours not in the RSS list,\n' +
    '(c) specifically check for new blog posts, papers, product announcements, or model releases from major AI labs and edtech companies — Anthropic, OpenAI, Google DeepMind, Google Research, Google for Education, Meta AI, Microsoft Research, ChatGPT for Education, Gemini for Education, Claude for Education, Mistral, xAI, Cohere, Khan Academy, Duolingo, Coursera, Chegg, MagicSchool, Speak.\n\n' +
    '=== EDITORIAL STANDARDS — this is what makes the brief good ===\n\n' +
    'You are not summarizing the news. You are CURATING and INTERPRETING it for one specific reader: an education professional at Stanford who works in higher ed and is making real decisions about partnerships, hiring, vendor evaluation, faculty conversations, curriculum integration, and policy. Every item must earn its spot.\n\n' +
    'For each story you choose to include:\n\n' +
    '1. LEAD WITH THE NEWS. Open with what actually happened, with concrete specifics — names, dollar amounts, dates, products, partners, integrations. No setup paragraphs. No "AI is transforming education" framing.\n' +
    '2. DELIVER REAL ANALYSIS in "Why it matters". This is the most important sentence in the item. It must be SPECIFIC to higher ed work — connect the news to a concrete decision, signal, or shift the reader can act on.\n' +
    '   - GOOD: "For education recruiting: Anthropic\'s edu platform now has dramatically expanded runway — expect dedicated education go-to-market and partnership headcount to be in high demand."\n' +
    '   - GOOD: "The Codex integration uses district SSO, which removes a common procurement blocker — faculty piloting agentic tools should pressure-test their IT teams\' readiness."\n' +
    '   - GOOD: "Bain (not just Sequoia) led the round, signaling enterprise edtech is becoming venture-grade — small startups in the space are about to face a much harder fundraise."\n' +
    '   - BAD: "This is an exciting development in AI." / "This is important for educators." / "Stay tuned as this story evolves." / "This shows how AI continues to transform learning." (NEVER write these — they are vacuous filler.)\n' +
    '3. NAME THE TENSION OR SIGNAL. Don\'t just describe; identify what makes this newsworthy beyond the press-release angle. What does this say about the industry? What\'s the second-order effect?\n' +
    '4. CITE PRIMARY SOURCES. The first link in the Sources line should be the company\'s own blog/paper/press release whenever possible. Then secondary outlets for context.\n\n' +
    '=== CURATION DISCIPLINE ===\n\n' +
    'Be ruthless. The RSS feeds will hand you ~50+ items. Most should NOT make the brief. Drop:\n' +
    '- Any story that fails the "so what for higher ed?" test\n' +
    '- Press-release rewrites with no actual news\n' +
    '- Listicles, opinion fluff, "5 ways AI will change..." pieces\n' +
    '- Stories where the only specifics are vague claims\n' +
    '- Duplicates (pick the best version, not all of them)\n' +
    '- Items older than 48 hours unless materially still developing\n' +
    '- Anything that\'s really about a different topic with AI shoehorned in\n\n' +
    'A short, sharp brief beats a long, padded one. If a section has no real news today, write one line saying so and move on. Do not invent items.\n\n' +
    '=== OUTPUT FORMAT — match exactly ===\n\n' +
    'Start with a serif masthead block:\n\n' +
    '<h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 4px 0;">AI &times; Education Brief</h1>\n' +
    '<p style="color:#666;font-size:13px;margin:0 0 8px 0;">' + todayLong + ' &nbsp;&middot;&nbsp; ' + edition + '</p>\n' +
    '<hr style="border:none;border-top:1px solid #333;margin:0 0 20px 0;">\n\n' +
    'Then for each section, use a small-caps section header:\n\n' +
    '<h3 style="font-size:12px;letter-spacing:0.1em;color:#666;text-transform:uppercase;margin:24px 0 12px 0;border-bottom:1px solid #ddd;padding-bottom:6px;">From the Companies</h3>\n\n' +
    'Then numbered items in this exact pattern:\n\n' +
    '<p style="margin:0 0 6px 0;"><strong>1. OpenAI Opens Codex-Powered Workspace Agents to All ChatGPT Edu &amp; Teachers Plans</strong> <span style="color:#888;font-weight:normal;">(Apr 22)</span></p>\n' +
    '<p style="margin:0 0 6px 0;">OpenAI extended its new Workspace Agents feature to every ChatGPT Edu and Teachers subscriber last Tuesday. Powered by Codex, the agents execute multi-step workflows in natural language: auto-drafting family updates from class notes, routing student advising queries, summarizing grant calls, and connecting to Canva, Google Drive, and Microsoft 365. The research preview is free through May 5; credit-based pricing begins May 6. OpenAI is running a live educator Build Hour on <strong>April 28</strong>. <em>Why it matters:</em> This is OpenAI\'s clearest move yet to embed agentic infrastructure directly into school and district workflows — teams hiring for edu go-to-market or curriculum integration roles should expect this to accelerate adoption conversations.</p>\n' +
    '<p style="margin:0 0 20px 0;color:#666;font-size:13px;">Sources: <a href="URL">OpenAI blog</a> &middot; <a href="URL">EdTech Innovation Hub</a> &middot; <a href="URL">9to5Mac</a></p>\n\n' +
    'Notice the pattern:\n' +
    '- Bold sentence-case headline that names the company naturally (NOT all-caps prefix). Number it.\n' +
    '- Short date in gray parens at end of headline: (Apr 22) — abbreviated month, no year.\n' +
    '- Body paragraph: lead with the news + concrete specifics (dates, prices, integrations), then "Why it matters:" in italics introducing the implication for an education professional.\n' +
    '- Sources line: smaller, gray, primary source listed FIRST (the company\'s own blog/paper), then secondary outlets, separated by middle dots (&middot;). Always anchor text, never bare URLs.\n\n' +
    'Section order (use these exact section headers in this order):\n\n' +
    '1. From the Companies — publications, blog posts, papers, products, model releases, partnerships from any org listed above. Lead with primary sources. If a major company had nothing in the window, do not invent something — name it in the Quiet line at the end.\n' +
    '2. Market Forces — funding rounds, valuations, M&A, IPOs, layoffs, regulatory/antitrust action, policy.\n' +
    '3. AI in Education — K-12, higher ed, university adoption, faculty perspectives, student impact, classroom tooling, equity research.\n' +
    '4. Other AI of Note — anything else significant: research breakthroughs, notable opinion pieces, infrastructure shifts.\n\n' +
    'End with a Quiet line — italic, gray, listing orgs that had nothing worth flagging:\n\n' +
    '<p style="color:#666;font-style:italic;font-size:13px;margin:24px 0 0 0;border-top:1px solid #ddd;padding-top:12px;">Quiet this window: Anthropic, Google for Education, xAI, Meta AI, Mistral, MagicSchool, Chegg, Speak.</p>\n\n' +
    '=== Rules ===\n' +
    '- Target a ~5-minute read (roughly 800-1200 words total). Cut, do not pad.\n' +
    '- Every item: 2-4 substantive sentences. Lead with news + specifics, then "Why it matters:" + implication. No fluff.\n' +
    '- Number items within each section starting from 1.\n' +
    '- Date every item: (MMM D) format like (Apr 22).\n' +
    '- Use <a href="URL">Outlet Name</a> for all links. NEVER bare URLs.\n' +
    '- Drop anything not actually about AI or education. Skip duplicates and press-release filler.\n' +
    '- Tone: smart, dry, concise. No hype, no emojis, no marketing language. Write like Stratechery, not Morning Brew.\n' +
    '- Output a valid HTML email body. Do NOT include <html>, <head>, or <body> tags. Do NOT wrap output in markdown code fences.\n\n' +
    'RSS articles to start from:\n' + articleList;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (USE_GOOGLE_SEARCH) {
    payload.tools = [{ google_search: {} }];
  }

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Gemini API error ' + response.getResponseCode() + ': ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  let text = parts.map(function (p) { return p.text || ''; }).join('');
  text = text.replace(/^\s*```html\s*/i, '')
             .replace(/^\s*```\s*/i, '')
             .replace(/```\s*$/i, '')
             .trim();
  return text;
}


function sendEmail(htmlBody, count) {
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'MMM d');
  const subject = 'AI × Education Brief — ' + today;
  const footer =
    '<p style="color:#aaa;font-size:11px;margin-top:24px;">' +
    'Generated from ' + count + ' articles across ' + FEEDS.length + ' sources, ' +
    'with live Google Search for additional coverage.' +
    '</p>';

  GmailApp.sendEmail(RECIPIENT, subject, '', {
    htmlBody: htmlBody + footer,
    name: 'AI × Education Brief',
  });
}
