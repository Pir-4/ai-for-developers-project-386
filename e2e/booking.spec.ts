import { expect, test, type Page } from "@playwright/test";

// The full booking scenario through the UI, as the reviewer asked:
// the owner signs in, creates an event type and opens a day; a guest picks the
// type, the day and a free slot and books it; the owner sees the meeting; the
// next guest sees that slot as taken — in the booked type and in an
// overlapping slot of the owner's other type.

const ownerEmail = `owner-${Date.now()}@example.com`;
const eventTypeName = "Консультация";
const longTypeName = "Стратегическая сессия";

// Tomorrow in the browser's zone (Europe/Moscow, see playwright.config.ts) —
// far enough ahead that the 11:00 slot has not started yet.
const tomorrow = (() => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
})();

/** Clicks tomorrow in a Mantine DatePicker, turning to next month if needed. */
async function pickTomorrow(page: Page) {
  const month = tomorrow.toLocaleString("en-US", { month: "long" });
  const label = `${tomorrow.getDate()} ${month} ${tomorrow.getFullYear()}`;
  // The header shows the displayed month ("October 2026"); wait for it before deciding.
  const header = page.locator("button.mantine-DatePicker-calendarHeaderLevel");
  await expect(header).toBeVisible();
  if ((await header.textContent()) !== `${month} ${tomorrow.getFullYear()}`) {
    await page.locator("button.mantine-DatePicker-calendarHeaderControl[data-direction='next']").click();
  }
  const day = page.locator(`button[aria-label="${label}"]:not([data-outside])`);
  await expect(day).toBeEnabled();
  await day.click();
}

test("owner creates event types, a guest books one, the booking blocks both types", async ({
  page,
}) => {
  // Owner: sign in by email.
  await page.goto("/login");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(`/owner/${encodeURIComponent(ownerEmail)}`);

  // Owner: create a 30-minute event type.
  await page.getByLabel("Название").fill(eventTypeName);
  await page.getByLabel("Описание").fill("Разбор вашей задачи за полчаса");
  await page.getByRole("combobox", { name: "Длительность" }).click();
  await page.getByRole("option", { name: "30 мин" }).click();
  await expect(page.getByRole("combobox", { name: "Длительность" })).toHaveValue("30 мин");
  await page.getByRole("button", { name: "Создать тип" }).click();
  await expect(page.getByRole("article").filter({ hasText: eventTypeName })).toBeVisible();

  // Owner: a second, 45-minute type over the same calendar.
  await page.getByLabel("Название").fill(longTypeName);
  await page.getByLabel("Описание").fill("Подробный разбор за 45 минут");
  await page.getByRole("combobox", { name: "Длительность" }).click();
  await page.getByRole("option", { name: "45 мин" }).click();
  await expect(page.getByRole("combobox", { name: "Длительность" })).toHaveValue("45 мин");
  await page.getByRole("button", { name: "Создать тип" }).click();
  await expect(page.getByRole("article").filter({ hasText: longTypeName })).toBeVisible();

  // Owner: open tomorrow 11:00–15:00 (the editor's default interval).
  await pickTomorrow(page);
  await page.getByRole("button", { name: "Добавить интервал" }).click();
  await page.getByRole("button", { name: "Сохранить день" }).click();
  await expect(page.getByText("Сохранено")).toBeVisible();

  // Guest: the shared link opens the catalog; pick the type.
  await page.goto(`/book/${encodeURIComponent(ownerEmail)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Выберите тип встречи" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(eventTypeName) }).click();
  await expect(page.getByRole("heading", { level: 1, name: eventTypeName })).toBeVisible();

  // Guest: tomorrow, then the free 11:00–11:30 slot (30 minutes — the type's length).
  await pickTomorrow(page);
  const slot = page.getByRole("button", { name: /11:00 - 11:30/ });
  await expect(slot).toContainText("Свободно");
  await slot.click();

  await page.getByLabel("Ваше имя").fill("Анна");
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByRole("button", { name: "Забронировать" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Встреча подтверждена" })).toBeVisible();
  await expect(page.getByText(eventTypeName)).toBeVisible();

  // Owner: the meeting is listed with the event type's name and the guest.
  await page.goto(`/owner/${encodeURIComponent(ownerEmail)}`);
  const meeting = page.getByRole("article").filter({ hasText: "Анна <anna@example.com>" });
  await expect(meeting).toBeVisible();
  await expect(meeting).toContainText(eventTypeName);
  await expect(meeting).toContainText("30 мин");

  // Next guest: the booked slot is shown as taken and cannot be picked.
  await page.goto(`/book/${encodeURIComponent(ownerEmail)}`);
  await page.getByRole("link", { name: new RegExp(eventTypeName) }).click();
  await pickTomorrow(page);
  const taken = page.getByRole("button", { name: /11:00 - 11:30/ });
  await expect(taken).toContainText("Занято");
  await expect(taken).toBeDisabled();
  await expect(page.getByRole("button", { name: /11:30 - 12:00/ })).toBeEnabled();

  // Next guest, the other type: its 11:00–11:45 slot overlaps the booked
  // 11:00–11:30 and is taken too; 11:45–12:30 clears it and stays free.
  await page.goto(`/book/${encodeURIComponent(ownerEmail)}`);
  await page.getByRole("link", { name: new RegExp(longTypeName) }).click();
  await expect(page.getByRole("heading", { level: 1, name: longTypeName })).toBeVisible();
  await pickTomorrow(page);
  const overlapping = page.getByRole("button", { name: /11:00 - 11:45/ });
  await expect(overlapping).toContainText("Занято");
  await expect(overlapping).toBeDisabled();
  const clear = page.getByRole("button", { name: /11:45 - 12:30/ });
  await expect(clear).toContainText("Свободно");
  await expect(clear).toBeEnabled();
});
