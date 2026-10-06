export type Locale = 'ru' | 'en'

export type BlockCopy = { title: string; body: string }

export type LandingText = {
  logo: string
  nav: { how: string; owners: string }
  createMeeting: string
  myMeetings: string
  hero: { title: string; subtitle: string }
  how: { heading: string; steps: BlockCopy[] }
  audiences: { heading: string; cards: BlockCopy[] }
  cta: { heading: string; body: string }
  footer: { product: string; project: string; github: string; hexlet: string }
}

export const defaultLocale: Locale = 'ru'

// Canonical UI copy — structure mirrors docs/specs/landing-page.md § 3 / § 6.1.
export const landingCopy: Record<Locale, LandingText> = {
  ru: {
    logo: 'Запись на звонок',
    nav: {
      how: 'Как это работает',
      owners: 'Для кого',
    },
    createMeeting: 'Создать встречу',
    myMeetings: 'Мои встречи',
    hero: {
      title: 'Запись на звонок за 30 секунд',
      subtitle:
        'Вы публикуете свободные слоты — гость выбирает удобное время сам. ' +
        'Никакой переписки «а вам удобно в 15:00 или в 15:30?».',
    },
    how: {
      heading: 'Как это работает',
      steps: [
        {
          title: 'Опубликуйте слот',
          body:
            'Отметьте свободные интервалы — утром, днём или вечером, ' +
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
    },
    audiences: {
      heading: 'Для кого этот сервис',
      cards: [
        {
          title: 'Владельцу встреч',
          body:
            'Вы управляете расписанием: публикуете только то время, которое действительно ' +
            'свободно, и видите все записи в одном списке.',
        },
        {
          title: 'Коллеге и команде',
          body:
            'Не нужно согласовывать время встречи перепиской — откройте ссылку на запись и ' +
            'выберите слот, который ещё свободен.',
        },
        {
          title: 'Гостю без аккаунта',
          body:
            'Запись занимает меньше минуты: имя, комментарий, слот — и всё. ' +
            'Регистрация не требуется.',
        },
      ],
    },
    cta: {
      heading: 'Готовы перестать согласовывать время по переписке?',
      body: 'Опубликуйте первый слот — ссылкой можно делиться уже сегодня.',
    },
    footer: {
      product: 'Продукт',
      project: 'Проект',
      github: 'GitHub',
      hexlet: 'Учебный проект Хекслета',
    },
  },
  en: {
    logo: 'Call Booking',
    nav: {
      how: 'How it works',
      owners: 'Who it is for',
    },
    createMeeting: 'Create a meeting',
    myMeetings: 'My meetings',
    hero: {
      title: 'Book a call in 30 seconds',
      subtitle:
        'Publish the slots that work for you — your guest picks a time ' +
        'without a single message back and forth.',
    },
    how: {
      heading: 'How it works',
      steps: [
        {
          title: 'Publish a slot',
          body:
            'Mark your free intervals — morning, afternoon or evening, ' +
            'whenever you can talk.',
        },
        {
          title: 'Share the link',
          body:
            'Send your guest the booking page link — they see every free slot at once.',
        },
        {
          title: 'Get on the call',
          body:
            'Your guest picks a time, the meeting shows up in your upcoming calls ' +
            'list. All that is left is to ring.',
        },
      ],
    },
    audiences: {
      heading: 'Who it is for',
      cards: [
        {
          title: 'For the meeting owner',
          body:
            'You control the schedule: publish only the time that is genuinely ' +
            'free and see every booking in one list.',
        },
        {
          title: 'For colleagues and teams',
          body:
            'No negotiating the meeting time over chat — open the booking link ' +
            'and pick a slot that is still free.',
        },
        {
          title: 'For guests without an account',
          body:
            'Booking takes under a minute: name, comment, slot — done. ' +
            'No registration required.',
        },
      ],
    },
    cta: {
      heading: 'Ready to stop negotiating time over chat?',
      body: 'Publish your first slot — the link is shareable today.',
    },
    footer: {
      product: 'Product',
      project: 'Project',
      github: 'GitHub',
      // school name stays in RU in both locales (spec § 6.1)
      hexlet: 'Учебный проект Хекслета',
    },
  },
}
