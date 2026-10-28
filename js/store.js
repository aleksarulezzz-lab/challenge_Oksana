// Хранилище участницы. Сейчас всё лежит в localStorage этого браузера.
// Когда появится сервер и бот, отметки (mark/setMark) нужно будет синхронизировать
// с общим API, а цель и заметки по ТЗ остаются в браузере.
const KEY = 'challenge21:v1';

const empty = () => ({ marks: {}, goal: { goal: '', why: '', reward: '', steps: '' }, mapGoal: false });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* приватный режим: работаем в памяти */ }
}

// Изменения из другой вкладки.
window.addEventListener('storage', (e) => { if (e.key === KEY) state = load(); });

export const store = {
  get: () => state,
  update(patch) { state = { ...state, ...patch }; save(); },
  mark(day) {
    const m = state.marks[day] || {};
    return { t: [null, null], step: false, stepText: '', note: '', link: ['', ''], ...m, at: m.at };
  },
  setMark(day, m) { state.marks[day] = { ...m, at: Date.now() }; save(); },
  goal: () => ({ ...empty().goal, ...state.goal }),
  setGoal(g) { state.goal = g; save(); },
  wipe() { try { localStorage.removeItem(KEY); } catch { /* ничего */ } state = empty(); },
};
