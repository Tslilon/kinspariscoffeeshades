import { getParisWeather } from "@/app/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  const response = await getParisWeather();
  const body = JSON.stringify({
    ...response,
    infoLink: "https://open-meteo.com/en/docs",
  });
  return new Response(body, {
    headers: { "content-type": "application/json" },
  });
}
