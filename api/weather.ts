import type { VercelRequest, VercelResponse } from '@vercel/node'

// Hong Kong Observatory weather icon mapping
const WEATHER_ICONS: Record<number, string> = {
  50: '☀️', 51: '☀️', 52: '⛅', 53: '⛅', 54: '☁️',
  60: '🌧️', 61: '🌧️', 62: '🌧️', 63: '⛈️', 64: '⛈️', 65: '⛈️',
  70: '☁️', 71: '☁️', 72: '☁️', 73: '☁️',
  74: '🌤️', 75: '🌤️', 76: '⛅', 77: '☁️',
  80: '🌪️', 81: '🌪️', 82: '🌪️', 83: '🌪️', 84: '🌪️', 85: '🌪️',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=600') // cache 10 min
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // Hong Kong Observatory API - current weather
    const [weatherRes, warningRes] = await Promise.all([
      fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc'),
      fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warningInfo&lang=tc'),
    ])

    const weather = await weatherRes.json()
    const warnings = await warningRes.json()

    // Extract current temperature (Hong Kong Observatory)
    const temp = weather?.temperature?.data?.find((d: any) => d.place === '香港天文台')?.value
      || weather?.temperature?.data?.[0]?.value || '--'

    // Extract weather icon code
    const iconCode = weather?.icon?.[0] || 50
    const icon = WEATHER_ICONS[iconCode] || '🌤️'

    // Extract humidity
    const humidity = weather?.humidity?.data?.[0]?.value || '--'

    // Weather description
    const desc = weather?.generalInfo || ''

    // Typhoon / warning signals
    const tcSignal = warnings?.details?.find((w: any) =>
      w.warningStatementCode?.startsWith('TC') || w.subtype?.includes('TC')
    )
    let typhoonSignal = ''
    if (tcSignal) {
      const match = tcSignal.contents?.join(' ')?.match(/(\d+)號/) || tcSignal.subtype?.match(/TC(\d+)/)
      if (match) {
        typhoonSignal = `🌀T${match[1]}`
      } else {
        typhoonSignal = '🌀'
      }
    }

    // Rain warning
    const rainWarning = warnings?.details?.find((w: any) =>
      w.warningStatementCode === 'WRAINA' || w.warningStatementCode === 'WRAIN'
    )
    let rainSignal = ''
    if (rainWarning) {
      const content = rainWarning.contents?.join(' ') || ''
      if (content.includes('黑色')) rainSignal = '⚫暴雨黑'
      else if (content.includes('紅色')) rainSignal = '🔴暴雨紅'
      else if (content.includes('黃色')) rainSignal = '🟡暴雨黃'
    }

    return res.json({
      icon,
      temp: `${temp}°C`,
      humidity: `${humidity}%`,
      typhoon: typhoonSignal,
      rain: rainSignal,
      warning: typhoonSignal || rainSignal || '',
    })
  } catch (error: any) {
    // Fallback
    return res.json({
      icon: '🌤️',
      temp: '--°C',
      humidity: '--%',
      typhoon: '',
      rain: '',
      warning: '',
    })
  }
}
