type GeocodeInput = {
  street?: string | null
  postalCode?: string | null
  city?: string | null
}

export async function geocodeAddress(
  input: GeocodeInput,
): Promise<{ lat: number; lng: number } | null> {
  const parts = [input.street, input.postalCode, input.city]
    .map((value) => value?.trim())
    .filter(Boolean) as string[]
  if (parts.length === 0) return null

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', parts.join(', '))

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Hapke/1.0 (https://hapke.nl)',
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const match = data?.[0]
    const lat = Number(match?.lat)
    const lng = Number(match?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
