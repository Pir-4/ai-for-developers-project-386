// Тонкие обёртки над fetch — в точности повторяют контракт docs/api.md.
// Вся конвертация «локальное время браузера <-> UTC ISO 8601» живёт только здесь,
// остальной фронтенд и бэкенд оперируют ISO-строками из контракта.

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // FastAPI кладёт текст ошибки в поле detail
    throw new Error(body.detail ?? `HTTP ${response.status}`);
  }
  return body;
}

function post(path, payload) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const api = {
  // date — строка YYYY-MM-DD из <input type="date">
  getSlots: (date) => request(`/api/slots?date=${date}`),

  // startLocal — строка из <input type="datetime-local"> (локальное время, без зоны)
  createSlot: (startLocal) => post("/api/slots", { start: new Date(startLocal).toISOString() }),

  createBooking: (slotId, name, comment) =>
    post("/api/bookings", { slot_id: slotId, name, comment }),

  getBookings: () => request("/api/bookings"),
};

// ISO UTC -> человекочитаемое локальное время для отображения
export function formatTime(isoUtc) {
  return new Date(isoUtc).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
