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
  return screen.queryAllByRole('article').map((card) => within(card).getByRole('heading').textContent ?? '')
}

function card(title: string | RegExp) {
  return screen.getByRole('article', { name: title })
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

    it('renders each tag as an unpressed "Filter by tag …" button on its card (TF1, TF11)', () => {
      setup()
      const prints = card('Shop my prints')
      for (const tag of ['shop', 'art', 'prints']) {
        expect(within(prints).getByRole('button', { name: `Filter by tag ${tag}` })).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('renders no description line (and never the text "null") for a link whose description is null (B4)', () => {
      setup()
      expect(card('The Creative Break podcast')).not.toHaveTextContent(/null/i)
    })
  })

  describe('cards open the destination safely (PRD item 6, S4)', () => {
    it('each card is a link to its normalised https://example.com URL that opens in a new tab with rel="noopener noreferrer"', () => {
      setup()
      const prints = screen.getByRole('link', { name: 'Shop my prints' })
      expect(prints).toHaveAttribute('href', 'https://example.com/prints')
      expect(prints).toHaveAttribute('target', '_blank')
      expect(prints.getAttribute('rel')?.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
    })

    it('each card has exactly one link, its title inside the <h2>, and no tag button is nested in a link (TF8)', () => {
      setup()
      for (const article of screen.getAllByRole('article')) {
        const links = within(article).getAllByRole('link')
        expect(links).toHaveLength(1)
        expect(links[0]?.closest('h2')).not.toBeNull()
        for (const button of within(article).getAllByRole('button')) {
          expect(button.closest('a')).toBeNull()
        }
      }
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

  describe('accessibility (A1–A3)', () => {
    it('the search input has an accessible label "Search links" from a <label> element (A1)', () => {
      setup()
      const input = screen.getByLabelText('Search links', { selector: 'input' })
      expect(input).toBe(screen.getByRole('searchbox'))
      expect(input).not.toHaveAttribute('aria-label')
    })

    it('a polite live region announces the result count: "5 links" initially (A2)', () => {
      setup()
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(status).toHaveTextContent(/^5 links$/)
    })

    it.each([
      { query: 'beginner', announced: '2 links', why: 'plural' },
      { query: 'free drawing', announced: '1 link', why: 'singular' },
      { query: 'zzz', announced: 'No links', why: 'zero results' },
    ])('typing "$query" updates the live region to "$announced" ($why) (A2)', async ({ query, announced }) => {
      const { user, input } = setup()
      await user.type(input(), query)
      // Exact match: a substring check would let "1 links" pass for "1 link".
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(new RegExp(`^${announced}$`)))
    })

    it('Tab moves keyboard focus from the search bar to the first card link (A3)', async () => {
      const { user, input } = setup()
      await user.click(input())
      await user.tab()
      expect(screen.getByRole('link', { name: /shop my prints/i })).toHaveFocus()
    })
  })

  describe('tag filter (TF1–TF7, TF11)', () => {
    function pills(): string[] {
      return screen
        .queryAllByRole('button', { name: /^Remove tag / })
        .map((button) => (button.getAttribute('aria-label') ?? '').replace('Remove tag ', ''))
    }

    function tagButton(cardTitle: string, tag: string) {
      return within(card(cardTitle)).getByRole('button', { name: `Filter by tag ${tag}` })
    }

    it('clicking "art" on a card adds an "art" pill to the search box and immediately shows only the 2 active art links (TF1, TF2)', async () => {
      const { user } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      expect(within(screen.getByRole('list', { name: 'Selected tags' })).getByText('art')).toBeInTheDocument()
      expect(pills()).toEqual(['art'])
      expect(cardTitles()).toEqual(['Shop my prints', 'Learn watercolour'])
      expect(tagButton('Shop my prints', 'art')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('status')).toHaveTextContent(/^2 links$/)
    })

    it('a second tag ANDs with the first: "art" then "beginner" leaves only Learn watercolour (TF3)', async () => {
      const { user } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      await user.click(tagButton('Learn watercolour', 'beginner'))
      expect(pills()).toEqual(['art', 'beginner'])
      expect(cardTitles()).toEqual(['Learn watercolour'])
    })

    it('clicking a tag that is already a pill does not add a duplicate (TF5)', async () => {
      const { user } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      await user.click(tagButton('Learn watercolour', 'art'))
      expect(pills()).toEqual(['art'])
      expect(cardTitles()).toEqual(['Shop my prints', 'Learn watercolour'])
    })

    it('a pill ANDs with typed text: "beginner" pill + "free" leaves only the starter kit (TF4)', async () => {
      const { user, input } = setup()
      await user.click(tagButton('Learn watercolour', 'beginner'))
      expect(cardTitles()).toEqual(['Learn watercolour', 'Free drawing starter kit'])
      await user.type(input(), 'free')
      await waitFor(() => expect(cardTitles()).toEqual(['Free drawing starter kit']))
    })

    it('no-results message echoes both text and tags: No links match "zzz" tagged art (TF7)', async () => {
      const { user, input } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      await user.type(input(), 'zzz')
      await waitFor(() => expect(cardTitles()).toEqual([]))
      expect(screen.getByText(/no links match/i)).toHaveTextContent(/^No links match "zzz" tagged art$/)
    })

    it('the pill × button removes that tag, restores all links and returns focus to the input (TF6)', async () => {
      const { user, input } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      await user.click(screen.getByRole('button', { name: 'Remove tag art' }))
      expect(pills()).toEqual([])
      expect(screen.queryByRole('list', { name: 'Selected tags' })).not.toBeInTheDocument()
      expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES)
      expect(input()).toHaveFocus()
    })

    it('Backspace in the empty input removes the last pill, one per press (TF6)', async () => {
      const { user, input } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      await user.click(tagButton('Learn watercolour', 'beginner'))
      await user.click(input())
      await user.keyboard('{Backspace}')
      expect(pills()).toEqual(['art'])
      await user.keyboard('{Backspace}')
      expect(pills()).toEqual([])
      expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES)
    })

    it('Backspace with text in the input deletes a character, not a pill (TF6)', async () => {
      const { user, input } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      await user.type(input(), 'sh{Backspace}')
      expect(input()).toHaveValue('s')
      expect(pills()).toEqual(['art'])
    })

    it('"Clear search" removes the text and every pill (TF6)', async () => {
      const { user, input } = setup()
      await user.click(tagButton('Shop my prints', 'art'))
      expect(pills()).toEqual(['art'])
      await user.type(input(), 'zzz')
      await user.click(await screen.findByRole('button', { name: /clear search/i }))
      expect(pills()).toEqual([])
      expect(input()).toHaveValue('')
      await waitFor(() => expect(cardTitles()).toEqual(ALL_ACTIVE_TITLES))
    })

    it('typing a tag name searches text but never creates a pill (TF9)', async () => {
      const { user, input } = setup()
      await user.type(input(), 'art')
      await waitFor(() => expect(cardTitles()).toEqual(['Shop my prints', 'Learn watercolour']))
      expect(pills()).toEqual([])
    })

    it('clicking a tag does not navigate or open the card link (TF8)', async () => {
      const { user } = setup()
      const before = window.location.href
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      await user.click(tagButton('Shop my prints', 'shop'))
      expect(window.location.href).toBe(before)
      expect(open).not.toHaveBeenCalled()
      open.mockRestore()
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
