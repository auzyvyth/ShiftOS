export const config = { runtime: 'edge' }

const BOT_AGENTS = /bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot/i

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')
  const ua = req.headers.get('user-agent') || ''

  if (!slug) {
    return new Response('Missing slug', { status: 400 })
  }

  // Non-bots: serve index.html directly — no redirect (redirect → loop)
  if (!BOT_AGENTS.test(ua)) {
    const indexRes = await fetch(new URL('/', req.url).toString())
    return new Response(indexRes.body, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const res = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/car_listings?slug=eq.${slug}&select=brand,model,year,images,selling_price,slug`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
      },
    }
  )

  const [car] = await res.json()
  if (!car) return new Response('Not found', { status: 404 })

  const title = `${car.year} ${car.brand} ${car.model}`
  const price = `RM ${Number(car.selling_price).toLocaleString()}`
  const image = car.images?.[0] ?? 'https://xdrive.my/og-default.jpg'
  const carUrl = `https://xdrive.my/cars/${car.slug}`

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title} | xdrive.my</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${price} — Available on xdrive.my" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${carUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:image" content="${image}" />
  </head>
  <body>
    <script>window.location.href = "${carUrl}";</script>
  </body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
