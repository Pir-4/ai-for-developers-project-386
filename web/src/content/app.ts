import type { Locale } from './landing.ts'

// Copy of the app pages beyond the landing (canonical structure; the landing
// keeps its own dictionary in landing.ts). Zero hardcoded UI strings in pages.

export type LoginText = {
  title: string
  hint: string
  emailLabel: string
  submit: string
  invalidEmail: string
}

export type OwnerText = {
  title: string
  calendarTitle: string
  calendarHint: string
  dayTitle: string
  dayClosed: string
  addInterval: string
  removeInterval: string
  fromLabel: string
  toLabel: string
  save: string
  saved: string
  intervalInvalid: string
  intervalsOverlap: string
  conflictTitle: string
  saveError: string
  loadError: string
  timezoneLabel: string
  guestLinkTitle: string
  guestLinkHint: string
  copy: string
  copied: string
  meetingsTitle: string
  meetingsEmpty: string
  meetingsLoadError: string
  guestLabel: string
  whenLabel: string
}

export type GuestText = {
  title: string
  ownerLabel: string
  durationLabel: string
  dayLabel: string
  timeLabel: string
  timezoneLabel: string
  statusFree: string
  statusBusy: string
  freeCountSuffix: string
  noAvailability: string
  noSlotsForDay: string
  nameLabel: string
  nameRequired: string
  nameTooLong: string
  emailLabel: string
  emailInvalid: string
  submit: string
  slotTaken: string
  confirmedTitle: string
  guestLabel: string
  whenLabel: string
}

export type AppText = {
  login: LoginText
  owner: OwnerText
  guest: GuestText
  notFound: { title: string; toMain: string }
  shared: { minutesSuffix: string }
  errors: { network: string }
}

export const appCopy: Record<Locale, AppText> = {
  ru: {
    login: {
      title: 'Вход для владельца',
      hint: 'Введите email — без пароля и регистрации',
      emailLabel: 'Email',
      submit: 'Войти',
      invalidEmail: 'Введите корректный email',
    },
    owner: {
      title: 'Ваш календарь',
      calendarTitle: 'Календарь',
      calendarHint: 'Выберите день, чтобы указать часы приёма — на 14 дней вперёд',
      dayTitle: 'Часы приёма',
      dayClosed: 'День закрыт — часы не указаны',
      addInterval: 'Добавить интервал',
      removeInterval: 'Удалить интервал',
      fromLabel: 'Начало',
      toLabel: 'Конец',
      save: 'Сохранить день',
      saved: 'Сохранено',
      intervalInvalid: 'Конец должен быть позже начала',
      intervalsOverlap: 'Интервалы не должны пересекаться',
      conflictTitle: 'Нельзя убрать часы из-под уже назначенной встречи',
      saveError: 'Не удалось сохранить день',
      loadError: 'Не удалось загрузить календарь',
      timezoneLabel: 'Часовой пояс',
      guestLinkTitle: 'Ссылка на ваш календарь',
      guestLinkHint: 'Отправьте её гостю — он сам выберет длительность и время',
      copy: 'Скопировать',
      copied: 'Скопировано',
      meetingsTitle: 'Ближайшие встречи',
      meetingsEmpty: 'Пока нет ни одной встречи',
      meetingsLoadError: 'Не удалось загрузить встречи',
      guestLabel: 'Гость',
      whenLabel: 'Когда',
    },
    guest: {
      title: 'Запись на встречу',
      ownerLabel: 'Встреча с',
      durationLabel: 'Длительность',
      dayLabel: 'Выберите день',
      timeLabel: 'Время',
      timezoneLabel: 'Часовой пояс',
      statusFree: 'Свободно',
      statusBusy: 'Занято',
      freeCountSuffix: 'св.',
      noAvailability: 'Владелец пока не открыл ни одного дня для записи',
      noSlotsForDay: 'На этот день свободного времени нет',
      nameLabel: 'Ваше имя',
      nameRequired: 'Введите имя',
      nameTooLong: 'Не длиннее 100 символов',
      emailLabel: 'Email',
      emailInvalid: 'Введите корректный email',
      submit: 'Забронировать',
      slotTaken: 'Это время только что заняли — выберите другое',
      confirmedTitle: 'Встреча подтверждена',
      guestLabel: 'Гость',
      whenLabel: 'Когда',
    },
    notFound: {
      title: 'Страница не найдена',
      toMain: 'На главную',
    },
    shared: {
      minutesSuffix: 'мин',
    },
    errors: {
      network: 'Сервер недоступен — попробуйте ещё раз',
    },
  },
  en: {
    login: {
      title: 'Owner sign in',
      hint: 'Enter your email — no password, no registration',
      emailLabel: 'Email',
      submit: 'Sign in',
      invalidEmail: 'Enter a valid email',
    },
    owner: {
      title: 'Your calendar',
      calendarTitle: 'Calendar',
      calendarHint: 'Pick a day to declare your hours — up to 14 days ahead',
      dayTitle: 'Hours',
      dayClosed: 'Day closed — no hours declared',
      addInterval: 'Add interval',
      removeInterval: 'Remove interval',
      fromLabel: 'Start',
      toLabel: 'End',
      save: 'Save day',
      saved: 'Saved',
      intervalInvalid: 'End must be after start',
      intervalsOverlap: 'Intervals must not overlap',
      conflictTitle: 'Hours cannot be withdrawn from under a booked meeting',
      saveError: 'Failed to save the day',
      loadError: 'Failed to load the calendar',
      timezoneLabel: 'Time zone',
      guestLinkTitle: 'Link to your calendar',
      guestLinkHint: 'Send it to a guest — they pick the length and the time',
      copy: 'Copy',
      copied: 'Copied',
      meetingsTitle: 'Upcoming meetings',
      meetingsEmpty: 'No meetings yet',
      meetingsLoadError: 'Failed to load meetings',
      guestLabel: 'Guest',
      whenLabel: 'When',
    },
    guest: {
      title: 'Book a meeting',
      ownerLabel: 'Meeting with',
      durationLabel: 'Length',
      dayLabel: 'Choose a day',
      timeLabel: 'Time',
      timezoneLabel: 'Time zone',
      statusFree: 'Free',
      statusBusy: 'Taken',
      freeCountSuffix: 'free',
      noAvailability: 'This owner has not opened any days yet',
      noSlotsForDay: 'No free time on this day',
      nameLabel: 'Your name',
      nameRequired: 'Enter a name',
      nameTooLong: 'At most 100 characters',
      emailLabel: 'Email',
      emailInvalid: 'Enter a valid email',
      submit: 'Book',
      slotTaken: 'This time was just taken — pick another',
      confirmedTitle: 'Meeting confirmed',
      guestLabel: 'Guest',
      whenLabel: 'When',
    },
    notFound: {
      title: 'Page not found',
      toMain: 'Go home',
    },
    shared: {
      minutesSuffix: 'min',
    },
    errors: {
      network: 'Server unavailable — try again',
    },
  },
}
