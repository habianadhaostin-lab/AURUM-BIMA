// ---------------------------------------------------------------------------
// Algoritma deteksi struktur pasar sederhana (swing → BOS → order block → FVG)
// Murni dari data OHLC, tanpa AI/ML — jadi hasilnya deterministik dan bisa
// dijelaskan langkah per langkah. Bukan saran finansial.
// ---------------------------------------------------------------------------

// candles: array of [open, high, low, close], urut kronologis (lama -> baru)

// --- 1. Swing high/low (fractal) -------------------------------------------
// Titik i dianggap swing high kalau high-nya lebih tinggi dari `left` candle
// sebelum dan `right` candle sesudahnya (begitu juga swing low).
export function detectSwings(candles, left = 2, right = 2) {
  const highs = [];
  const lows = [];
  for (let i = left; i < candles.length - right; i++) {
    const h = candles[i][1];
    const l = candles[i][2];
    let isHigh = true;
    let isLow = true;
    for (let k = i - left; k <= i + right; k++) {
      if (k === i) continue;
      if (candles[k][1] > h) isHigh = false;
      if (candles[k][2] < l) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: h });
    if (isLow) lows.push({ index: i, price: l });
  }
  return { highs, lows };
}

// --- 2. Break of structure + order block ------------------------------------
// Jalan maju candle per candle. Begitu close menembus swing high/low terakhir
// yang belum "dipakai", itu dianggap break of structure (BOS). Order block-nya
// adalah candle berlawanan warna terakhir sebelum pergerakan impulsif itu.
function findLastOppositeCandle(candles, fromIdx, toIdx, wantDown) {
  for (let i = toIdx - 1; i >= fromIdx; i--) {
    const [o, , , c] = candles[i];
    if (wantDown && c < o) return i; // candle merah (bearish) -> OB bullish
    if (!wantDown && c > o) return i; // candle hijau (bullish) -> OB bearish
  }
  return -1;
}

export function detectOrderBlocks(candles) {
  const { highs, lows } = detectSwings(candles, 2, 2);
  let hi = 0;
  let lo = 0;
  let curHigh = null;
  let curLow = null;
  const events = [];

  for (let i = 0; i < candles.length; i++) {
    while (hi < highs.length && highs[hi].index <= i) {
      curHigh = highs[hi];
      hi++;
    }
    while (lo < lows.length && lows[lo].index <= i) {
      curLow = lows[lo];
      lo++;
    }

    const close = candles[i][3];

    if (curHigh && i > curHigh.index && close > curHigh.price) {
      const obIdx = findLastOppositeCandle(candles, curHigh.index, i, true);
      if (obIdx !== -1) {
        events.push({
          type: "bullish",
          bosIndex: i,
          obIndex: obIdx,
          top: candles[obIdx][1],
          bottom: Math.min(candles[obIdx][0], candles[obIdx][3]),
        });
      }
      curHigh = null;
    }

    if (curLow && i > curLow.index && close < curLow.price) {
      const obIdx = findLastOppositeCandle(candles, curLow.index, i, false);
      if (obIdx !== -1) {
        events.push({
          type: "bearish",
          bosIndex: i,
          obIndex: obIdx,
          top: Math.max(candles[obIdx][0], candles[obIdx][3]),
          bottom: candles[obIdx][2],
        });
      }
      curLow = null;
    }
  }

  return events;
}

// --- 3. Fair value gap -------------------------------------------------------
// Gap 3-candle: candle ke-3 tidak overlap sama sekali dengan candle ke-1.
export function findFairValueGaps(candles) {
  const fvgs = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    if (c3[2] > c1[1]) fvgs.push({ type: "bullish", index: i, top: c3[2], bottom: c1[1] });
    if (c3[1] < c1[2]) fvgs.push({ type: "bearish", index: i, top: c1[2], bottom: c3[1] });
  }
  return fvgs;
}

// --- 4. Status mitigasi (apakah zona sudah disentuh ulang) -------------------
function overlaps(candle, top, bottom) {
  return candle[1] >= bottom && candle[2] <= top;
}

function isObMitigated(candles, ob) {
  for (let i = ob.obIndex + 2; i < candles.length; i++) {
    if (overlaps(candles[i], ob.top, ob.bottom)) return true;
  }
  return false;
}

function isFvgMitigated(candles, fvg) {
  for (let i = fvg.index + 1; i < candles.length; i++) {
    if (overlaps(candles[i], fvg.top, fvg.bottom)) return true;
  }
  return false;
}

// --- 5. Fallback kalau belum ada BOS/OB yang kebentuk (data terlalu pendek/flat)
function fallbackZone(candles) {
  const n = candles.length;
  const win = candles.slice(Math.max(0, n - 12));
  const top = Math.max(...win.map((c) => c[1]));
  const bottom = Math.min(...win.map((c) => c[2]));
  return { from: Math.max(0, n - 12), to: n - 1, top, bottom, mitigated: false };
}

// --- 6. Sinyal dari order block ----------------------------------------------
// Entry di tepi zona (sisi yang berhadapan dengan harga saat ini), SL di
// seberang zona + buffer kecil, TP1/TP2/TP3 dihitung sebagai kelipatan risiko
// (1.5R / 2.5R / 4R dari jarak entry-SL) — bukan target likuiditas spesifik.
function buildSignalFromZone(direction, top, bottom) {
  const zoneHeight = Math.max(top - bottom, 0.01);
  const buffer = Math.max(zoneHeight * 0.15, top * 0.0004);

  if (direction === "bullish") {
    const entry = top;
    const sl = bottom - buffer;
    const risk = entry - sl;
    return {
      direction: "buy",
      entry,
      sl,
      tp1: entry + risk * 1.5,
      tp2: entry + risk * 2.5,
      tp3: entry + risk * 4,
    };
  }
  const entry = bottom;
  const sl = top + buffer;
  const risk = sl - entry;
  return {
    direction: "sell",
    entry,
    sl,
    tp1: entry - risk * 1.5,
    tp2: entry - risk * 2.5,
    tp3: entry - risk * 4,
  };
}

// --- 7. Rangkai semuanya ------------------------------------------------------
export function analyzeMarket(candles) {
  const n = candles.length;
  const obs = detectOrderBlocks(candles).map((ob) => ({ ...ob, mitigated: isObMitigated(candles, ob) }));
  const fvgs = findFairValueGaps(candles);

  const lastBullish = [...obs].reverse().find((o) => o.type === "bullish");
  const lastBearish = [...obs].reverse().find((o) => o.type === "bearish");
  const lastOB = obs[obs.length - 1] || null;

  const demand = lastBullish
    ? { from: lastBullish.obIndex, to: n - 1, top: lastBullish.top, bottom: lastBullish.bottom, mitigated: lastBullish.mitigated }
    : fallbackZone(candles);
  const supply = lastBearish
    ? { from: lastBearish.obIndex, to: n - 1, top: lastBearish.top, bottom: lastBearish.bottom, mitigated: lastBearish.mitigated }
    : fallbackZone(candles);

  const lastFvg = fvgs[fvgs.length - 1] || null;
  const fvg = lastFvg
    ? { type: lastFvg.type, top: lastFvg.top, bottom: lastFvg.bottom, mitigated: isFvgMitigated(candles, lastFvg) }
    : { type: "bullish", top: candles[n - 1][1], bottom: candles[n - 1][2], mitigated: false };

  let direction = lastOB ? lastOB.type : candles[n - 1][3] >= candles[0][3] ? "bullish" : "bearish";
  const activeZone = direction === "bullish" ? demand : supply;

  const signal = buildSignalFromZone(direction, activeZone.top, activeZone.bottom);
  const confidence = activeZone.mitigated ? 54 : 76;

  return {
    direction,
    confidence,
    supply,
    demand,
    fvg,
    signal,
    obCount: obs.length,
  };
}
