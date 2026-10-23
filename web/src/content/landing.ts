export type Locale = 'ru' | 'en'

export type BlockCopy = { title: string; body: string }

export type LandingText = {
  logo: string
  nav: { how: string; owners: string }
  bookCall: string
  ownerArea: string
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
    bookCall: 'Записаться на звонок',
    ownerArea: 'Кабинет владельца',
    hero: {
      title: 'Запись на звонок за 30 секунд',
      subtitle:
        'Выберите тип встречи и свободный слот в календаре — запись готова. ' +
        'Никакой переписки «а вам удобно в 15:00 или в 15:30?».',
    },
    how: {
      heading: 'Как это работает',
      steps: [
        {
          title: 'Выберите тип встречи',
          body:
            'Откройте страницу записи и выберите, о чём хотите поговорить, — ' +
            'каждая встреча длится 30 минут.',
        },
        {
          title: 'Выберите дату и время',
          body:
            'Календарь показывает ближайшие 14 дней и все свободные слоты — ' +
            'занятые видны, но недоступны.',
        },
        {
          title: 'Созвонитесь',
          body:
            'Оставьте имя и email — встреча сразу появится в списке ближайших звонков ' +
            'владельца. Остаётся только позвонить.',
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
      body: 'Выберите свободный слот — запись занимает меньше минуты.',
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
    bookCall: 'Book a call',
    ownerArea: 'Owner area',
    hero: {
      title: 'Book a call in 30 seconds',
      subtitle:
        'Pick a meeting type and a free slot in the calendar — that is it. ' +
        'No messages back and forth.',
    },
    how: {
      heading: 'How it works',
      steps: [
        {
          title: 'Pick a meeting type',
          body:
            'Open the booking page and choose what you want to talk about — ' +
            'every meeting is 30 minutes.',
        },
        {
          title: 'Pick a date and time',
          body:
            'The calendar shows the next 14 days and every free slot — ' +
            'taken ones are visible but disabled.',
        },
        {
          title: 'Get on the call',
          body:
            'Leave your name and email — the meeting shows up in the owner\'s ' +
            'upcoming calls right away. All that is left is to ring.',
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
      body: 'Pick a free slot — booking takes under a minute.',
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
