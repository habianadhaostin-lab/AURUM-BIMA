import React, { useState, useMemo, useRef } from "react";
import {
  Upload,
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ImageIcon,
  FileText,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  void: "#0A0C0F",
  panel: "#12151A",
  raised: "#181C22",
  hair: "#242931",
  hairSoft: "#1B1F26",
  gold: "#C79A4B",
  goldDim: "#7A6435",
  goldWash: "rgba(199,154,75,0.08)",
  bull: "#3E9B72",
  bullWash: "rgba(62,155,114,0.14)",
  bear: "#BD5445",
  bearWash: "rgba(189,84,69,0.14)",
  text: "#EDEAE2",
  muted: "#8D919B",
  faint: "#565B66",
};

const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_UI = "'Inter', -apple-system, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', monospace";

// ---------------------------------------------------------------------------
// Mock OHLC data — an uptrend into a liquidity sweep, then reversal down.
// This stands in for real candle data until the OHLC feed is wired up.
// ---------------------------------------------------------------------------
const MOCK_CANDLES = [
  [3401.2, 3406.8, 3398.5, 3404.1], [3404.1, 3409.3, 3402.0, 3407.9],
  [3407.9, 3412.5, 3405.6, 3410.8], [3410.8, 3413.2, 3406.1, 3408.4],
  [3408.4, 3411.9, 3403.7, 3406.2], [3406.2, 3410.4, 3402.8, 3409.5],
  [3409.5, 3416.7, 3408.0, 3415.1], [3415.1, 3420.3, 3412.6, 3418.9],
  [3418.9, 3423.5, 3416.2, 3421.8], [3421.8, 3425.0, 3417.4, 3419.6],
  [3419.6, 3422.8, 3414.9, 3417.2], [3417.2, 3421.6, 3413.5, 3420.3],
  [3420.3, 3427.9, 3419.1, 3426.4], [3426.4, 3432.8, 3424.7, 3430.9],
  [3430.9, 3436.2, 3428.3, 3434.5], [3434.5, 3439.7, 3431.9, 3437.8],
  [3437.8, 3444.3, 3436.0, 3442.6], [3442.6, 3448.9, 3440.1, 3446.2],
  [3446.2, 3451.5, 3443.8, 3449.7], [3449.7, 3453.2, 3445.6, 3447.9],
  [3447.9, 3452.8, 3446.3, 3451.9], [3451.9, 3458.4, 3450.2, 3456.7],
  [3456.7, 3462.1, 3454.9, 3460.3], [3460.3, 3465.8, 3458.6, 3463.9],
  [3463.9, 3468.2, 3461.5, 3465.1], [3465.1, 3467.9, 3459.8, 3461.4],
  [3461.4, 3463.6, 3450.2, 3452.8], [3452.8, 3454.9, 3438.7, 3441.3],
  [3441.3, 3443.8, 3428.5, 3431.2], [3431.2, 3434.6, 3421.9, 3424.8],
  [3424.8, 3427.3, 3414.6, 3417.9], [3417.9, 3420.1, 3408.3, 3411.7],
  [3411.7, 3414.9, 3403.5, 3406.1], [3406.1, 3409.2, 3398.8, 3401.4],
  [3401.4, 3404.6, 3393.2, 3396.7], [3396.7, 3399.8, 3389.5, 3392.9],
];

const MOCK_SUPPLY_ZONE = { from: 22, to: 27, top: 3468.2, bottom: 3459.8 };
const MOCK_DEMAND_ZONE = { from: 30, to: 35, top: 3417.9, bottom: 3389.5 };

const MOCK_SIGNAL = {
  direction: "sell",
  entry: 3452.8,
  sl: 3460.2,
  tp1: 3438.0,
  tp2: 3418.0,
  tp3: 3396.5,
};

const MOCK_FVG = { top: 3443.8, bottom: 3441.3 };

// Harga acuan dari data mock (close candle terakhir) — dipakai sebagai basis
// rasio supaya overlay ilustrasi bisa diskalakan ke harga berapa pun.
const MOCK_ANCHOR = MOCK_CANDLES[MOCK_CANDLES.length - 1][3];
const RATIO = {
  entry: MOCK_SIGNAL.entry / MOCK_ANCHOR,
  sl: MOCK_SIGNAL.sl / MOCK_ANCHOR,
  tp1: MOCK_SIGNAL.tp1 / MOCK_ANCHOR,
  tp2: MOCK_SIGNAL.tp2 / MOCK_ANCHOR,
  tp3: MOCK_SIGNAL.tp3 / MOCK_ANCHOR,
  supplyTop: MOCK_SUPPLY_ZONE.top / MOCK_ANCHOR,
  supplyBottom: MOCK_SUPPLY_ZONE.bottom / MOCK_ANCHOR,
  demandTop: MOCK_DEMAND_ZONE.top / MOCK_ANCHOR,
  demandBottom: MOCK_DEMAND_ZONE.bottom / MOCK_ANCHOR,
  fvgTop: MOCK_FVG.top / MOCK_ANCHOR,
  fvgBottom: MOCK_FVG.bottom / MOCK_ANCHOR,
};

// PENTING: ini BUKAN algoritma deteksi order block sungguhan — cuma
// menskalakan pola contoh (rasio dari MOCK_SIGNAL/MOCK_*_ZONE) ke harga
// terakhir yang sedang tampil, supaya angkanya konsisten dengan chart
// (live atau mock) selagi algoritma deteksi real belum dipasang.
function buildIllustrativeOverlay(candles) {
  const lastClose = candles[candles.length - 1][3];
  const n = candles.length;
  const clampIdx = (i) => Math.max(0, Math.min(n - 1, i));

  const zones = {
    supply: {
      from: clampIdx(n - 14),
      to: clampIdx(n - 9),
      top: lastClose * RATIO.supplyTop,
      bottom: lastClose * RATIO.supplyBottom,
    },
    demand: {
      from: clampIdx(n - 6),
      to: clampIdx(n - 1),
      top: lastClose * RATIO.demandTop,
      bottom: lastClose * RATIO.demandBottom,
    },
    fvg: {
      top: lastClose * RATIO.fvgTop,
      bottom: lastClose * RATIO.fvgBottom,
    },
  };

  const signal = {
    direction: MOCK_SIGNAL.direction,
    entry: lastClose * RATIO.entry,
    sl: lastClose * RATIO.sl,
    tp1: lastClose * RATIO.tp1,
    tp2: lastClose * RATIO.tp2,
    tp3: lastClose * RATIO.tp3,
  };

  return { zones, signal };
}

// Peta timeframe UI -> parameter interval yang dipahami /api/ohlc
const TF_TO_INTERVAL = { M5: "M5", M15: "M15", H1: "H1", H4: "H4" };
const POLL_MS = 60_000; // Twelve Data free tier: cukup poll tiap 60 detik

const TIMEFRAMES = ["M5", "M15", "H1", "H4"];

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------
function CandleChart({ candles, zones, signal, showZones }) {
  const width = 860;
  const height = 380;
  const padL = 12;
  const padR = 58;
  const padT = 16;
  const padB = 24;

  const signalPrices = signal ? [signal.entry, signal.sl, signal.tp1, signal.tp2, signal.tp3] : [];
  const allPrices = [...candles.flat(), ...signalPrices];
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const slot = innerW / candles.length;
  const bodyW = Math.max(2, slot * 0.55);

  const xAt = (i) => padL + slot * i + slot / 2;
  const yAt = (p) => padT + innerH - ((p - min) / range) * innerH;

  const gridLines = 5;
  const gridPrices = Array.from({ length: gridLines }, (_, i) => min + (range / (gridLines - 1)) * i);

  const zoneRect = (z, color, wash, label) => (
    <g>
      <rect
        x={xAt(z.from) - slot / 2}
        y={yAt(z.top)}
        width={slot * (z.to - z.from + 1)}
        height={yAt(z.bottom) - yAt(z.top)}
        fill={wash}
        stroke={color}
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <text
        x={xAt(z.from) - slot / 2 + 6}
        y={yAt(z.top) + 14}
        fill={color}
        fontFamily={FONT_MONO}
        fontSize="9.5"
        letterSpacing="0.02em"
      >
        {label}
      </text>
    </g>
  );

  const priceLine = (price, color, label, dash = "5 3") => {
    const y = yAt(price);
    const labelW = label.length * 5.6 + 12;
    return (
      <g>
        <line x1={padL} x2={width - padR} y1={y} y2={y} stroke={color} strokeWidth="1.1" strokeDasharray={dash} opacity="0.9" />
        <rect x={padL + 4} y={y - 9} width={labelW} height={15} rx="3" fill={C.void} stroke={color} strokeWidth="1" />
        <text x={padL + 4 + labelW / 2} y={y + 2.5} fill={color} fontFamily={FONT_MONO} fontSize="9.5" textAnchor="middle">
          {label}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {gridPrices.map((p, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={width - padR}
            y1={yAt(p)}
            y2={yAt(p)}
            stroke={C.hairSoft}
            strokeWidth="1"
          />
          <text
            x={width - padR + 8}
            y={yAt(p) + 3}
            fill={C.faint}
            fontFamily={FONT_MONO}
            fontSize="10"
          >
            {p.toFixed(1)}
          </text>
        </g>
      ))}

      {showZones && zones?.supply && zoneRect(zones.supply, C.bear, C.bearWash, "SUPPLY / OB BEARISH")}
      {showZones && zones?.demand && zoneRect(zones.demand, C.bull, C.bullWash, "DEMAND / OB BULLISH")}

      {signal && priceLine(signal.entry, C.gold, `ENTRY ${signal.entry.toFixed(2)}`, "1 0")}
      {signal && priceLine(signal.sl, C.bear, `SL ${signal.sl.toFixed(2)}`)}
      {signal && priceLine(signal.tp1, C.bull, `TP1 ${signal.tp1.toFixed(2)}`)}
      {signal && priceLine(signal.tp2, C.bull, `TP2 ${signal.tp2.toFixed(2)}`)}
      {signal && priceLine(signal.tp3, C.bull, `TP3 ${signal.tp3.toFixed(2)}`)}

      {candles.map(([o, h, l, c], i) => {
        const up = c >= o;
        const color = up ? C.bull : C.bear;
        const x = xAt(i);
        const bodyTop = yAt(Math.max(o, c));
        const bodyBottom = yAt(Math.min(o, c));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yAt(h)} y2={yAt(l)} stroke={color} strokeWidth="1" />
            <rect
              x={x - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={Math.max(1.2, bodyBottom - bodyTop)}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_UI,
        fontSize: 12.5,
        color: C.muted,
        marginBottom: 10,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        background: C.void,
        border: `1px solid ${C.hair}`,
        borderRadius: 8,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 6,
              border: "none",
              background: active ? C.raised : "transparent",
              color: active ? C.text : C.muted,
              fontFamily: FONT_UI,
              fontSize: 12.5,
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BiasCard({ zones, signal }) {
  return (
    <div style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 18 }}>
      <SectionLabel>Bias pasar</SectionLabel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <TrendingDown size={20} color={C.bear} strokeWidth={2.2} />
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.bear, fontWeight: 600 }}>
          Bearish
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.muted }}>72% keyakinan</span>
      </div>
      <p style={{ fontFamily: FONT_UI, fontSize: 13.5, color: C.muted, lineHeight: 1.6, margin: 0 }}>
        Harga menyapu likuiditas di atas {zones.supply.top.toFixed(1)} lalu meninggalkan order
        block bearish yang belum diuji. Struktur masih menurun selama harga tertahan di bawah{" "}
        {signal.entry.toFixed(1)}.
      </p>
    </div>
  );
}

function SignalCard({ signal, tf }) {
  const isSell = signal.direction === "sell";
  return (
    <div
      style={{
        border: `1px solid ${C.goldDim}`,
        borderRadius: 10,
        padding: 18,
        background: C.goldWash,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: C.gold, fontWeight: 500 }}>
          Sinyal trading
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: C.void,
            background: isSell ? C.bear : C.bull,
            padding: "3px 9px",
            borderRadius: 4,
            letterSpacing: "0.03em",
          }}
        >
          {isSell ? "SELL" : "BUY"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {[
          ["Entry", signal.entry],
          ["Stop loss", signal.sl],
          ["Take profit 1", signal.tp1],
          ["Take profit 2", signal.tp2],
          ["Take profit 3", signal.tp3],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, color: C.muted, marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: C.text }}>{value.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${C.goldDim}`,
          display: "flex",
          gap: 18,
          fontFamily: FONT_UI,
          fontSize: 12,
          color: C.muted,
        }}
      >
        <span>
          Risk:Reward <b style={{ color: C.text, fontFamily: FONT_MONO }}>1 : 4.7</b>
        </span>
        <span>
          Timeframe <b style={{ color: C.text, fontFamily: FONT_MONO }}>{tf}</b>
        </span>
      </div>
    </div>
  );
}

function ZonesList({ zones, tf }) {
  const fmt = (v) => v.toFixed(2);
  const rows = [
    {
      type: "Order block bearish",
      range: `${fmt(zones.supply.bottom)} – ${fmt(zones.supply.top)}`,
      tf,
      status: "Belum diuji",
      dir: "down",
    },
    {
      type: "Order block bullish",
      range: `${fmt(zones.demand.bottom)} – ${fmt(zones.demand.top)}`,
      tf,
      status: "Belum diuji",
      dir: "up",
    },
    {
      type: "Fair value gap",
      range: `${fmt(zones.fvg.bottom)} – ${fmt(zones.fvg.top)}`,
      tf,
      status: "Terisi sebagian",
      dir: "down",
    },
  ];
  return (
    <div style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 18 }}>
      <SectionLabel>Zona terdeteksi</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {rows.map((z, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.hairSoft}` : "none",
            }}
          >
            {z.dir === "up" ? (
              <TrendingUp size={15} color={C.bull} />
            ) : (
              <TrendingDown size={15} color={C.bear} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_UI, fontSize: 13, color: C.text }}>{z.type}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                {z.range}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: FONT_UI, fontSize: 11, color: C.faint }}>{z.tf}</div>
              <div style={{ fontFamily: FONT_UI, fontSize: 11, color: C.muted, marginTop: 2 }}>
                {z.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------
export default function BimaMarketAnalyzer() {
  const [source, setSource] = useState("both");
  const [timeframe, setTimeframe] = useState("H1");
  const [ohlcText, setOhlcText] = useState("");
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | running | done
  const fileRef = useRef(null);

  // --- Feed OHLC live (Twelve Data lewat /api/ohlc) ---------------------
  const [feedState, setFeedState] = useState("loading"); // loading | live | error
  const [feedError, setFeedError] = useState("");
  const [liveCandles, setLiveCandles] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  React.useEffect(() => {
    let cancelled = false;
    let intervalId;

    async function fetchOhlc() {
      setFeedState((prev) => (prev === "live" ? "live" : "loading"));
      try {
        const res = await fetch(`/api/ohlc?timeframe=${TF_TO_INTERVAL[timeframe]}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) throw new Error(json.error || "Gagal memuat feed");
        if (!Array.isArray(json.candles) || json.candles.length === 0) {
          throw new Error("Feed mengembalikan data kosong");
        }
        setLiveCandles(json.candles);
        setFeedState("live");
        setFeedError("");
        setLastUpdated(new Date());
      } catch (err) {
        if (cancelled) return;
        // Gagal (mis. belum di-deploy dengan API key) -> tetap tampilkan mock
        // supaya UI tidak kosong, tapi status feed ditandai error.
        setFeedState("error");
        setFeedError(err.message);
      }
    }

    fetchOhlc();
    intervalId = setInterval(fetchOhlc, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [timeframe]);

  const activeCandles = feedState === "live" && liveCandles ? liveCandles : MOCK_CANDLES;
  const overlay = React.useMemo(() => buildIllustrativeOverlay(activeCandles), [activeCandles]);
  const activeZones = overlay.zones;
  const activeSignal = overlay.signal;

  const steps = ["Membaca data OHLC", "Membaca screenshot chart", "Mendeteksi order block", "Menyusun kesimpulan"];
  const [stepIndex, setStepIndex] = useState(0);

  const runAnalysis = () => {
    setStatus("running");
    setStepIndex(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setStepIndex(i);
      if (i >= steps.length) {
        clearInterval(id);
        setStatus("done");
      }
    }, 550);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  const showZonesOnChart = status === "done";

  return (
    <div
      style={{
        minHeight: "100%",
        background: C.void,
        color: C.text,
        fontFamily: FONT_UI,
        padding: "28px 24px 48px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: ${C.faint}; }
        textarea, input[type="text"] { outline: none; }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          maxWidth: 1180,
          margin: "0 auto 26px",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 600, letterSpacing: "0.01em" }}>
            BIMA_MARKET
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.muted }}>XAUUSD · analisis chart</span>
        </div>
        <SegmentedControl
          options={TIMEFRAMES.map((t) => ({ label: t, value: t }))}
          value={timeframe}
          onChange={setTimeframe}
        />
      </div>

      {/* Body grid */}
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 20,
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            background: C.panel,
            border: `1px solid ${C.hair}`,
            borderRadius: 12,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            alignSelf: "start",
          }}
        >
          <div>
            <SectionLabel>Sumber data</SectionLabel>
            <SegmentedControl
              options={[
                { label: "OHLC", value: "ohlc" },
                { label: "Screenshot", value: "screenshot" },
                { label: "Kombinasi", value: "both" },
              ]}
              value={source}
              onChange={setSource}
            />
          </div>

          {(source === "ohlc" || source === "both") && (
            <div>
              <SectionLabel>Data candle (OHLC)</SectionLabel>
              <textarea
                value={ohlcText}
                onChange={(e) => setOhlcText(e.target.value)}
                placeholder="Tempel data OHLC (CSV / JSON) atau hubungkan feed TradingView..."
                rows={5}
                style={{
                  width: "100%",
                  resize: "none",
                  background: C.void,
                  border: `1px solid ${C.hair}`,
                  borderRadius: 8,
                  padding: 10,
                  color: C.text,
                  fontFamily: FONT_MONO,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                }}
              />
            </div>
          )}

          {(source === "screenshot" || source === "both") && (
            <div>
              <SectionLabel>Screenshot chart</SectionLabel>
              {image ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={image}
                    alt="chart"
                    style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.hair}`, display: "block" }}
                  />
                  <button
                    onClick={() => setImage(null)}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: C.void,
                      border: `1px solid ${C.hair}`,
                      borderRadius: 6,
                      padding: 4,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <X size={12} color={C.muted} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%",
                    border: `1px dashed ${C.hair}`,
                    borderRadius: 8,
                    background: "transparent",
                    color: C.muted,
                    padding: "20px 10px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontFamily: FONT_UI,
                    fontSize: 12,
                  }}
                >
                  <Upload size={16} />
                  Unggah screenshot chart
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={status === "running"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: status === "running" ? C.raised : C.gold,
              color: status === "running" ? C.muted : C.void,
              border: "none",
              borderRadius: 8,
              padding: "11px 0",
              fontFamily: FONT_UI,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: status === "running" ? "default" : "pointer",
            }}
          >
            {status === "running" ? (
              <Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Play size={14} />
            )}
            {status === "running" ? "Menganalisis..." : "Jalankan analisis"}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {status === "running" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: -8 }}>
              {steps.map((s, i) => (
                <div
                  key={s}
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 11.5,
                    color: i < stepIndex ? C.text : C.faint,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: i < stepIndex ? C.gold : C.hair,
                      flexShrink: 0,
                    }}
                  />
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: C.panel,
              border: `1px solid ${C.hair}`,
              borderRadius: 12,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <SectionLabel>Chart · XAUUSD {timeframe}</SectionLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {feedState === "live" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 11, color: C.bull }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: C.bull, display: "inline-block" }} />
                    Live · Twelve Data{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString("id-ID")}` : ""}
                  </span>
                )}
                {feedState === "loading" && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>Menyambungkan feed...</span>
                )}
                {feedState === "error" && (
                  <span
                    title={feedError}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 11, color: C.bear }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: C.bear, display: "inline-block" }} />
                    Feed gagal · pakai data contoh
                  </span>
                )}
                {showZonesOnChart && activeZones && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.gold }}>2 zona ditandai</span>
                )}
              </div>
            </div>
            <CandleChart candles={activeCandles} zones={activeZones} signal={showZonesOnChart ? activeSignal : null} showZones={showZonesOnChart} />
            {showZonesOnChart && (
              <p style={{ fontFamily: FONT_UI, fontSize: 11.5, color: C.faint, marginTop: 10, marginBottom: 0 }}>
                Zona & sinyal di atas masih pola ilustrasi yang diskalakan ke harga saat ini — bukan
                hasil deteksi order block sungguhan. Algoritma real menyusul di tahap berikutnya.
              </p>
            )}
          </div>

          {status === "done" && (
            <div
              style={{
                background: C.panel,
                border: `1px solid ${C.hair}`,
                borderRadius: 12,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <BiasCard zones={activeZones} signal={activeSignal} />
              <SignalCard signal={activeSignal} tf={timeframe} />
              <ZonesList zones={activeZones} tf={timeframe} />
            </div>
          )}

          {status === "idle" && (
            <div
              style={{
                border: `1px dashed ${C.hair}`,
                borderRadius: 12,
                padding: "32px 20px",
                textAlign: "center",
                color: C.faint,
                fontFamily: FONT_UI,
                fontSize: 12.5,
              }}
            >
              Hasil bias, sinyal, dan zona akan muncul di sini setelah analisis dijalankan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
