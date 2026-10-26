import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import sampleData from '@/data/data.json'
import App from './App'
import { MAX_QUERY_LENGTH } from './lib/search'

function setup(data?: unknown) {
  const user = userEvent.setup()
  render(data === undefined ? <App /> : <App data={data} />)
  return { user, input: () => screen.getByRole('searchbox') }
}

function cardTitles(): string[] {
  return screen.queryAllByRole('link').map((card) => {
    const heading = within(card).getByRole('heading')
    return heading.textContent ?? ''
  })
}

const ALL_ACTIVE_TITLES = [
  'Shop my prints',
  'Learn watercolour',
  'Free drawing starter kit',
  'The Creative Break podcast',
  'Join my newsletter',
]

describe('App (integration: typing in the search bar filters the rendered cards)', () => {
  describe('initial render', () => {
    it('shows the creator name and bio from data.json', () => {
      setup()
      expect(screen.getByRole('heading', { level: 1, name: 'Maya Creates' })).toBeInTheDocument()
      expect(screen.getByText('Illustrator, educator and occasional podcast host.')).toBeInTheDocument()
    })

    it('renders one card per active link, in source order; inactive "Book a commission" is absent (B1, B2, B7)', () => {
      setup()
      expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES)
      expect(screen.queryByText('Book a commission')).not.toBeInTheDocument()
    })

    it('renders tags on each card', () => {
      setup()
      const prints = screen.getByRole('link', { name: /shop my prints/i })
      expect(within(prints).getByText('shop')).toBeInTheDocument()
      expect(within(prints).getByText('prints')).toBeInTheDocument()
    })

    it('renders no description line (and never the text "null") for a link whose description is null (B4)', () => {
      setup()
      const podcast = screen.getByRole('link', { name: /the creative break podcast/i })
      expect(podcast).not.toHaveTextContent(/null/i)
    })
  })

  describe('cards open the destination safely (PRD item 6, S4)', () => {
    it('each card is a link to its normalised https://example.com URL that opens in a new tab with rel="noopener noreferrer"', () => {
      setup()
      const prints = screen.getByRole('link', { name: /shop my prints/i })
      expect(prints).toHaveAttribute('href', 'https://example.com/prints')
      expect(prints).toHaveAttribute('target', '_blank')
      expect(prints.getAttribute('rel')?.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
    })
  })

  describe('searching', () => {
    it('typing "beginner" narrows the list to the 2 beginner links (B3, case-insensitive tag match)', async () => {
      const { user, input } = setup()
      await user.type(input(), 'BEGINNER')
      await waitFor(() => expect(cardTitles()).toEqual(['Learn watercolour', 'Free drawing starter kit']))
    })

    it('typing "free drawing" requires both words and leaves only the starter kit (B5)', async () => {
      const { user, input } = setup()
      await user.type(input(), 'free drawing')
      await waitFor(() => expect(cardTitles()).toEqual(['Free drawing starter kit']))
    })

    it('clearing the input by hand restores all active links (B2)', async () => {
      const { user, input } = setup()
      await user.type(input(), 'podcast')
      await waitFor(() => expect(cardTitles()).toEqual(['The Creative Break podcast']))
      await user.clear(input())
      await waitFor(() => expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES))
    })

    it(`caps the input at ${MAX_QUERY_LENGTH} characters via maxLength (S5)`, () => {
      const { input } = setup()
      expect(input()).toHaveAttribute('maxLength', String(MAX_QUERY_LENGTH))
    })
  })

  describe('no-results state (B6)', () => {
    it('typing "zzz" removes all cards and shows a message that echoes the query', async () => {
      const { user, input } = setup()
      await user.type(input(), 'zzz')
      await waitFor(() => expect(cardTitles()).toEqual([]))
      expect(screen.getByText(/no links match/i)).toHaveTextContent('zzz')
    })

    it('"Clear search" empties the input, restores all active links and returns focus to the search bar', async () => {
      const { user, input } = setup()
      await user.type(input(), 'zzz')
      await user.click(await screen.findByRole('button', { name: /clear search/i }))
      expect(input()).toHaveValue('')
      expect(input()).toHaveFocus()
      await waitFor(() => expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES))
    })

    it('echoes a hostile query as plain text: no <img> element is created from "<img src=x onerror=alert(1)>" (S3)', async () => {
      const { user, input } = setup()
      const payload = '<img src=x onerror=alert(1)>'
      // user-event treats "<" literally but "{" / "[" as key descriptors, so this payload is safe to type.
      await user.type(input(), payload)
      await waitFor(() => expect(screen.getByText(/no links match/i)).toHaveTextContent(payload))
      expect(document.querySelector('img')).toBeNull()
    })
  })

  describe('untrusted data (S1, S2)', () => {
    let warn: MockInstance<typeof console.warn>

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warn.mockRestore()
    })

    it('does not render cards for javascript: or userinfo-trick URLs; valid links still render', () => {
      const hostile = {
        ...sampleData,
        links: [
          ...sampleData.links,
          { id: 'x1', title: 'XSS link', url: 'javascript:alert(1)', description: null, tags: [], active: true },
          { id: 'x2', title: 'Phish link', url: 'https://example.com@evil.com/', description: null, tags: [], active: true },
        ],
      }
      setup(hostile)
      expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES)
      expect(screen.queryByText('XSS link')).not.toBeInTheDocument()
      expect(screen.queryByText('Phish link')).not.toBeInTheDocument()
      for (const card of screen.getAllByRole('link')) {
        expect(new URL(card.getAttribute('href') ?? '').origin).toBe('https://example.com')
      }
    })

    it('shows an "unavailable" message instead of crashing when the whole payload is invalid', () => {
      setup({ creator: null, links: 'nope' })
      expect(screen.getByText(/this profile is unavailable/i)).toBeInTheDocument()
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    })
  })
})
