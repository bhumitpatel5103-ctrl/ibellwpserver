/**
 * Sample data for DEMO_MODE: a believable B2B mobile-phone dealer book,
 * so every screen has something on it the first time someone opens the demo.
 * Never runs against a real database.
 */
import { contacts, campaigns, dailyStats, settingsCol, batches, leadLinks, conversations } from "./data/collections.js";
import { quickRead } from "./engine/leads.js";
import { writeRecipients } from "./data/recipients.js";
import { logMessage } from "./data/inbox.js";
import { DEFAULTS } from "./data/settings.js";
import { dayKey } from "./engine/rules.js";

const PEOPLE = [
  ["Yosef Katz", "Katz Cellular Ltd", "972521234567", "IL", "Ramat Gan", ["VIP", "Distributor"], { Budget: "$250k", "Interested In": "Smartphones" }],
  ["Ahmed Al Mansoori", "Al Mansoori Mobiles", "971501234567", "AE", "Dubai", ["VIP", "Retailer", "GITEX 2026"], { Budget: "$120k", "Interested In": "Smartphones" }],
  ["Linda Chen", "Golden Lotus Telecom", "85291234567", "HK", "Hong Kong", ["HK Electronics Fair", "Retailer"], { Budget: "$80k", "Interested In": "Accessories" }],
  ["Pieter Janssens", "Janssens & Zoon BV", "32470123456", "BE", "Antwerp", ["Distributor"], { Budget: "$300k" }],
  ["Michael Goldberg", "Goldberg Wireless", "12125550147", "US", "New York", ["VIP", "Retailer"], { Budget: "$150k", "Interested In": "Earphones" }],
  ["Sarah Thompson", "Thompson Phones", "447911123456", "GB", "London", ["Retailer", "Accessories"], { "Interested In": "Chargers & cables" }],
  ["Omar Farouk", "Farouk Mobile Centre", "971552345678", "AE", "Sharjah", ["Retailer", "GITEX 2026"], {}],
  ["Wei Zhang", "Shenzhen Digital Trading", "8613800138000", "CN", "Shenzhen", ["Distributor", "HK Electronics Fair"], { Budget: "$500k" }],
  ["Rachel Levi", "Levi Telecom", "972541112233", "IL", "Tel Aviv", ["Distributor"], {}],
  ["Khalid Al Rashid", "Rashid Mobile House", "966501234567", "SA", "Riyadh", ["VIP", "Retailer"], { Budget: "$200k", "Interested In": "Feature phones" }],
  ["Emma Dubois", "Maison Dubois Mobile", "33612345678", "FR", "Paris", ["Retailer", "Accessories"], {}],
  ["Takeshi Sato", "Sato Denki", "819012345678", "JP", "Tokyo", ["Retailer"], {}],
  ["Anna Rossi", "Rossi Telefonia", "393312345678", "IT", "Milan", ["Retailer"], { "Interested In": "Smartwatches" }],
  ["David Cohen", "Cohen Brothers Electronics", "12125550199", "US", "New York", ["Distributor", "VIP"], { Budget: "$400k" }],
  ["Fatima Hassan", "Pearl Mobile Qatar", "97433123456", "QA", "Doha", ["Retailer"], {}],
  ["Somchai Wong", "Bangkok Phone House", "66812345678", "TH", "Bangkok", ["Distributor"], {}],
  ["Lucas Weber", "Weber Handy", "4915112345678", "DE", "Munich", ["Retailer"], {}],
  ["Priya Nair", "Nair Mobiles Singapore", "6591234567", "SG", "Singapore", ["Retailer", "HK Electronics Fair"], {}],
  ["James Wilson", "Wilson & Co", "61412345678", "AU", "Sydney", ["Retailer"], {}],
  ["Hassan Karimi", "Karimi Trading LLC", "971509998000", "AE", "Dubai", ["Distributor"], {}],
  ["", "Mobile Hub FZE", "971561234567", "AE", "Dubai", ["GITEX 2026"], {}],
  ["Mr. Alan Brooks", "Brooks Communications", "447700123456", "GB", "Birmingham", ["Retailer"], {}],
];

export async function seedDemo() {
  if (contacts.size) return;
  const now = Date.now();
  const tz = DEFAULTS.timezone;

  await settingsCol.put("app", { ...DEFAULTS, minDelay: 4, maxDelay: 9, window: { ...DEFAULTS.window, enabled: false } });

  await contacts.putMany(
    PEOPLE.map(([name, company, phone, country, city, tags, fields], i) => ({
      id: phone, phone, name, company, email: "", country, city, tags, notes: "", fields,
      optedOut: i === 15, waStatus: phone.endsWith("000") ? "invalid" : "valid",
      source: i < 19 ? "import" : "manual", createdAt: now - (30 - i) * 86400000, updatedAt: now - i * 3600000,
    })),
  );

  // Two enquiries that arrived on their own.
  const inquiries = [
    ["971585551234", "Rashid Traders", "Hi, do you supply 5G smartphones? Need price for 200 pcs."],
    ["85298887777", "Mandy Lau", "Saw your post. Please send your latest catalogue."],
  ];
  for (const [phone, name, text] of inquiries) {
    await contacts.put(phone, {
      phone, name, company: "", email: "", country: phone.startsWith("971") ? "AE" : "HK", city: "", tags: ["Inquiry"],
      notes: "", fields: {}, optedOut: false, waStatus: "valid", source: "inbound",
      createdAt: now - 2 * 3600000, updatedAt: now - 2 * 3600000, lastMessageAt: now - 2 * 3600000,
    });
    await logMessage({ phone, dir: "in", text, at: now - 2 * 3600000, name });
  }

  // A finished campaign, with replies in the inbox.
  const done = PEOPLE.slice(0, 12);
  // Receipts and replies, so the campaign page shows how clients responded.
  const repliedPhones = new Set(["971501234567", "972521234567", "12125550147"]);
  await writeRecipients("cdemo1", done.map(([n, , p], i) => {
    const t = now - 3 * 86400000 + i * 20000;
    if (i === 7) return { p, n, s: "failed", t, e: "Not on WhatsApp" };
    return {
      p, n, s: "sent", t, d: t + 4000,
      ...(i % 4 !== 3 ? { r: t + 600000 } : null),
      ...(repliedPhones.has(p) ? { rp: t + 3600000 } : null),
    };
  }));
  await campaigns.put("cdemo1", {
    name: "New Smartphone Launch", status: "completed", materialized: true, chunkCount: 1,
    message: "{Hello|Hi|Dear} {{first_name|Sir/Madam}},\n\nOur *new smartphone range* is here — 5G models with big batteries and fast charging, plus matching accessories.\n\nReply *YES* for the catalogue and dealer prices.\n\n— {{business_name}}",
    mediaId: null, audience: { mode: "all", tags: [], tagMatch: "any", contactIds: [], excludeTags: [] },
    minDelay: 12, maxDelay: 30, scheduledAt: now - 3 * 86400000,
    stats: { total: 12, pending: 0, sent: 11, failed: 1, skipped: 0, delivered: 11, read: 9, replied: 3, optedOut: 0 },
    createdAt: now - 4 * 86400000, updatedAt: now - 3 * 86400000, startedAt: now - 3 * 86400000, finishedAt: now - 3 * 86400000 + 300000,
  });
  const replies = [
    ["971501234567", "Ahmed Al Mansoori", "YES please send. Also need 500 pcs of the 128GB model."],
    ["972521234567", "Yosef Katz", "Interested. What are your dealer rates for 50 units?"],
    ["12125550147", "Michael Goldberg", "Please share videos of the new earbuds"],
  ];
  for (const [i, [phone, name, text]] of replies.entries()) {
    await logMessage({ phone, dir: "out", text: "Our new smartphone range is here — reply YES for the catalogue.", at: now - 3 * 86400000, name, campaignId: "cdemo1" });
    await logMessage({ phone, dir: "in", text, at: now - (20 - i * 6) * 3600000, name });
  }

  await campaigns.put("cdemo2", {
    name: "GITEX Dubai invite", status: "scheduled", materialized: false,
    message: "Dear {{first_name|Sir/Madam}},\n\nWe will be at *GITEX Dubai 2026*. Visit us at Hall 3, Booth D-12 to see our new smartphones and accessories.\n\nReply to book a meeting slot.",
    mediaId: null, audience: { mode: "tags", tags: ["GITEX 2026"], tagMatch: "any", contactIds: [], excludeTags: [] },
    minDelay: 12, maxDelay: 30, scheduledAt: now + 26 * 3600000, stats: null,
    createdAt: now - 3600000, updatedAt: now - 3600000,
  });
  await campaigns.put("cdemo3", {
    name: "Diwali greetings", status: "draft", materialized: false,
    message: "{Warm|Best} Diwali wishes to you and the {{company|team}} family from all of us at {{business_name}} ✨",
    mediaId: null, audience: { mode: "all", tags: [], tagMatch: "any", contactIds: [], excludeTags: [] },
    minDelay: 12, maxDelay: 30, scheduledAt: null, stats: null, createdAt: now - 7200000, updatedAt: now - 7200000,
  });

  const daily = [];
  for (let i = 13; i >= 0; i -= 1) {
    const sent = i === 3 ? 11 : Math.round(Math.max(0, 18 * Math.sin(i / 2) + 14 + ((i * 7) % 9)));
    daily.push({ id: dayKey(now - i * 86400000, tz), sent, failed: i % 4 === 0 ? 1 : 0, inbound: Math.round(sent / 5) + (i % 3), newContacts: i % 5 === 0 ? 2 : 0 });
  }
  daily[daily.length - 1] = { ...daily[daily.length - 1], sent: 0, failed: 0, inbound: 2, newContacts: 2 };
  await dailyStats.putMany(daily.map((d) => ({ ...d, date: d.id })));
  // Two client batches, one with a broadcast already sent to it.
  const vip = PEOPLE.filter((p) => p[5].includes("VIP")).map((p) => p[2]);
  const hk = PEOPLE.filter((p) => p[5].includes("HK Electronics Fair")).map((p) => p[2]);
  await batches.put("bdemo1", {
    name: "VIP partners", description: "Top distributor and retail partners — first to see every new launch.",
    color: "violet", contactIds: vip, createdAt: now - 10 * 86400000, updatedAt: now - 2 * 86400000,
  });
  await batches.put("bdemo2", {
    name: "HK Electronics Fair leads", description: "Buyers met at the Hong Kong Electronics Fair.",
    color: "pink", contactIds: hk, createdAt: now - 6 * 86400000, updatedAt: now - 6 * 86400000,
  });
  await writeRecipients("cdemo4", vip.map((p, i) => {
    const t = now - 2 * 86400000 + i * 25000;
    return { p, n: PEOPLE.find((x) => x[2] === p)[0], s: "sent", t, d: t + 3000, ...(i % 2 === 0 ? { r: t + 900000 } : null), ...(i < 2 ? { rp: t + 5400000 } : null) };
  }));
  await campaigns.put("cdemo4", {
    name: "VIP preview — new 5G series", status: "completed", materialized: true, chunkCount: 1,
    message: "Dear {{first_name|Sir/Madam}},\n\nAs one of our *VIP partners*, you get the first look at our new 5G smartphone series — before it reaches the market.\n\nReply *YES* for the video catalogue.\n\n— {{business_name}}",
    mediaId: null, audience: { mode: "batch", batchIds: ["bdemo1"], batchNames: ["VIP partners"], tags: [], tagMatch: "any", contactIds: [], excludeTags: [] },
    minDelay: 12, maxDelay: 30, scheduledAt: now - 2 * 86400000,
    stats: { total: vip.length, pending: 0, sent: vip.length, failed: 0, skipped: 0, delivered: vip.length, read: Math.ceil(vip.length / 2), replied: Math.min(2, vip.length), optedOut: 0 },
    createdAt: now - 3 * 86400000, updatedAt: now - 2 * 86400000, startedAt: now - 2 * 86400000, finishedAt: now - 2 * 86400000 + 200000,
  });
  // Lead links, as if used at a show and on the website.
  await leadLinks.put("lldemo1", {
    name: "HK Electronics Fair — Oct 2026", code: "HKEF2026", source: "event",
    prefill: "Hello IBELL MOBILE, we met at the Hong Kong Electronics Fair. Please share your latest range and dealer prices.",
    tags: ["HK Electronics Fair"], batchId: "bdemo2", active: true,
    welcome: "Dear {{first_name|Sir/Madam}},\n\nThank you for visiting us at the Hong Kong Electronics Fair 📱 Our team will send you the new range with dealer prices shortly.\n\n— {{business_name}}",
    leads: 3, lastLeadAt: now - 5 * 3600000, createdAt: now - 9 * 86400000, updatedAt: now - 9 * 86400000,
  });
  await leadLinks.put("lldemo2", {
    name: "Website — WhatsApp button", code: "WEBSITE", source: "website",
    prefill: "Hello, I found you on your website and would like to know more about your mobile phones.",
    tags: ["Website"], batchId: null, active: true, welcome: "",
    leads: 5, lastLeadAt: now - 2 * 3600000, createdAt: now - 20 * 86400000, updatedAt: now - 20 * 86400000,
  });

  // Lead Radar verdicts for the conversations above (the live app does this as messages arrive).
  const seen = [
    ["971585551234", inquiries[0][2], now - 2 * 3600000],
    ["85298887777", inquiries[1][2], now - 2 * 3600000],
    ...replies.map(([p, , t], i) => [p, t, now - (20 - i * 6) * 3600000]),
  ];
  for (const [phone, text, at] of seen) {
    const v = quickRead(text);
    await conversations.patch(phone, { lead: { ...v, by: "rules", at, ...(v.level === "hot" ? { firstHotAt: at } : null) } });
    await contacts.patch(phone, { lead: { level: v.level, intent: v.intent, summary: v.summary, at } });
  }
  console.log("[demo] sample data loaded");
}
