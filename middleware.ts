import { NextRequest, NextResponse } from 'next/server'

const BOT_AGENTS =
  /bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot/i

export async function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  const { pathname } = req.nextUrl

  if (!BOT_AGENTS.test(ua) || !pathname.startsWith('/cars/')) {
    return NextResponse.next()
  }

  const slug = pathname.split('/cars/')[1]
  if (!slug) return NextResponse.next()

  try {
    const res = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/car_listings?slug=eq.${encodeURIComponent(slug)}&select=brand,model,year,images,selling_price,slug`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
        },
      }
    )

    const [car] = await res.json()
    if (!car) return NextResponse.next()

    const title = `${car.year} ${car.brand} ${car.model}`
    const price = `RM ${Number(car.selling_price).toLocaleString('en-MY')}`
    const image = car.images?.[0] ?? 'https://xdrive.my/og-default.jpg'
    const url   = `https://xdrive.my/cars/${car.slug}`
    const desc  = `${price} — Available on xdrive.my`

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title} | xdrive.my</title>
    <meta property="og:title"       content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image"       content="${image}" />
    <meta property="og:url"         content="${url}" />
    <meta property="og:type"        content="website" />
    <meta name="twitter:card"       content="summary_large_image" />
    <meta name="twitter:title"      content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image"      content="${image}" />
  </head>
  <body>
    <script>window.location.href = "${url}";</script>
  </body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/cars/:path*'],
}
