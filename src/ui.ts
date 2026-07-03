// ---------------------------------------------------------------------------
// UI toolkit: GoComet-style theme tokens, page layout, and reusable components
// including inline-SVG charts (no external CDNs, everything self-contained).
//
// ALL brand colors/fonts live in THEME below - swap in exact GoComet brand
// values here in one place when available.
// ---------------------------------------------------------------------------

import { ROLE_LABELS, type Role } from "./data";

// ---- Brand theme (APPROXIMATION - replace hex/font with exact GoComet brand) --
export const THEME = {
  brand: "#1B4DFF",
  brandDark: "#123BCC",
  ink: "#0B1F3A",
  good: "#12B76A",
  warn: "#F79009",
  bad: "#D92D20",
  muted: "#667085",
  line: "#E4E7EC",
  bg: "#F5F7FB",
  card: "#FFFFFF",
};

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLES = `
  :root {
    --brand:#1B4DFF; --brand-08:rgba(27,77,255,.08); --ink:#0B1F3A;
    --good:#12B76A; --warn:#F79009; --bad:#D92D20; --muted:#667085;
    --line:#E4E7EC; --bg:#F5F7FB; --card:#FFFFFF;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:14px; }
  a { color:var(--brand); text-decoration:none; }
  .app { display:flex; min-height:100vh; }
  .side { width:220px; flex:none; background:var(--ink); color:#dfe4f0; padding:18px 0; }
  .side .logo { font-weight:800; font-size:16px; padding:0 20px 16px; color:#fff; letter-spacing:.02em; }
  .side .logo span { color:#7aa0ff; }
  .side a { display:block; color:#c3ccdf; padding:10px 20px; font-size:14px; font-weight:600; }
  .side a:hover { background:rgba(255,255,255,.06); color:#fff; }
  .side a.active { background:var(--brand); color:#fff; }
  .side .grp { color:#7f8aa3; font-size:11px; text-transform:uppercase; letter-spacing:.06em; padding:16px 20px 6px; }
  .main { flex:1; min-width:0; }
  .top { display:flex; justify-content:space-between; align-items:center; gap:16px;
    padding:14px 26px; background:#fff; border-bottom:1px solid var(--line); }
  .top h1 { margin:0; font-size:19px; }
  .who { font-size:13px; color:var(--muted); }
  .who .role { background:var(--brand-08); color:var(--brand); border-radius:999px; padding:3px 10px; font-weight:700; margin-left:6px; }
  .wrap { padding:22px 26px 64px; max-width:1200px; }
  .btn { display:inline-block; background:var(--brand); color:#fff; border:none; border-radius:9px;
    padding:9px 15px; font-size:14px; font-weight:600; cursor:pointer; }
  .btn.secondary { background:var(--brand-08); color:var(--brand); }
  .btn.ghost { background:#fff; color:var(--muted); border:1px solid var(--line); }
  .btn.danger { background:#fde7e6; color:var(--bad); }
  .btn.small { padding:6px 11px; font-size:13px; border-radius:8px; }
  .row { display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:6px 0 20px; }
  @media (max-width:900px){ .cards{ grid-template-columns:repeat(2,1fr);} .side{ display:none; } }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .stat .num { font-size:26px; font-weight:800; }
  .stat .lbl { color:var(--muted); font-size:12.5px; margin-top:3px; }
  .stat .sub { color:var(--muted); font-size:11.5px; margin-top:6px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:900px){ .grid2{ grid-template-columns:1fr; } }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; margin-bottom:16px; }
  .panel h2 { margin:0; padding:14px 18px; font-size:15px; border-bottom:1px solid var(--line); }
  .panel .body { padding:16px 18px; }
  .tablewrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th { text-align:left; color:var(--muted); font-weight:600; font-size:11.5px; text-transform:uppercase;
    letter-spacing:.03em; padding:11px 16px; border-bottom:1px solid var(--line); white-space:nowrap; }
  td { padding:12px 16px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .name { font-weight:700; }
  .sub { color:var(--muted); font-size:12px; margin-top:2px; }
  .sub.bad { color:var(--bad); }
  .chip { display:inline-block; background:var(--brand-08); color:var(--brand); border-radius:999px; padding:2px 9px; font-size:11.5px; font-weight:700; }
  .chip.gray { background:#eef1f6; color:var(--muted); }
  .bar { background:#eef1f6; border-radius:999px; height:7px; overflow:hidden; }
  .bar span { display:block; height:100%; background:var(--brand); }
  .st { border-radius:999px; padding:3px 10px; font-size:11.5px; font-weight:700; white-space:nowrap; }
  .st-good{ background:#e6f6ee; color:var(--good);} .st-warn{ background:#fdf1e0; color:var(--warn);}
  .st-bad{ background:#fde7e6; color:var(--bad);} .st-done{ background:var(--brand-08); color:var(--brand);}
  .st-muted{ background:#eef1f6; color:var(--muted);}
  .field { margin-bottom:13px; } .field label{ display:block; font-size:12.5px; font-weight:600; margin-bottom:5px; }
  .field input,.field select,.field textarea{ width:100%; padding:9px 11px; border:1px solid var(--line); border-radius:9px; font-size:14px; background:#fff; font-family:inherit; }
  .row2{ display:grid; grid-template-columns:1fr 1fr; gap:13px; } .row3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:13px; }
  @media (max-width:640px){ .row2,.row3{ grid-template-columns:1fr; } }
  .tabs{ display:flex; gap:8px; margin:4px 0 16px; flex-wrap:wrap; }
  .tabs a{ padding:7px 13px; border-radius:999px; font-size:13.5px; font-weight:600; background:#eef1f6; color:var(--muted); }
  .tabs a.active{ background:var(--brand); color:#fff; }
  .banner{ background:#fff8ec; border:1px solid #fbe3b8; color:#8a5a00; padding:10px 14px; border-radius:10px; font-size:13px; margin:12px 0; }
  .banner.bad{ background:#fdeceb; border-color:#f6c9c5; color:#8a2018; }
  .steps{ list-style:none; padding:0; margin:0; } .steps li{ display:flex; gap:10px; padding:9px 0; border-bottom:1px solid var(--line);}
  .steps li:last-child{ border-bottom:none;} .dot{ width:16px;height:16px;border-radius:50%;border:2px solid var(--line);flex:none;margin-top:2px;}
  .dot.done{ background:var(--brand); border-color:var(--brand);} .dot.current{ border-color:var(--brand); box-shadow:0 0 0 3px var(--brand-08);}
  .muted{ color:var(--muted);} .right{ text-align:right;} form.inline{ display:inline;}
  .legend{ display:flex; gap:14px; flex-wrap:wrap; font-size:12px; color:var(--muted); margin-top:8px;}
  .legend i{ display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:5px; vertical-align:middle;}
`;

type NavItem = { href: string; label: string; group?: string };

export function layout(opts: {
  title: string;
  user?: { name: string; email: string; role: Role };
  active?: string;
  body: string;
}): string {
  const { title, user, active, body } = opts;
  const nav: NavItem[] = [];
  if (user) {
    nav.push({ href: "/", label: "Dashboard", group: "Overview" });
    nav.push({ href: "/analytics", label: "Analytics" });
    nav.push({ href: "/candidates", label: "Candidates", group: "Pipeline" });
    if (user.role !== "viewer" && user.role !== "management")
      nav.push({ href: "/candidates/new", label: "Add candidate" });
    if (user.role !== "viewer" && user.role !== "management")
      nav.push({ href: "/import", label: "Import from sheet" });
    if (user.role === "admin") {
      nav.push({ href: "/team", label: "Team", group: "Admin" });
      nav.push({ href: "/settings", label: "Settings" });
      nav.push({ href: "/outbox", label: "Notifications log" });
      nav.push({ href: "/audit", label: "Audit trail" });
    }
  }
  let sideHtml = "";
  let lastGroup = "";
  for (const n of nav) {
    if (n.group && n.group !== lastGroup) {
      sideHtml += `<div class="grp">${esc(n.group)}</div>`;
      lastGroup = n.group;
    }
    const cls = active === n.href ? "active" : "";
    sideHtml += `<a href="${n.href}" class="${cls}">${esc(n.label)}</a>`;
  }

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} · GoComet Onboarding</title><style>${STYLES}</style></head>
<body>${user ? `<div class="app">
  <nav class="side"><div class="logo">Go<span>Comet</span> · Onboarding</div>${sideHtml}</nav>
  <div class="main">
    <div class="top"><h1>${esc(title)}</h1>
      <div class="who">${esc(user.name || user.email)}<span class="role">${ROLE_LABELS[user.role]}</span></div></div>
    <div class="wrap">${body}</div>
  </div></div>` : `<div class="wrap" style="max-width:640px;margin:40px auto">${body}</div>`}
</body></html>`;
}

// ---- Small components ------------------------------------------------------
export function stat(num: string | number, lbl: string, sub = ""): string {
  return `<div class="stat"><div class="num">${esc(num)}</div><div class="lbl">${esc(lbl)}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}
export function chip(text: string, gray = false): string {
  return `<span class="chip${gray ? " gray" : ""}">${esc(text)}</span>`;
}
export function statusPill(label: string, tone: string): string {
  return `<span class="st st-${tone}">${esc(label)}</span>`;
}

// ---- Charts (inline SVG) ---------------------------------------------------
export function barChart(data: { label: string; value: number }[], opts: { color?: string; height?: number } = {}): string {
  const color = opts.color ?? THEME.brand;
  const h = opts.height ?? 180;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = 100 / Math.max(1, data.length);
  const bars = data
    .map((d, i) => {
      const bh = (d.value / max) * (h - 30);
      const x = i * bw + bw * 0.15;
      const w = bw * 0.7;
      const y = h - 22 - bh;
      return `<rect x="${x}%" y="${y}" width="${w}%" height="${bh}" rx="4" fill="${color}"></rect>
        <text x="${x + w / 2}%" y="${h - 6}" font-size="10" fill="#667085" text-anchor="middle">${esc(d.label)}</text>
        <text x="${x + w / 2}%" y="${y - 4}" font-size="10" font-weight="700" fill="#0B1F3A" text-anchor="middle">${d.value}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" style="overflow:visible">${bars}</svg>`;
}

export function funnelChart(data: { label: string; value: number }[]): string {
  const max = Math.max(1, ...data.map((d) => d.value));
  return `<div>${data
    .map((d) => {
      const pct = Math.round((d.value / max) * 100);
      return `<div style="margin:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
          <span style="font-weight:600">${esc(d.label)}</span><span class="muted">${d.value}</span></div>
        <div class="bar" style="height:14px"><span style="width:${pct}%"></span></div></div>`;
    })
    .join("")}</div>`;
}

export function donut(segments: { label: string; value: number; color: string }[]): string {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 55, cx = 70, cy = 70, sw = 24;
  const circ = 2 * Math.PI * r;
  const arcs = segments
    .map((s) => {
      const frac = s.value / total;
      const dash = frac * circ;
      const gap = circ - dash;
      const off = -acc * circ;
      acc += frac;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
        stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    })
    .join("");
  const legend = segments
    .map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)} (${s.value})</span>`)
    .join("");
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    <svg width="140" height="140" viewBox="0 0 140 140">${arcs}
      <text x="70" y="66" text-anchor="middle" font-size="22" font-weight="800" fill="#0B1F3A">${total}</text>
      <text x="70" y="84" text-anchor="middle" font-size="10" fill="#667085">total</text></svg>
    <div class="legend" style="flex-direction:column;gap:6px">${legend}</div></div>`;
}
