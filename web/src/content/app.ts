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
  formTitle: string
  nameLabel: string
  nameRequired: string
  nameTooLong: string
  descriptionLabel: string
  descriptionRequired: string
  descriptionTooLong: string
  durationLabel: string
  durationInvalid: string
  create: string
  listTitle: string
  guestLinkLabel: string
  copy: string
  copied: string
  empty: string
  loadError: string
}

export type GuestText = {
  title: string
  soon: string
  notFound: string
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
      title: 'Ваши типы встреч',
      formTitle: 'Новый тип встречи',
      nameLabel: 'Название',
      nameRequired: 'Введите название',
      nameTooLong: 'Не длиннее 100 символов',
      descriptionLabel: 'Описание',
      descriptionRequired: 'Введите описание',
      descriptionTooLong: 'Не длиннее 500 символов',
      durationLabel: 'Длительность, минут',
      durationInvalid: 'Число от 15 до 240, кратное 15',
      create: 'Создать',
      listTitle: 'Ссылки для гостей',
      guestLinkLabel: 'Ссылка для гостя',
      copy: 'Скопировать',
      copied: 'Скопировано',
      empty: 'Пока нет ни одного типа встречи',
      loadError: 'Не удалось загрузить список',
    },
    guest: {
      title: 'Запись на встречу',
      soon: 'Выбор времени появится на следующем шаге',
      notFound: 'Такой тип встречи не найден',
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
      title: 'Your event types',
      formTitle: 'New event type',
      nameLabel: 'Name',
      nameRequired: 'Enter a name',
      nameTooLong: 'At most 100 characters',
      descriptionLabel: 'Description',
      descriptionRequired: 'Enter a description',
      descriptionTooLong: 'At most 500 characters',
      durationLabel: 'Duration, minutes',
      durationInvalid: 'A multiple of 15 between 15 and 240',
      create: 'Create',
      listTitle: 'Guest links',
      guestLinkLabel: 'Guest link',
      copy: 'Copy',
      copied: 'Copied',
      empty: 'No event types yet',
      loadError: 'Failed to load the list',
    },
    guest: {
      title: 'Book a meeting',
      soon: 'Time picking is coming in the next step',
      notFound: 'This event type is not found',
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
