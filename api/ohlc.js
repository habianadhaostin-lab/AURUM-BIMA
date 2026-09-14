// Vercel/Netlify serverless function — proxy ke Twelve Data.
// Menyembunyikan API key dari browser dan menormalkan hasilnya jadi
// array candle [open, high, low, close] yang siap dipakai CandleChart.
//
// Setup:
// 1. Daftar gratis di https://twelvedata.com dan ambil API key.
// 2. Di Vercel: Project Settings → Environment Variables → tambahkan
//    TWELVE_DATA_API_KEY = <api-key-kamu>
// 3. Deploy. Endpoint ini otomatis aktif di /api/ohlc

const INTERVAL_MAP = {
  M5: "5min",
  M15: "15min",
  H1: "1h",
  H4: "4h",
};

export default async function handler(req, res) {
  const tf = req.query.timeframe || "H1";
  const interval = INTERVAL_MAP[tf] || "1h";
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "TWELVE_DATA_API_KEY belum diset di environment variables.",
    });
  }

  const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=80&apikey=${apiKey}`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    if (data.status === "error") {
      return res.status(502).json({ error: data.message || "Twelve Data menolak permintaan." });
    }
    if (!Array.isArray(data.values)) {
      return res.status(502).json({ error: "Format respons tidak dikenali." });
    }

    // Twelve Data mengembalikan data terbaru di indeks pertama — balik urutannya
    // supaya kronologis (lama -> baru), sesuai yang dibutuhkan chart.
    const candles = data.values
      .slice()
      .reverse()
      .map((v) => [
        parseFloat(v.open),
        parseFloat(v.high),
        parseFloat(v.low),
        parseFloat(v.close),
      ]);

    // Cache di edge Vercel selama 2 menit — kalau ada banyak tab/pengguna
    // buka barengan dalam rentang itu, cuma dihitung 1x ke kuota Twelve Data.
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    return res.status(200).json({
      candles,
      timeframe: tf,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
