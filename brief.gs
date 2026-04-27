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
  { name: 'VentureBeat AI',   url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'MIT Tech Review',  url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
];

const MAX_ITEMS_PER_FEED = 8;
const HOURS_LOOKBACK = 36;
const GEMINI_MODEL = 'gemini-2.5-flash';
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

  const prompt =
    'You are the editor of a daily AI + EdTech briefing for an education professional at Stanford.\n\n' +
    'Below are articles pulled in the last ' + HOURS_LOOKBACK + ' hours from edtech and AI news sources. Write a clean HTML email digest:\n\n' +
    '1. Open with a 2-sentence "top of the brief" — what was the most important thing in AI + edtech today?\n' +
    '2. Group the rest into 3-5 themed sections (e.g., "AI in Higher Ed", "K-12 Classrooms", "Policy & Funding", "Industry Moves").\n' +
    '3. Under each story: a 1-2 sentence plain-language takeaway, then the link.\n' +
    '4. Drop anything that is not actually about AI or education. Skip duplicates.\n' +
    '5. Tone: smart, dry, concise. No hype, no emojis, no marketing language.\n\n' +
    'Output a valid HTML email body — use <h2>, <h3>, <p>, <a href="">. Do NOT include <html>, <head>, or <body> tags.\n\n' +
    'Articles:\n' + articleList;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Gemini API error ' + response.getResponseCode() + ': ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());
  return data.candidates[0].content.parts[0].text;
}


function sendEmail(htmlBody, count) {
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'EEEE, MMMM d');
  const subject = 'AI + EdTech Brief — ' + today;
  const footer =
    '<hr><p style="color:#888;font-size:12px">' +
    'Generated from ' + count + ' articles across ' + FEEDS.length + ' sources. ' +
    'Edit feeds, prompt, or tone in your Apps Script project.' +
    '</p>';

  GmailApp.sendEmail(RECIPIENT, subject, '', {
    htmlBody: htmlBody + footer,
    name: 'Daily Brief',
  });
}
