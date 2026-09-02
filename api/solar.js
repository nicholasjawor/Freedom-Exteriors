export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { address, city, state } = req.query;
  if (!address || !city || !state) return res.status(400).json({ error: "Missing address, city, or state" });

  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Google Solar API key not configured on server" });

  try {
    // Step 1: Geocode the address to lat/lng
    const fullAddress = `${address}, ${city}, ${state}`;
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`
    );
    const geoData = await geoRes.json();
    if (geoData.status !== "OK" || !geoData.results?.length) {
      return res.status(404).json({ error: "Could not locate that address", details: geoData.status });
    }
    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: Fetch Solar building insights for that location
    const solarRes = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${apiKey}`
    );
    const solarData = await solarRes.json();

    if (solarData.error) {
      return res.status(404).json({ error: "No roof data available for this address", details: solarData.error.message });
    }

    const segments = solarData.solarPotential?.roofSegmentStats || [];
    if (!segments.length) {
      return res.status(404).json({ error: "Google has no roof segment data for this address" });
    }

    // Total roof area in sq ft, area-weighted average pitch in degrees -> rise/12
    let totalAreaM2 = 0;
    let weightedPitchSum = 0;
    segments.forEach(seg => {
      const areaM2 = seg.stats?.areaMeters2 || 0;
      const pitchDeg = seg.pitchDegrees || 0;
      totalAreaM2 += areaM2;
      weightedPitchSum += areaM2 * pitchDeg;
    });
    const avgPitchDeg = totalAreaM2 > 0 ? weightedPitchSum / totalAreaM2 : 0;
    const totalAreaSqFt = totalAreaM2 * 10.7639;
    const pitchRisePerTwelve = Math.round(Math.tan(avgPitchDeg * Math.PI / 180) * 12 * 10) / 10;

    return res.status(200).json({
      success: true,
      lat, lng,
      totalAreaSqFt: Math.round(totalAreaSqFt),
      avgPitchDegrees: Math.round(avgPitchDeg * 10) / 10,
      pitchRisePerTwelve,
      segmentCount: segments.length,
      imageryDate: solarData.imageryDate || null,
      imageryQuality: solarData.imageryQuality || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}