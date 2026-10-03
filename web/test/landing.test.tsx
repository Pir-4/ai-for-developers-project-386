import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App.tsx'
import { landing } from '../src/content/landing.ts'
import {
  audiencesHref,
  createMeetingHref,
  githubHref,
  hexletHref,
  howHref,
} from '../src/links.ts'

// Canonical copy transcribed from docs/specs/landing-page.md § 3 — an
// independent source of truth, not the constants under test.
const copy = {
  logo: 'Запись на звонок',
  navHow: 'Как это работает',
  navOwners: 'Для владельцев',
  createMeeting: 'Создать встречу',
  heroTitle: 'Запись на звонок за 30 секунд',
  heroSubtitle:
    'Вы публикуете свободные 30-минутные слоты — гость выбирает удобное время сам. ' +
    'Никакой переписки «а вам удобно в 15:00 или в 15:30?».',
  howHeading: 'Как это работает',
  steps: [
    {
      title: 'Опубликуйте слот',
      body:
        'Отметьте свободные 30-минутные интервалы — утром, днём или вечером, ' +
        'когда вам удобно говорить.',
    },
    {
      title: 'Поделитесь ссылкой',
      body:
        'Отправьте гостю ссылку на страницу записи — он увидит все свободные слоты сразу.',
    },
    {
      title: 'Созвонитесь',
      body:
        'Гость выбирает время, встреча появляется в вашем списке ближайших звонков. ' +
        'Остаётся только позвонить.',
    },
  ],
  audiencesHeading: 'Для кого этот сервис',
  audiences: [
    {
      title: 'Владельцу встреч',
      body:
        'Вы управляете расписанием: публикуете только то время, которое действительно ' +
        'свободно, и видите все записи в одном списке.',
    },
    {
      title: 'Коллеге и команде',
      body:
        'Не нужно согласовывать полчаса перепиской — откройте ссылку на запись и ' +
        'выберите слот, который ещё свободен.',
    },
    {
      title: 'Гостю без аккаунта',
      body:
        'Запись занимает меньше минуты: имя, комментарий, слот — и всё. ' +
        'Регистрация не требуется.',
    },
  ],
  ctaHeading: 'Готовы перестать согласовывать время по переписке?',
  ctaBody: 'Опубликуйте первый слот — ссылкой можно делиться уже сегодня.',
  footerProduct: 'Продукт',
  footerProject: 'Проект',
  footerGithub: 'GitHub',
  footerHexlet: 'Учебный проект Хекслета',
}

function renderLanding() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
}

describe('content constants', () => {
  it('store exactly the canonical spec copy (no duplicated literals)', () => {
    expect(landing.logo).toBe(copy.logo)
    expect(landing.nav.how).toBe(copy.navHow)
    expect(landing.nav.owners).toBe(copy.navOwners)
    expect(landing.createMeeting).toBe(copy.createMeeting)
    expect(landing.hero.title).toBe(copy.heroTitle)
    expect(landing.hero.subtitle).toBe(copy.heroSubtitle)
    expect(landing.how.heading).toBe(copy.howHeading)
    expect(landing.how.steps).toEqual(copy.steps)
    expect(landing.audiences.heading).toBe(copy.audiencesHeading)
    expect(landing.audiences.cards).toEqual(copy.audiences)
    expect(landing.cta.heading).toBe(copy.ctaHeading)
    expect(landing.cta.body).toBe(copy.ctaBody)
    expect(landing.footer.product).toBe(copy.footerProduct)
    expect(landing.footer.project).toBe(copy.footerProject)
    expect(landing.footer.github).toBe(copy.footerGithub)
    expect(landing.footer.hexlet).toBe(copy.footerHexlet)
  })

  it('declare the anchor contract of § 4', () => {
    expect(howHref).toBe('#how')
    expect(audiencesHref).toBe('#audiences')
    expect(createMeetingHref).toBe('#cta')
    expect(githubHref).toBe(
      'https://github.com/Pir-4/ai-for-developers-project-386',
    )
    expect(hexletHref).toBe('https://ru.hexlet.io/programs/ai-for-developers')
  })
})

describe('heading hierarchy', () => {
  it('has exactly one h1 — the hero title', () => {
    renderLanding()
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(copy.heroTitle)
  })

  it('has one h2 per content section below the hero', () => {
    renderLanding()
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual([
      copy.howHeading,
      copy.audiencesHeading,
      copy.ctaHeading,
    ])
  })
})

describe('landmarks', () => {
  it('renders banner, main and contentinfo with all sections inside main', () => {
    renderLanding()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()

    const main = screen.getByRole('main')
    for (const id of ['how', 'audiences', 'cta']) {
      const section = main.querySelector(`section#${id}`)
      expect(section).toBeInTheDocument()
    }

    // vertical order per spec § 3
    const ids = [...main.querySelectorAll('section[id]')].map((el) =>
      el.getAttribute('id'),
    )
    expect(ids).toEqual(['how', 'audiences', 'cta'])
  })
})

describe('header', () => {
  it('links to both anchors', () => {
    renderLanding()
    const banner = screen.getByRole('banner')
    expect(banner).toHaveTextContent(copy.logo)
    expect(
      within(banner).getByRole('link', { name: copy.navHow }),
    ).toHaveAttribute('href', '#how')
    expect(
      within(banner).getByRole('link', { name: copy.navOwners }),
    ).toHaveAttribute('href', '#audiences')
  })

  it('shows the primary CTA', () => {
    renderLanding()
    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('link', { name: copy.createMeeting }),
    ).toHaveAttribute('href', '#cta')
  })
})

describe('steps', () => {
  it('renders an ordered list of exactly three steps with canonical titles', () => {
    renderLanding()
    const section = document.querySelector('section#how')!
    const list = within(section).getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    for (const [index, step] of copy.steps.entries()) {
      expect(items[index]).toHaveTextContent(step.title)
      expect(items[index]).toHaveTextContent(step.body)
    }
  })
})

describe('audiences', () => {
  it('renders exactly three cards with canonical titles', () => {
    renderLanding()
    const section = document.querySelector('section#audiences')!
    const cards = within(section).getAllByRole('article')
    expect(cards).toHaveLength(3)
    const titles = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titles).toEqual(copy.audiences.map((card) => card.title))
    for (const card of copy.audiences) {
      expect(section).toHaveTextContent(card.body)
    }
  })
})

describe('call-to-action', () => {
  it('closing CTA renders canonical copy', () => {
    renderLanding()
    const section = document.querySelector('section#cta')!
    expect(section).toHaveTextContent(copy.ctaHeading)
    expect(section).toHaveTextContent(copy.ctaBody)
  })

  it('every "Create meeting" button links to #cta', () => {
    renderLanding()
    const buttons = screen.getAllByRole('link', { name: copy.createMeeting })
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button).toHaveAttribute('href', '#cta')
    }
  })
})

describe('footer', () => {
  it('repeats header navigation', () => {
    renderLanding()
    const footer = screen.getByRole('contentinfo')
    expect(
      within(footer).getByRole('link', { name: copy.navHow }),
    ).toHaveAttribute('href', '#how')
    expect(
      within(footer).getByRole('link', { name: copy.navOwners }),
    ).toHaveAttribute('href', '#audiences')
  })

  it('opens external links safely', () => {
    renderLanding()
    const footer = screen.getByRole('contentinfo')
    for (const name of [copy.footerGithub, copy.footerHexlet]) {
      const link = within(footer).getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
    expect(within(footer).getByRole('link', { name: copy.footerGithub })).toHaveAttribute('href', githubHref)
    expect(within(footer).getByRole('link', { name: copy.footerHexlet })).toHaveAttribute('href', hexletHref)
  })
})
