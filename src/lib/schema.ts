import { z } from 'zod'

// S2: links may only point at these exact origins (scheme + host + port).
// Comparing the parsed `origin` defeats string tricks like
// `https://example.com@evil.com` or `https://example.com.evil.com`.
export const ALLOWED_ORIGINS: readonly string[] = ['https://example.com']

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function isAllowedUrl(value: string): boolean {
  const url = parseUrl(value)
  if (!url) return false
  if (url.username || url.password) return false
  return ALLOWED_ORIGINS.includes(url.origin)
}

export const LinkSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  // Store the normalised href so the rendered value is exactly the checked value.
  url: z
    .string()
    .refine(isAllowedUrl, { message: 'URL origin is not allowlisted' })
    .transform((value) => new URL(value).href),
  description: z.string().nullable(),
  // TF9: no empty tags, so no empty badge or pill can be rendered.
  tags: z.array(z.string().trim().min(1)),
  active: z.boolean(),
})

export const CreatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  bio: z.string(),
})

// Links are validated one by one so a single bad record can't take down the page.
const PayloadSchema = z.object({
  creator: CreatorSchema,
  links: z.array(z.unknown()),
})

export type Link = z.infer<typeof LinkSchema>
export type Creator = z.infer<typeof CreatorSchema>
export type CreatorData = { creator: Creator; links: Link[] }

function warnDropped(index: number, reason: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[data] dropped link at index ${index}: ${reason}`)
  }
}

// S1: treat data.json as untrusted creator input. Never throws.
export function parseCreatorData(raw: unknown): CreatorData | null {
  const payload = PayloadSchema.safeParse(raw)
  if (!payload.success) return null

  const links: Link[] = []
  const seenIds = new Set<string>()

  payload.data.links.forEach((entry, index) => {
    const parsed = LinkSchema.safeParse(entry)
    if (!parsed.success) {
      warnDropped(index, z.prettifyError(parsed.error))
      return
    }
    if (seenIds.has(parsed.data.id)) {
      warnDropped(index, `duplicate id "${parsed.data.id}"`)
      return
    }
    seenIds.add(parsed.data.id)
    links.push(parsed.data)
  })

  return { creator: payload.data.creator, links }
}
