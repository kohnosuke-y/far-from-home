import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, Bell, ChevronLeft, Home, AlertTriangle, Navigation, Settings, X } from "lucide-react";

const C = {
  bg: "#05080E", card: "#0C1525", cardE: "#111E32",
  border: "rgba(80,130,220,0.09)", accent: "#FF5A1F",
  green: "#00D490", red: "#FF3B5C", blue: "#3D8EFF",
  purple: "#9B6FFF", amber: "#FFAB00", white: "#DCE8FF",
  sub: "#4A6080", muted: "#162030",
};

function fmtMin(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function fmt(d) {
  if (!d) return "--:--";
  return `${d.h}:${String(d.m).padStart(2, "0")}`;
}
function secLeft(depart) {
  if (!depart) return null;
  const now = new Date();
  const departSec = depart.h * 3600 + depart.m * 60;
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return departSec - nowSec;
}
function playAlarm() {
  try {
    const ctx = new AudioContext();
    [0, 0.5, 1.0, 1.5, 2.0].forEach(d => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = d % 1 === 0 ? 880 : 660;
      g.gain.setValueAtTime(0.5, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.4);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.4);
    });
  } catch (e) {}
}
function cs(extra = {}) {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 18px", ...extra };
}
function Label({ children }) {
  return <div style={{ fontSize: 11, color: C.sub, marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>{children}</div>;
}
function Pill({ color, children }) {
  return <span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}22`, padding: "3px 8px", borderRadius: 6 }}>{children}</span>;
}
function Toggle({ on }) {
  return (
    <div style={{ width: 50, height: 28, background: on ? C.green : C.muted, borderRadius: 14, position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "white", transition: "left 0.3s" }} />
    </div>
  );
}

// ルート生成（現在地名・帰る場所名を受け取る）
function buildRoutes(now, fromName, toName) {
  const base = now.h * 60 + now.m;
  const d1 = base + 8;
  const d2 = base + 13;
  const d3 = base + 20;
  return [
    {
      id: "t1", mode: "train", badge: "おすすめ", badgeColor: C.green,
      name: "竹橋経由 東西線ルート",
      steps: [
        { icon: "🚶", label: "徒歩 5分", note: `${fromName} → 竹橋` },
        { icon: "🚆", label: "東西線→大手町乗換", note: "3駅・9分" },
        { icon: "🚆", label: "総武線快速", note: `東京 → ${toName}・43分` },
      ],
      cost: 290, time: 57,
      lastTrain: fmtMin(base + 53),
      depart: { h: Math.floor(d1 / 60) % 24, m: d1 % 60 },
      urgency: "warning", routeColor: C.green,
    },
    {
      id: "t2", mode: "train", badge: "急いで！", badgeColor: C.red,
      name: "東京駅まで徒歩",
      steps: [
        { icon: "🚶", label: "徒歩 12分", note: `${fromName} → 東京駅` },
        { icon: "🚆", label: "総武線快速 終電", note: `東京 → ${toName}・43分` },
      ],
      cost: 590, time: 65,
      lastTrain: fmtMin(base + 61),
      depart: { h: Math.floor(d2 / 60) % 24, m: d2 % 60 },
      urgency: "danger", routeColor: C.red,
    },
    {
      id: "mix1", mode: "mix", badge: "電車＋終点タクシー", badgeColor: C.purple,
      name: "電車で行けるとこまで→タクシー",
      steps: [
        { icon: "🚶", label: "徒歩 5分", note: `${fromName} → 竹橋` },
        { icon: "🚆", label: "東西線→総武線", note: "東京まで乗車" },
        { icon: "🚕", label: "タクシー", note: `市川駅 → ${toName} 約¥3,500` },
      ],
      cost: 4080, time: 60,
      lastTrain: fmtMin(base + 53),
      depart: { h: Math.floor(d1 / 60) % 24, m: d1 % 60 },
      urgency: "warning", routeColor: C.purple,
    },
    {
      id: "x1", mode: "taxi", badge: "最速・確実", badgeColor: C.amber,
      name: "タクシー → 東京 → 総武線",
      steps: [
        { icon: "🚕", label: "タクシー 約8分", note: `${fromName}→東京駅 ¥1,200` },
        { icon: "🚆", label: "総武線快速 終電", note: `東京→${toName} 43分 ¥590` },
      ],
      cost: 1790, time: 51,
      lastTrain: fmtMin(base + 95),
      depart: { h: Math.floor((base + 75) / 60) % 24, m: (base + 75) % 60 },
      urgency: "safe", routeColor: C.amber,
    },
    {
      id: "x2", mode: "taxi", badge: "終電後OK", badgeColor: C.blue,
      name: "タクシー直行",
      steps: [{ icon: "🚕", label: "タクシー 約50分", note: `${fromName} → ${toName}` }],
      cost: 9500, time: 50, lastTrain: null,
      depart: { h: Math.floor((base + 5) / 60) % 24, m: (base + 5) % 60 },
      urgency: "safe", routeColor: C.blue,
    },
  ];
}

function MapPreview({ routeColor = C.blue, compact = false }) {
  const h = compact ? 110 : 160;
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", position: "relative", height: h, background: "#080F1E" }}>
      <svg width="100%" height={h} viewBox="0 0 354 160" preserveAspectRatio="xMidYMid slice">
        <rect width="354" height="160" fill="#080F1E" />
        {[30,70,110,150,190,230,270,310].map(x => <line key={x} x1={x} y1="0" x2={x} y2="160" stroke="#0E1E30" strokeWidth="1.5" />)}
        {[25,55,85,115,140,165].map(y => <line key={y} x1="0" y1={y} x2="354" y2={y} stroke="#0E1E30" strokeWidth="1.5" />)}
        <line x1="0" y1="85" x2="354" y2="85" stroke="#122030" strokeWidth="5" />
        <line x1="0" y1="55" x2="354" y2="55" stroke="#122030" strokeWidth="4" />
        <line x1="177" y1="0" x2="177" y2="160" stroke="#122030" strokeWidth="5" />
        <line x1="90" y1="0" x2="90" y2="160" stroke="#122030" strokeWidth="3" />
        <line x1="260" y1="0" x2="260" y2="160" stroke="#122030" strokeWidth="3" />
        {[[35,30,30,18],[75,30,25,18],[115,30,28,18],[200,30,22,18],[235,30,28,18],[280,30,25,18],[35,100,30,20],[75,100,25,20],[200,100,30,20],[240,100,28,20],[285,100,22,20],[35,62,18,16],[120,62,16,16],[200,62,18,16],[235,62,20,16],[280,62,18,16]].map(([x,y,w,h2],i) => (
          <rect key={i} x={x} y={y} width={w} height={h2} rx="2" fill="#0D1E30" opacity="0.8" />
        ))}
        <path d="M0,55 L354,55" stroke="#1A3050" strokeWidth="3" strokeDasharray="8,4" />
        <path d="M0,85 L354,85" stroke="#1A3050" strokeWidth="3" strokeDasharray="8,4" />
        <path d="M75,120 L75,85 L130,85 L130,55 L260,55 L290,55" stroke={routeColor} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d="M75,120 L75,85 L130,85 L130,55 L260,55 L290,55" stroke={routeColor} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
        <circle cx="75" cy="85" r="4" fill={routeColor} opacity="0.8" />
        <circle cx="130" cy="55" r="4" fill={routeColor} opacity="0.8" />
        <circle cx="260" cy="55" r="4" fill={routeColor} opacity="0.8" />
        <circle cx="75" cy="120" r="9" fill={C.accent} opacity="0.25" />
        <circle cx="75" cy="120" r="5" fill={C.accent} />
        <circle cx="75" cy="120" r="2.5" fill="white" />
        <circle cx="290" cy="55" r="7" fill={C.blue} opacity="0.25" />
        <circle cx="290" cy="55" r="4" fill={C.blue} />
        <circle cx="290" cy="55" r="2" fill="white" />
        <text x="82" y="124" fontSize="8" fill={C.accent} fontWeight="bold" opacity="0.9">現在地</text>
        <text x="295" y="52" fontSize="8" fill={C.blue} fontWeight="bold" opacity="0.9">自宅</text>
      </svg>
      <div style={{ position: "absolute", bottom: 10, right: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
        <Navigation size={11} color={C.accent} />
        <span style={{ color: C.white, fontSize: 10, fontWeight: 700 }}>現在地</span>
      </div>
    </div>
  );
}

function StatusBar() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 26px 0", color: C.white, fontSize: 12, fontWeight: 600 }}>
      <span>{t.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
      <span style={{ color: C.sub }}>●●●  WiFi  🔋</span>
    </div>
  );
}

// ─── 設定画面 ─────────────────────────────────────────
function SettingsScreen({ onBack, home, onSaveHome }) {
  const [inputHome, setInputHome] = useState(home);
  return (
    <div style={{ padding: "10px 22px 40px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px", cursor: "pointer", lineHeight: 0, display: "inline-flex" }}>
          <ChevronLeft size={18} color={C.white} />
        </button>
        <div style={{ color: C.white, fontWeight: 800, fontSize: 16 }}>設定</div>
      </div>

      <div style={cs({ marginBottom: 16 })}>
        <Label>🏠 帰る場所（駅名・地名）</Label>
        <input
          value={inputHome}
          onChange={e => setInputHome(e.target.value)}
          placeholder="例: 千葉、吉祥寺、横浜..."
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            background: C.muted, border: `1px solid ${C.border}`,
            color: C.white, fontSize: 15, fontFamily: "inherit",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <div style={{ color: C.sub, fontSize: 11, marginTop: 8 }}>
          ※ 本格版ではGPS＋地図APIで最寄り駅を自動特定します
        </div>
      </div>

      <button
        onClick={() => { onSaveHome(inputHome); onBack(); }}
        style={{ width: "100%", padding: "14px", background: `linear-gradient(135deg, ${C.accent}, #FF8800)`, border: "none", borderRadius: 16, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 20px ${C.accent}40` }}
      >
        保存する
      </button>
    </div>
  );
}

// ─── ホーム画面 ──────────────────────────────────────
function HomeScreen({ onShowRoutes, onShowSettings, location, home }) {
  const [now, setNow] = useState(new Date());
  const [alarmOn, setAlarmOn] = useState(true);
  const [fired, setFired] = useState(false);
  const alarmFiredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentNow = { h: now.getHours(), m: now.getMinutes() };
  const routes = buildRoutes(currentNow, location.name, home);
  const recommended = routes[0];
  const sec = secLeft(recommended.depart);

  useEffect(() => {
    if (alarmOn && sec !== null && sec <= 0 && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      playAlarm();
      setFired(true);
    }
    if (sec !== null && sec > 0) {
      alarmFiredRef.current = false;
      setFired(false);
    }
  }, [sec, alarmOn]);

  const urgColor = sec === null ? C.green : sec <= 60 ? C.red : sec <= 300 ? C.amber : C.green;

  function fmtSec(s) {
    if (s === null) return "いつでもOK";
    if (s <= 0) return "今すぐ出発！";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `あと ${m}分 ${String(r).padStart(2,"0")}秒` : `あと ${r}秒！`;
  }

  if (fired) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "linear-gradient(160deg,#220008,#150003)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, animation: "fadeIn 0.3s ease" }}>
        <div style={{ fontSize: 72, marginBottom: 16, animation: "blink 0.5s infinite" }}>🚨</div>
        <div style={{ color: C.red, fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 8 }}>出発してください！</div>
        <div style={{ color: "#FF9090", fontSize: 15, textAlign: "center", lineHeight: 1.6, marginBottom: 6 }}>{recommended.name}</div>
        <div style={{ color: "#FF6060", fontSize: 13, textAlign: "center", lineHeight: 1.8, marginBottom: 40 }}>
          終電 {recommended.lastTrain} に乗るには<br />今すぐ出発が必要です
        </div>
        <button onClick={() => { setFired(false); setAlarmOn(false); }} style={{ width: "100%", padding: "16px", background: C.red, border: "none", borderRadius: 18, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
          確認しました → 出発！
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 22px 32px", animation: "fadeIn 0.4s ease" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: C.sub, letterSpacing: 2, marginBottom: 4 }}>
            📍 {location.name} → 🏠 {home}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: C.white, margin: 0 }}>Far From Home</h1>
        </div>
        <button onClick={onShowSettings} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px", cursor: "pointer", lineHeight: 0 }}>
          <Settings size={18} color={C.sub} />
        </button>
      </div>

      {/* 位置情報バッジ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.muted, borderRadius: 10, padding: "6px 12px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: location.loading ? C.amber : C.green, animation: location.loading ? "blink 1s infinite" : "none" }} />
          <span style={{ color: C.white, fontSize: 11, fontWeight: 600 }}>
            {location.loading ? "GPS取得中..." : `📡 ${location.accuracy ? `精度±${Math.round(location.accuracy)}m` : "GPS取得済み"}`}
          </span>
        </div>
      </div>

      {/* カウントダウン */}
      <div style={cs({ marginBottom: 12, borderColor: `${urgColor}40`, background: `${urgColor}08`, textAlign: "center" })}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 600 }}>おすすめルートの出発まで</div>
        <div style={{ fontSize: 42, fontWeight: 900, color: urgColor, letterSpacing: -2, lineHeight: 1, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
          {fmtSec(sec)}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.sub, fontSize: 10 }}>出発時刻</div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 20 }}>{fmt(recommended.depart)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.sub, fontSize: 10 }}>終電</div>
            <div style={{ color: C.amber, fontWeight: 800, fontSize: 20 }}>{recommended.lastTrain}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.sub, fontSize: 10 }}>料金</div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 20 }}>¥{recommended.cost}</div>
          </div>
        </div>
      </div>

      {/* おすすめルート */}
      <div style={cs({ marginBottom: 12 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.green, background: `${C.green}22`, padding: "3px 8px", borderRadius: 6 }}>{recommended.badge}</span>
          <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>{recommended.name}</span>
        </div>
        {recommended.steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: i < recommended.steps.length - 1 ? 6 : 0 }}>
            <span style={{ fontSize: 12 }}>{s.icon}</span>
            <span style={{ color: C.white, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: C.sub, fontSize: 11 }}>{s.note}</span>
          </div>
        ))}
      </div>

      {/* 地図 */}
      <div style={{ marginBottom: 12 }}>
        <MapPreview routeColor={recommended.routeColor} compact />
      </div>

      {/* アラームトグル */}
      <div onClick={() => setAlarmOn(v => !v)} style={cs({ cursor: "pointer", borderColor: alarmOn ? `${C.green}40` : C.border, marginBottom: 10 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
              {alarmOn ? "🔔 自動アラームON" : "🔕 自動アラームOFF"}
            </div>
            <div style={{ color: C.sub, fontSize: 11 }}>
              {alarmOn ? `出発時刻 ${fmt(recommended.depart)} に自動通知` : "タップしてONにする"}
            </div>
          </div>
          <Toggle on={alarmOn} />
        </div>
      </div>

      <button onClick={onShowRoutes} style={{ width: "100%", padding: "13px", background: C.muted, border: `1px solid ${C.border}`, borderRadius: 16, color: C.white, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        全ルートを見る →
      </button>
    </div>
  );
}

function RouteCard({ route, onAlarm, onSelect, selected }) {
  const sec = secLeft(route.depart);
  const min = sec !== null ? Math.floor(sec / 60) : null;
  const urgBorder = selected ? route.routeColor : route.urgency === "danger" ? C.red : route.urgency === "warning" ? C.amber : C.border;
  const minColor = min === null ? C.green : min <= 5 ? C.red : min <= 15 ? C.amber : C.green;
  const minText = min === null ? "いつでもOK" : min <= 0 ? "間に合わない！" : `あと${min}分で出発`;

  return (
    <div onClick={onSelect} style={cs({ borderColor: urgBorder, marginBottom: 10, cursor: "pointer", transition: "border-color 0.2s" })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <Pill color={route.badgeColor}>{route.badge}</Pill>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 13, marginTop: 5 }}>{route.name}</div>
        </div>
        <div style={{ background: `${minColor}18`, borderRadius: 8, padding: "3px 7px", flexShrink: 0 }}>
          <span style={{ color: minColor, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>{minText}</span>
        </div>
      </div>
      {selected && (
        <div style={{ marginBottom: 10, animation: "fadeIn 0.3s ease" }}>
          <MapPreview routeColor={route.routeColor} compact />
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        {route.steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: i < route.steps.length - 1 ? 5 : 0 }}>
            <span style={{ fontSize: 12 }}>{s.icon}</span>
            <span style={{ color: C.white, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: C.sub, fontSize: 11 }}>{s.note}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div><div style={{ color: C.sub, fontSize: 9, marginBottom: 1 }}>合計料金</div><div style={{ color: C.white, fontWeight: 900, fontSize: 18 }}>¥{route.cost.toLocaleString()}</div></div>
          <div><div style={{ color: C.sub, fontSize: 9, marginBottom: 1 }}>所要時間</div><div style={{ color: C.white, fontWeight: 900, fontSize: 18 }}>{route.time}<span style={{ fontSize: 10 }}>分</span></div></div>
          {route.lastTrain && <div><div style={{ color: C.sub, fontSize: 9, marginBottom: 1 }}>終電</div><div style={{ color: C.amber, fontWeight: 700, fontSize: 13 }}>{route.lastTrain}</div></div>}
        </div>
        <button onClick={e => { e.stopPropagation(); onAlarm(route); }} style={{ background: C.muted, border: `1px solid ${C.accent}35`, borderRadius: 10, padding: "7px 11px", color: C.accent, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Bell size={12} />アラーム
        </button>
      </div>
    </div>
  );
}

function RoutesScreen({ onBack, onAlarm, location, home }) {
  const [selected, setSelected] = useState("t1");
  const now = new Date();
  const currentNow = { h: now.getHours(), m: now.getMinutes() };
  const routes = buildRoutes(currentNow, location.name, home);
  const trainRoutes = routes.filter(r => r.mode === "train");
  const mixRoutes   = routes.filter(r => r.mode === "mix");
  const taxiRoutes  = routes.filter(r => r.mode === "taxi");

  return (
    <div style={{ padding: "10px 18px 40px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px", cursor: "pointer", lineHeight: 0, display: "inline-flex" }}>
          <ChevronLeft size={18} color={C.white} />
        </button>
        <div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 15 }}>{location.name} → {home}</div>
          <div style={{ color: C.sub, fontSize: 11 }}>{now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })} 現在</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>🚆 電車のみ</div>
      {trainRoutes.map(r => <RouteCard key={r.id} route={r} onAlarm={onAlarm} selected={selected === r.id} onSelect={() => setSelected(r.id)} />)}

      <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 0.5, marginTop: 6, marginBottom: 8 }}>🚆＋🚕 電車で行けるとこまで → タクシー</div>
      {mixRoutes.map(r => <RouteCard key={r.id} route={r} onAlarm={onAlarm} selected={selected === r.id} onSelect={() => setSelected(r.id)} />)}

      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, letterSpacing: 0.5, marginTop: 6, marginBottom: 8 }}>🚕 タクシー＋電車 / タクシー直行</div>
      {taxiRoutes.map(r => <RouteCard key={r.id} route={r} onAlarm={onAlarm} selected={selected === r.id} onSelect={() => setSelected(r.id)} />)}
    </div>
  );
}

function AlarmScreen({ route, onBack }) {
  const [on, setOn] = useState(true);
  const [fired, setFired] = useState(false);
  const alarmFiredRef = useRef(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const sec = secLeft(route.depart);

  useEffect(() => {
    if (on && sec !== null && sec <= 0 && !alarmFiredRef.current) {
      alarmFiredRef.current = true; playAlarm(); setFired(true);
    }
    if (sec !== null && sec > 0) { alarmFiredRef.current = false; setFired(false); }
  }, [sec, on]);

  const urgColor = sec === null ? C.green : sec <= 60 ? C.red : sec <= 300 ? C.amber : C.green;

  function fmtSec(s) {
    if (s === null) return "いつでもOK";
    if (s <= 0) return "今すぐ出発！";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}分 ${String(r).padStart(2,"0")}秒` : `${r}秒`;
  }

  if (fired) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "linear-gradient(160deg,#220008,#150003)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ fontSize: 72, marginBottom: 16, animation: "blink 0.6s infinite" }}>🚨</div>
        <div style={{ color: C.red, fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 8 }}>出発してください！</div>
        <div style={{ color: "#FF9090", fontSize: 14, textAlign: "center", lineHeight: 1.6, marginBottom: 40 }}>{route.name}</div>
        <button onClick={() => { setFired(false); setOn(false); }} style={{ width: "100%", padding: "16px", background: C.red, border: "none", borderRadius: 18, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
          確認しました → 出発！
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 22px 40px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px", cursor: "pointer", lineHeight: 0, display: "inline-flex" }}>
          <ChevronLeft size={18} color={C.white} />
        </button>
        <div style={{ color: C.white, fontWeight: 800, fontSize: 16 }}>アラーム設定</div>
      </div>

      <div style={cs({ marginBottom: 12, textAlign: "center", borderColor: `${urgColor}40`, background: `${urgColor}08` })}>
        <div style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>出発まで</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: urgColor, letterSpacing: -2, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtSec(sec)}</div>
        <div style={{ color: C.sub, fontSize: 12, marginTop: 6 }}>出発時刻: <span style={{ color: C.white, fontWeight: 700 }}>{fmt(route.depart)}</span></div>
      </div>

      <div style={{ marginBottom: 12 }}><MapPreview routeColor={route.routeColor || C.blue} compact /></div>

      <div style={cs({ marginBottom: 10 })}>
        <Label>選択ルート</Label>
        <div style={{ color: C.white, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{route.name}</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div><div style={{ color: C.sub, fontSize: 10 }}>料金</div><div style={{ color: C.white, fontWeight: 700, fontSize: 16 }}>¥{route.cost.toLocaleString()}</div></div>
          <div><div style={{ color: C.sub, fontSize: 10 }}>時間</div><div style={{ color: C.white, fontWeight: 700, fontSize: 16 }}>{route.time}分</div></div>
          {route.lastTrain && <div><div style={{ color: C.sub, fontSize: 10 }}>終電</div><div style={{ color: C.amber, fontWeight: 700, fontSize: 16 }}>{route.lastTrain}</div></div>}
        </div>
      </div>

      <div onClick={() => setOn(v => !v)} style={cs({ cursor: "pointer", borderColor: on ? `${C.green}40` : C.border })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{on ? "🔔 アラームON" : "🔕 アラームOFF"}</div>
            <div style={{ color: C.sub, fontSize: 12 }}>{on ? `${fmt(route.depart)} に自動発火` : "タップしてONにする"}</div>
          </div>
          <Toggle on={on} />
        </div>
      </div>
    </div>
  );
}

// ─── GPS取得フック ────────────────────────────────────
function useLocation() {
  const [location, setLocation] = useState({ name: "取得中...", loading: true, accuracy: null });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ name: "現在地", loading: false, accuracy: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 本格版ではここでGeocodingAPIを呼んで住所→駅名に変換
        // MVPでは座標をそのまま表示（デモ地名固定）
        setLocation({
          name: "神保町付近",  // ← 本番はAPIで自動取得
          loading: false,
          accuracy: pos.coords.accuracy,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setLocation({ name: "現在地", loading: false, accuracy: null });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return location;
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [route, setRoute] = useState(null);
  const [home, setHome] = useState(() => localStorage.getItem("home") || "千葉");
  const location = useLocation();

  const saveHome = (val) => {
    const v = val.trim() || "千葉";
    setHome(v);
    localStorage.setItem("home", v);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input { font-family: inherit; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#030608", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 0 48px", fontFamily: "'Hiragino Sans','Yu Gothic UI','Meiryo','Noto Sans JP',sans-serif" }}>
        <div style={{ width: 390, background: C.bg, borderRadius: 48, border: "1px solid rgba(255,255,255,0.09)", overflow: "hidden", position: "relative", boxShadow: "0 40px 80px rgba(0,0,0,0.85)" }}>
          <StatusBar />
          {screen === "home"     && <HomeScreen onShowRoutes={() => setScreen("routes")} onShowSettings={() => setScreen("settings")} location={location} home={home} />}
          {screen === "routes"   && <RoutesScreen onBack={() => setScreen("home")} onAlarm={r => { setRoute(r); setScreen("alarm"); }} location={location} home={home} />}
          {screen === "alarm"    && route && <AlarmScreen route={route} onBack={() => setScreen("routes")} />}
          {screen === "settings" && <SettingsScreen onBack={() => setScreen("home")} home={home} onSaveHome={saveHome} />}
        </div>
      </div>
    </>
  );
}
