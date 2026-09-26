// Логика интерфейса. Работает только через api.js — никаких fetch напрямую.
// Пока бэкенд не реализован (этап 3), вызовы API будут падать —
// ошибки показываются пользователю в #status, это ожидаемо.

import { api, formatTime } from "./api.js";

const statusEl = document.querySelector("#status");
const slotDateInput = document.querySelector("#slot-date");
const slotList = document.querySelector("#slot-list");
const bookingList = document.querySelector("#booking-list");
const publishForm = document.querySelector("#publish-form");
const bookingDialog = document.querySelector("#booking-dialog");
const bookingForm = document.querySelector("#booking-form");

/** Слот, на который сейчас записываемся (null — диалог закрыт). */
let currentSlot = null;

function showStatus(text, { isError = false } = {}) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function showError(error) {
  showStatus(error.message, { isError: true });
}

// --- Переключение вкладок ---

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === button));
    document.querySelector("#tab-guest").hidden = button.dataset.tab !== "guest";
    document.querySelector("#tab-owner").hidden = button.dataset.tab !== "owner";
    showStatus("");
  });
});

// --- Гость: слоты и запись ---

async function loadSlots() {
  showStatus("Загружаю слоты…");
  try {
    const { slots } = await api.getSlots(slotDateInput.value);
    renderSlots(slots);
    showStatus(slots.length === 0 ? "На эту дату свободных слотов нет" : "");
  } catch (error) {
    slotList.innerHTML = "";
    showError(error);
  }
}

function renderSlots(slots) {
  slotList.innerHTML = "";
  for (const slot of slots) {
    const li = document.createElement("li");
    const time = document.createElement("span");
    time.textContent = formatTime(slot.start);
    li.append(time);

    if (slot.available) {
      const button = document.createElement("button");
      button.textContent = "Записаться";
      button.addEventListener("click", () => openBookingDialog(slot));
      li.append(button);
    } else {
      li.classList.add("taken");
      li.append(document.createTextNode("занято"));
    }
    slotList.append(li);
  }
}

function openBookingDialog(slot) {
  currentSlot = slot;
  document.querySelector("#booking-slot-time").textContent = formatTime(slot.start);
  bookingForm.reset();
  bookingDialog.showModal();
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentSlot) return;
  const name = document.querySelector("#booking-name").value.trim();
  const comment = document.querySelector("#booking-comment").value.trim();
  try {
    await api.createBooking(currentSlot.id, name, comment);
    bookingDialog.close();
    showStatus(`Вы записаны на ${formatTime(currentSlot.start)}`);
    await loadSlots(); // слот стал занятым — обновляем список
  } catch (error) {
    showError(error);
  }
});

document.querySelector("#booking-cancel").addEventListener("click", () => bookingDialog.close());
slotDateInput.addEventListener("change", loadSlots);

// --- Владелец: публикация слотов и список встреч ---

publishForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const startLocal = document.querySelector("#publish-start").value;
  try {
    const slot = await api.createSlot(startLocal);
    showStatus(`Слот на ${formatTime(slot.start)} опубликован`);
    publishForm.reset();
  } catch (error) {
    showError(error);
  }
});

async function loadBookings() {
  try {
    const { bookings } = await api.getBookings();
    bookingList.innerHTML = "";
    for (const booking of bookings) {
      const li = document.createElement("li");
      const comment = booking.comment ? ` — ${booking.comment}` : "";
      li.textContent = `${formatTime(booking.start)}: ${booking.name}${comment}`;
      bookingList.append(li);
    }
    if (bookings.length === 0) {
      showStatus("Предстоящих встреч нет");
    }
  } catch (error) {
    showError(error);
  }
}

document.querySelector("#refresh-bookings").addEventListener("click", loadBookings);

// --- Инициализация ---

slotDateInput.value = new Date().toISOString().slice(0, 10); // сегодня (UTC)
await loadSlots();
await loadBookings();
