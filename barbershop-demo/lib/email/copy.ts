import type { Locale } from "@/i18n/routing";

// The words of every email, in both languages. Kept apart from the interface
// catalog because emails are written outside a request, by the queue worker,
// and in the language saved with the booking, not the language of whoever
// happens to be looking at the site. tests/email.test.ts keeps the two
// languages in step.

export type EmailType = "verification" | "confirmation" | "reminder_24h" | "reminder_2h" | "cancellation" | "reschedule";

type EmailCopy = {
  /** `{reference}` and `{date}` are filled in. */
  subject: string;
  heading: string;
  /** `{name}`, `{minutes}` and `{hours}` are filled in where they appear. */
  intro: string;
  /** The label of the link, for emails that have one. */
  action?: string;
  /** Said under the link. */
  note?: string;
};

type Copy = {
  emails: Record<EmailType, EmailCopy>;
  labels: { when: string; barber: string; services: string; duration: string; total: string; reference: string; address: string };
  payInShop: string;
  londonTime: string;
  linkFallback: string;
  concept: string;
};

export const EMAIL_COPY: Record<Locale, Copy> = {
  en: {
    emails: {
      verification: {
        subject: "Confirm your booking at CUT&CO",
        heading: "One step left.",
        intro: "Hello {name}. We are holding this time for you for {minutes} minutes. Confirm it and it is yours.",
        action: "Confirm my booking",
        note: "If you did not ask for this, ignore this email: the hold lapses by itself and nothing is booked.",
      },
      confirmation: {
        subject: "Booked: {date} at CUT&CO",
        heading: "You are booked.",
        intro: "Hello {name}. Your appointment is confirmed. We will remind you the day before and two hours before.",
        action: "View or change my booking",
        note: "You can change or cancel free of charge up to {hours} hours before the appointment.",
      },
      reminder_24h: {
        subject: "Tomorrow at CUT&CO: {date}",
        heading: "See you tomorrow.",
        intro: "Hello {name}. A reminder of your appointment tomorrow.",
        action: "View or change my booking",
        note: "Plans changed? You can change or cancel up to {hours} hours before the appointment.",
      },
      reminder_2h: {
        subject: "In two hours at CUT&CO",
        heading: "Two hours to go.",
        intro: "Hello {name}. Your appointment starts in two hours.",
        action: "View my booking",
      },
      cancellation: {
        subject: "Cancelled: your booking at CUT&CO",
        heading: "Your booking is cancelled.",
        intro: "Hello {name}. This appointment has been cancelled and the time released. You are welcome to book again whenever suits.",
      },
      reschedule: {
        subject: "Moved: {date} at CUT&CO",
        heading: "Your booking has moved.",
        intro: "Hello {name}. Your appointment has a new time. The details below are the current ones.",
        action: "View or change my booking",
        note: "You can change or cancel free of charge up to {hours} hours before the appointment.",
      },
    },
    labels: {
      when: "When",
      barber: "Barber",
      services: "Services",
      duration: "Duration",
      total: "Total",
      reference: "Reference",
      address: "Where",
    },
    payInShop: "Payment is taken in the shop, in US dollars.",
    londonTime: "London time",
    linkFallback: "If the button does not work, copy this address into your browser:",
    concept: "CUT&CO is a concept portfolio project, not a real barbershop. This email was produced by a demonstration.",
  },
  ru: {
    emails: {
      verification: {
        subject: "Подтвердите запись в CUT&CO",
        heading: "Остался один шаг.",
        intro: "Здравствуйте, {name}. Мы держим это время за вами {minutes} минут. Подтвердите запись — и оно ваше.",
        action: "Подтвердить запись",
        note: "Если вы не записывались, просто не отвечайте на письмо: бронь снимется сама, запись не будет создана.",
      },
      confirmation: {
        subject: "Вы записаны: {date}, CUT&CO",
        heading: "Вы записаны.",
        intro: "Здравствуйте, {name}. Запись подтверждена. Мы напомним о ней за сутки и за два часа.",
        action: "Посмотреть или изменить запись",
        note: "Перенести или отменить запись можно бесплатно не позже чем за {hours} часов до визита.",
      },
      reminder_24h: {
        subject: "Завтра в CUT&CO: {date}",
        heading: "Ждём вас завтра.",
        intro: "Здравствуйте, {name}. Напоминаем о записи на завтра.",
        action: "Посмотреть или изменить запись",
        note: "Планы изменились? Перенести или отменить запись можно не позже чем за {hours} часов до визита.",
      },
      reminder_2h: {
        subject: "Через два часа в CUT&CO",
        heading: "Осталось два часа.",
        intro: "Здравствуйте, {name}. Ваша запись начнётся через два часа.",
        action: "Посмотреть запись",
      },
      cancellation: {
        subject: "Запись в CUT&CO отменена",
        heading: "Запись отменена.",
        intro: "Здравствуйте, {name}. Эта запись отменена, время освобождено. Будем рады видеть вас в любой другой день.",
      },
      reschedule: {
        subject: "Запись перенесена: {date}, CUT&CO",
        heading: "Запись перенесена.",
        intro: "Здравствуйте, {name}. У вашей записи новое время. Ниже — актуальные данные.",
        action: "Посмотреть или изменить запись",
        note: "Перенести или отменить запись можно бесплатно не позже чем за {hours} часов до визита.",
      },
    },
    labels: {
      when: "Когда",
      barber: "Барбер",
      services: "Услуги",
      duration: "Длительность",
      total: "Итого",
      reference: "Номер записи",
      address: "Где",
    },
    payInShop: "Оплата на месте, в долларах США.",
    londonTime: "время лондонское",
    linkFallback: "Если кнопка не работает, скопируйте этот адрес в браузер:",
    concept: "CUT&CO — концепт для портфолио, а не настоящий барбершоп. Это письмо создано демонстрацией.",
  },
};
