import { expect, test, type Page } from "@playwright/test";

// The full booking scenario through the UI, as the reviewer asked:
// the single predefined owner opens their area (no login), creates two event
// types and opens a day; a guest follows the landing CTA, picks a type, the day
// and a free 30-minute slot and books it; the owner sees the meeting; the next
// guest sees that slot as taken — in the booked type and in the other type.

// Unique per run: against a reused database (E2E_BASE_URL) earlier runs' types
// stay in the catalog.
const runId = Date.now();
const eventTypeName = `Консультация ${runId}`;
const otherTypeName = `Знакомство ${runId}`;

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
  // Owner: the owner area opens straight away — one predefined owner, no login.
  await page.goto("/owner");
  await expect(page.getByRole("heading", { level: 1, name: "Ваш календарь" })).toBeVisible();

  // Owner: two event types; the duration is fixed at 30 minutes.
  for (const [name, description] of [
    [eventTypeName, "Разбор вашей задачи за полчаса"],
    [otherTypeName, "Первый короткий созвон"],
  ]) {
    await page.getByLabel("Название").fill(name);
    await page.getByLabel("Описание").fill(description);
    await page.getByRole("button", { name: "Создать тип" }).click();
    const card = page.getByRole("article").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText("30 мин");
  }

  // Owner: open tomorrow 11:00–15:00 (the editor's default interval).
  await pickTomorrow(page);
  await page.getByRole("button", { name: "Добавить интервал" }).click();
  await page.getByRole("button", { name: "Сохранить день" }).click();
  await expect(page.getByText("Сохранено")).toBeVisible();

  // Guest: the landing's main CTA leads to the catalog; pick the type.
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Записаться на звонок" }).first().click();
  await expect(page).toHaveURL("/book");
  await expect(page.getByRole("heading", { level: 1, name: "Выберите тип встречи" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(eventTypeName) }).click();
  await expect(page.getByRole("heading", { level: 1, name: eventTypeName })).toBeVisible();

  // Guest: tomorrow, then the free 11:00–11:30 slot; slots step every 30 minutes.
  await pickTomorrow(page);
  const slot = page.getByRole("button", { name: /11:00 - 11:30/ });
  await expect(slot).toContainText("Свободно");
  await expect(page.getByRole("button", { name: /11:30 - 12:00/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /11:15/ })).toHaveCount(0);
  await slot.click();

  await page.getByLabel("Ваше имя").fill("Анна");
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByRole("button", { name: "Забронировать" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Встреча подтверждена" })).toBeVisible();
  await expect(page.getByText(eventTypeName)).toBeVisible();

  // Owner: the meeting is listed with the event type's name and the guest.
  await page.goto("/owner");
  const meeting = page.getByRole("article").filter({ hasText: eventTypeName }).filter({
    hasText: "Анна <anna@example.com>",
  });
  await expect(meeting).toBeVisible();
  await expect(meeting).toContainText("30 мин");

  // Next guest: the booked slot is shown as taken and cannot be picked.
  await page.goto("/book");
  await page.getByRole("link", { name: new RegExp(eventTypeName) }).click();
  await pickTomorrow(page);
  const taken = page.getByRole("button", { name: /11:00 - 11:30/ });
  await expect(taken).toContainText("Занято");
  await expect(taken).toBeDisabled();
  await expect(page.getByRole("button", { name: /11:30 - 12:00/ })).toBeEnabled();

  // Next guest, the other type: a booking blocks the slot across all types.
  await page.goto("/book");
  await page.getByRole("link", { name: new RegExp(otherTypeName) }).click();
  await expect(page.getByRole("heading", { level: 1, name: otherTypeName })).toBeVisible();
  await pickTomorrow(page);
  const overlapping = page.getByRole("button", { name: /11:00 - 11:30/ });
  await expect(overlapping).toContainText("Занято");
  await expect(overlapping).toBeDisabled();
  await expect(page.getByRole("button", { name: /11:30 - 12:00/ })).toBeEnabled();
});
