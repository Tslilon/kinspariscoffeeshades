export async function getParisWeather() {
  const latitude = 48.8566;
  const longitude = 2.3522;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=Europe%2FParis`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  const json = await res.json();

  const tempC = json?.current_weather?.temperature ?? null;
  const tempF = typeof tempC === "number" ? tempC * 9/5 + 32 : null;

  return {
    location: { name: "Paris, FR" },
    current: { temp_c: tempC, temp_f: tempF },
    raw: json,
  } as const;
}
