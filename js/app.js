import { CHALLENGE, WEEKS, BLOCKS, DAYS } from './data.js';
import { store } from './store.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const DAY_MS = 864e5;
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// ---------- Время ----------
// Всё считаем по Москве: задание дня N открывается в 06:00 МСК.
const startMs = Date.parse(`${CHALLENGE.startDate}T00:00:00+03:00`);
const openAt = (n) => startMs + (n - 1) * DAY_MS + CHALLENGE.openHourMsk * 36e5;
const deadlineMs = Date.parse(CHALLENGE.deadline);
const mskDate = (n) => new Date(startMs + (n - 1) * DAY_MS + 12 * 36e5); // полдень МСК, без сдвигов
const dateLabel = (n) => { const d = mskDate(n); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const weekday = (n) => WEEKDAYS[mskDate(n).getUTCDay()];

const params = new URLSearchParams(location.search);
let demoNow = null;
if (params.has('date')) {
  const raw = params.get('date');
  const t = Date.parse(raw.includes('T') ? `${raw}+03:00` : `${raw}T12:00:00+03:00`);
  if (!Number.isNaN(t)) demoNow = t;
}
const now = () => demoNow ?? Date.now();
const currentDay = () => DAYS.filter((d) => openAt(d.day) <= now()).length;
const canMark = (n) => n <= currentDay() && now() <= deadlineMs;

// ---------- Состояние дня ----------
function dayInfo(n) {
  const m = store.mark(n);
  const done = m.t.filter((v) => v === 'done').length;
  const skipped = m.t.some((v) => v === 'skip');
  const cur = currentDay();
  let state;
  if (n > cur) state = 'locked';
  else if (done >= CHALLENGE.tasksToCountDay) state = 'done';
  else if (done > 0) state = 'partial';
  else if (n === cur && !skipped) state = 'today';
  else state = 'missed';
  return { state, done, counted: done >= CHALLENGE.tasksToCountDay, step: m.step, isToday: n === cur, needsReturn: ['partial', 'missed'].includes(state) && n < cur };
}

const STATE_LABEL = {
  locked: ['🔒', 'Закрыто'],
  today: ['●', 'Сегодня'],
  done: ['✓', 'Выполнено'],
  partial: ['½', 'Частично'],
  missed: ['–', 'Пропущено'],
};

function totals() {
  let counted = 0, tasks = 0, steps = 0, social = 0;
  const missed = [];
  for (const d of DAYS) {
    const i = dayInfo(d.day);
    if (i.counted) counted++;
    tasks += i.done;
    if (i.step) steps++;
    if (store.mark(d.day).t[2] === 'done') social++;
    if (['missed', 'partial'].includes(i.state) && !i.isToday) missed.push(d.day);
  }
  return { counted, tasks, steps, social, missed, streak: streak() };
}

// Серия: сколько засчитанных дней подряд, считая от сегодня (или вчера, если сегодня ещё не закрыт).
function streak() {
  let n = currentDay();
  if (n === 0) return 0;
  if (!dayInfo(n).counted) n--;
  let s = 0;
  while (n >= 1 && dayInfo(n).counted) { s++; n--; }
  return s;
}

// ---------- Отрисовка ----------
function renderStatic() {
  document.title = `${CHALLENGE.title} · 21 день с Оксаной Миковой`;
  $('[data-reward]').textContent = `Кто выполнит все задания 21 дня, получает в подарок месяц доступа к клубу «Мастерская души» (обычная цена ${CHALLENGE.rewardPrice}).`;
  $('[data-social-rule]').textContent = `Третье задание дня: поделиться результатом в соцсетях с хэштегом ${CHALLENGE.hashtag}.`;
  $('[data-weeks]').innerHTML = WEEKS.map((w) => `
    <article class="week">
      <span class="week__dot" aria-hidden="true"></span>
      <div class="week__n">0${w.n}</div>
      <h3>${w.name}</h3>
      <p><b>${w.dates}.</b> ${w.text}</p>
    </article>`).join('');
}

function renderHeader() {
  const cur = currentDay();
  const t = now();
  let text;
  if (cur === 0) {
    const days = Math.ceil((openAt(1) - t) / DAY_MS);
    text = `Старт 3 ноября${days > 0 ? ` · через ${days} ${plural(days, 'день', 'дня', 'дней')}` : ''}`;
  } else if (t > openAt(21) + DAY_MS - CHALLENGE.openHourMsk * 36e5) {
    text = 'Челлендж завершён. Окна остаются открытыми.';
  } else {
    text = `Сейчас идёт день ${cur} из 21`;
  }
  $('[data-countdown]').textContent = text;
  const badge = $('[data-today-badge]');
  badge.textContent = cur === 0 ? 'Первое задание откроется 3 ноября в 06:00 МСК' : cur <= 21 && t < openAt(21) + DAY_MS ? `Сегодня: день ${cur}` : 'Все 21 задание открыты';
}

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function renderGrid() {
  const grid = $('[data-grid]');
  grid.innerHTML = WEEKS.map((w) => {
    const days = DAYS.slice((w.n - 1) * 7, w.n * 7);
    // Неделя закончилась в полночь МСК после её последнего дня.
    const over = now() >= startMs + w.n * 7 * DAY_MS;
    return `<div class="grid__week">
      <h3>Неделя ${w.n} · ${w.name} <small>${w.dates}</small></h3>
      <div class="grid__row">${days.map(card).join('')}</div>
      ${over ? `<aside class="week-done"><b>${w.n === 3 ? 'Вы прошли весь путь' : `Неделя ${w.n} позади`}</b><p>${w.done}</p></aside>` : ''}
    </div>`;
  }).join('');
}

function card(d) {
  const i = dayInfo(d.day);
  const [icon, label] = STATE_LABEL[i.state];
  const locked = i.state === 'locked';
  const opens = locked ? `Откроется ${dateLabel(d.day)}` : label;
  return `<button class="win${i.isToday ? ' is-today' : ''}${i.needsReturn ? ' needs-return' : ''}" data-state="${i.state}" data-day="${d.day}"
      ${locked ? 'aria-disabled="true"' : ''}
      aria-label="День ${d.day}, ${dateLabel(d.day)}. ${locked ? opens : `${d.theme}. ${label}`}">
    ${d.anchor ? '<span class="win__star" title="Якорный день">★</span>' : ''}
    ${i.needsReturn ? '<span class="win__return">Нужно вернуться</span>' : ''}
    <span class="win__num">${d.day}</span>
    <span class="win__date">${weekday(d.day)}, ${dateLabel(d.day)}</span>
    <span class="win__theme">${locked ? 'Ещё закрыто' : d.theme}</span>
    <span class="win__foot">
      <span class="win__block">${BLOCKS[d.block].name}${streamOf(d.day) ? ' · эфир' : ''}</span>
      <span class="win__state"><span aria-hidden="true">${icon}</span>${locked ? '' : label}</span>
    </span>
  </button>`;
}

function renderProgress() {
  const { counted, tasks, steps, social, missed, streak: series } = totals();
  $('[data-counted]').textContent = counted;
  $('[data-stat-tasks]').textContent = tasks;
  $('[data-stat-steps]').textContent = steps;
  $('[data-stat-social]').textContent = social;
  $('[data-stat-streak]').textContent = series;
  $('[data-stat-streak-label]').textContent = `${plural(series, 'день', 'дня', 'дней')} подряд`;
  $('[data-ring]').style.strokeDashoffset = String(326.7 * (1 - counted / 21));

  // Маршрут-бегунок: волнистая тропа из 21 точки, как на сайте Оксаны.
  const W = 1000, H = 72;
  const pt = (i) => { const x = 10 + (i / 20) * (W - 20); return [x, H / 2 + Math.sin((x / W) * Math.PI * 3) * 20]; };
  const pts = DAYS.map((_, i) => pt(i));
  let path = '';
  for (let x = 10; x <= W - 10; x += 5) path += `${path ? 'L' : 'M'}${x},${(H / 2 + Math.sin((x / W) * Math.PI * 3) * 20).toFixed(1)}`;
  const doneX = counted ? pt(counted - 1)[0] : 10;
  let donePath = '';
  for (let x = 10; x <= doneX; x += 5) donePath += `${donePath ? 'L' : 'M'}${x},${(H / 2 + Math.sin((x / W) * Math.PI * 3) * 20).toFixed(1)}`;
  const cur = currentDay();
  const markerIdx = Math.max(0, Math.min(20, (cur || 1) - 1));
  const [mx, my] = pts[markerIdx];
  $('[data-route]').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path class="route__path" d="${path}" vector-effect="non-scaling-stroke"/>
      ${counted ? `<path class="route__done" d="${donePath}" vector-effect="non-scaling-stroke"/>` : ''}
    </svg>
    ${pts.map(([x, y], i) => {
      const n = i + 1, s = dayInfo(n).state;
      return `<button class="route__dot" data-state="${s}" data-day="${n}" style="left:${x / 10}%;top:${y}px"
        aria-label="День ${n}: ${STATE_LABEL[s][1]}" ${s === 'locked' ? 'tabindex="-1"' : ''}></button>`;
    }).join('')}
    <span class="route__marker" style="left:${mx / 10}%;top:${my}px">${cur ? 'вы здесь' : 'старт'}</span>
  `;

  const tails = $('[data-tails]');
  if (missed.length) {
    tails.innerHTML = `<p>Пропущенные дни можно выполнить до 24 ноября:</p>${missed.map((n) => `<button class="tail" data-day="${n}">День ${n} · ${dateLabel(n)}</button>`).join('')}`;
  } else {
    tails.innerHTML = `<p>${cur === 0 ? 'Здесь появятся пропущенные дни, если они будут.' : 'Пропущенных дней нет. Вы идёте ровно.'}</p>`;
  }

  const banner = $('[data-reward-banner]');
  banner.hidden = counted < 21;
  if (counted >= 21) {
    banner.innerHTML = `<b>Все 21 день пройдены!</b>
      <p>Ваш подарок: месяц доступа к клубу «Мастерская души». Чтобы его получить, соберите карту 21 дня и отправьте её Оксане в Telegram.</p>
      <a class="pill pill--dark" href="${CHALLENGE.contactUrl}" target="_blank" rel="noopener">Написать Оксане</a>`;
  }
}

function renderAll() {
  renderHeader();
  renderGrid();
  renderProgress();
  if (dialog.open && openDay) renderDay(openDay);
}

// ---------- Окно дня ----------
const dialog = $('[data-dialog]');
let openDay = null;

function openDialog(n) {
  openDay = n;
  renderDay(n);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  history.replaceState(null, '', `#day-${n}`);
}

dialog.addEventListener('close', () => {
  openDay = null;
  if (location.hash.startsWith('#day-')) history.replaceState(null, '', location.pathname + location.search);
});
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

function renderDay(n) {
  const d = DAYS[n - 1];
  const i = dayInfo(n);
  const body = $('[data-day-body]');
  if (i.state === 'locked') {
    body.innerHTML = `<div class="day__locked">
      <p class="kicker">День ${n} · ${weekday(n)}, ${dateLabel(n)}</p>
      <p class="display" aria-hidden="true">🔒</p>
      <h2 id="day-title">Это задание ещё закрыто</h2>
      <p class="note">Оно откроется ${dateLabel(n)} в 0${CHALLENGE.openHourMsk}:00 по Москве. А пока можно выполнить открытые дни.</p>
    </div>`;
    return;
  }
  const m = store.mark(n);
  const editable = canMark(n);
  const tasks = allTasks(d).map((t, k) => `
    <div class="task">
      <div class="task__head"><span class="task__n">Задание ${k + 1}</span>${t.time ? `<span class="task__time">${t.time}</span>` : ''}</div>
      <p class="task__text">${t.text}</p>
      ${t.goal ? '<p class="note"><a href="#goal" data-close>Записать цель и шаги →</a></p>' : ''}
      <div class="marks" role="group" aria-label="Отметка к заданию ${k + 1}">
        <button class="mark" data-v="done" data-task="${k}" aria-pressed="${m.t[k] === 'done'}" ${editable ? '' : 'disabled'}>✓ Сделала</button>
        <button class="mark" data-v="skip" data-task="${k}" aria-pressed="${m.t[k] === 'skip'}" ${editable ? '' : 'disabled'}>Пропускаю</button>
      </div>
      ${t.social ? `<div class="social">
        <p>Заготовка текста, её можно поменять:</p>
        <p><i>${t.social}</i></p>
        <div class="social__row">
          <button class="pill pill--ghost" type="button" data-copy="${encodeURIComponent(t.social)}">Скопировать</button>
        </div>
        <label class="field" style="margin-top:.75rem">Ссылка на публикацию (по желанию)
          <input type="url" data-link="${k}" value="${escapeAttr(m.link[k] || '')}" placeholder="https://">
        </label>
      </div>` : ''}
    </div>`).join('');

  body.innerHTML = `
    <div class="day__meta">
      <span class="tag tag--accent">День ${n}</span>
      <span class="tag">${weekday(n)}, ${dateLabel(n)}</span>
      <span class="tag">${BLOCKS[d.block].name}</span>
      ${d.anchor ? '<span class="tag">★ якорный</span>' : ''}
    </div>
    <h2 id="day-title">${d.theme}</h2>
    <p class="day__hint">Правильных ответов нет. Вы делаете это для себя.${d.note ? ` ${d.note}` : ''}</p>
    ${d.link ? `<a class="tool-link" href="${d.link.href}" target="_blank" rel="noopener">${d.link.label} ↗</a>` : ''}
    ${tasks}
    <div class="step">
      <label class="field">Мой личный шаг сегодня
        <input type="text" data-step-text value="${escapeAttr(m.stepText)}" placeholder="${escapeAttr(stepHint(n))}">
      </label>
      <label class="check" style="margin:0"><input type="checkbox" data-step ${m.step ? 'checked' : ''}> Сделала свой шаг</label>
      <label class="field">Заметки для себя (видны только вам)
        <textarea rows="3" data-note>${escapeHtml(m.note)}</textarea>
      </label>
    </div>
    <p class="note" style="margin-top:1rem">${editable
      ? (n < currentDay() ? 'Вы возвращаетесь к прошедшему дню, и это нормально. ' : '') + 'Отметки можно менять до 24 ноября, 23:59 МСК.'
      : 'Время для отметок закончилось 24 ноября. Окно остаётся открытым для чтения.'}</p>
    <div class="day__nav">
      <button class="pill pill--ghost" type="button" data-goto="${n - 1}" ${n === 1 ? 'hidden' : ''}>← День ${n - 1}</button>
      <button class="pill pill--ghost" type="button" data-goto="${n + 1}" ${n === 21 || n + 1 > currentDay() ? 'hidden' : ''}>День ${n + 1} →</button>
    </div>`;
}

function stepHint(n) {
  const steps = store.goal().steps.split('\n').map((s) => s.trim()).filter(Boolean);
  return steps[n - 1] || 'Что я сделаю сегодня для своей цели';
}

// Третье задание каждого дня: отчёт в соцсетях с хэштегом челленджа.
function allTasks(d) {
  return [...d.tasks, {
    text: `Поделитесь в соцсетях, что сделали сегодня и что заметили. Добавьте хэштег ${CHALLENGE.hashtag}.`,
    time: '3 мин',
    social: `День ${d.day} челленджа «${CHALLENGE.title}» с Оксаной Миковой. Тема дня: «${d.theme}». Сегодня я ___. ${CHALLENGE.hashtag}`,
  }];
}

const streamOf = (n) => CHALLENGE.streams.find((s) => s.day === n);

const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

dialog.addEventListener('click', async (e) => {
  const mark = e.target.closest('.mark');
  if (mark && !mark.disabled) {
    const k = Number(mark.dataset.task);
    const v = mark.dataset.v;
    const m = store.mark(openDay);
    const wasCounted = dayInfo(openDay).counted;
    const seriesBefore = streak();
    m.t[k] = m.t[k] === v ? null : v;
    store.setMark(openDay, m);
    renderAll();
    const seriesAfter = streak();
    if (seriesAfter > seriesBefore && seriesAfter >= 5 && seriesAfter % 5 === 0) toast(`${seriesAfter} дней подряд! Вот это характер.`);
    else if (!wasCounted && dayInfo(openDay).counted) toast(`День ${openDay} засчитан. Так держать!`);
    else if (v === 'skip' && m.t[k] === 'skip') toast('Пропуск не наказывается. К заданию можно вернуться до 24 ноября.');
    return;
  }
  const go = e.target.closest('[data-goto]');
  if (go) { openDialog(Number(go.dataset.goto)); return; }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const text = decodeURIComponent(copy.dataset.copy);
    try { await navigator.clipboard.writeText(text); toast('Текст скопирован'); }
    catch { toast('Не получилось скопировать, выделите текст вручную'); }
    return;
  }
  if (e.target.closest('[data-close]')) dialog.close();
});

dialog.addEventListener('input', (e) => {
  if (!openDay) return;
  const m = store.mark(openDay);
  if (e.target.matches('[data-step-text]')) m.stepText = e.target.value;
  else if (e.target.matches('[data-note]')) m.note = e.target.value;
  else if (e.target.matches('[data-link]')) m.link[Number(e.target.dataset.link)] = e.target.value;
  else return;
  store.setMark(openDay, m);
});
dialog.addEventListener('change', (e) => {
  if (!e.target.matches('[data-step]')) return;
  const m = store.mark(openDay);
  m.step = e.target.checked;
  store.setMark(openDay, m);
  renderGrid();
  renderProgress();
  if (m.step) toast('Личный шаг отмечен');
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('.win, .route__dot, .tail');
  if (!el || dialog.contains(el)) return;
  const n = Number(el.dataset.day);
  if (dayInfo(n).state === 'locked') { toast(`Окно дня ${n} откроется ${dateLabel(n)}`); return; }
  openDialog(n);
});

// ---------- Цель ----------
function initGoal() {
  const form = $('[data-goal-form]');
  const g = store.goal();
  for (const k of ['goal', 'why', 'reward', 'steps']) form.elements[k].value = g[k] || '';
  let timer;
  form.addEventListener('input', () => {
    const data = Object.fromEntries(['goal', 'why', 'reward', 'steps'].map((k) => [k, form.elements[k].value]));
    data.steps = data.steps.split('\n').slice(0, 21).join('\n');
    store.setGoal(data);
    clearTimeout(timer);
    $('[data-saved]').textContent = 'Сохранено в вашем браузере';
    timer = setTimeout(() => { $('[data-saved]').textContent = ''; }, 2000);
  });
  $('[data-download-goal]').addEventListener('click', () => {
    const v = store.goal();
    const steps = v.steps.split('\n').filter((s) => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n');
    const text = `${CHALLENGE.title}. Моя цель на 21 день\n\nЦель: ${v.goal}\n\nПочему это важно: ${v.why}\n\nМоя награда: ${v.reward}\n\nШаги:\n${steps}\n`;
    download(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'moya-cel-21-den.txt');
  });
}

// Напоминание: участница сама добавляет его в календарь телефона, сайт ничего не сохраняет.
function reminderIcs() {
  const pad = (n) => String(n).padStart(2, '0');
  const utc = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; };
  const first = startMs + CHALLENGE.reminderHourMsk * 36e5;
  const until = startMs + 21 * DAY_MS + CHALLENGE.reminderHourMsk * 36e5; // включая 24 ноября: последний шанс нагнать
  const url = location.origin + location.pathname;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mikova//challenge21//RU', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:challenge21-reminder@${location.hostname || 'local'}`,
    `DTSTAMP:${utc(Date.now())}`,
    `DTSTART:${utc(first)}`,
    `DTEND:${utc(first + 15 * 60e3)}`,
    `RRULE:FREQ=DAILY;UNTIL=${utc(until)}`,
    `SUMMARY:${CHALLENGE.title}: проверьте задания дня`,
    `DESCRIPTION:Выполнены ли все три задания? Пропущенные дни можно нагнать до 24 ноября. ${url}`,
    `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${CHALLENGE.title}: проверьте задания дня`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

function renderStreams() {
  $('[data-streams]').innerHTML = CHALLENGE.streams.map((s, i) => `
    <article class="stream">
      <span class="stream__date">${dateLabel(s.day)}, ${weekday(s.day) === 'вс' ? 'воскресенье' : weekday(s.day)}</span>
      <h3>Эфир ${i + 1}. ${s.title}</h3>
      <p>${s.text}</p>
      <span class="stream__time">Вечером, 20–30 минут</span>
    </article>`).join('');
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Итоговая карта 1080×1920 ----------
async function makeMap() {
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const x = c.getContext('2d');
  x.fillStyle = '#f3ebdb';
  x.fillRect(0, 0, 1080, 1920);
  // Топографические линии на фоне.
  x.strokeStyle = 'rgba(180,122,40,0.18)';
  x.lineWidth = 2;
  for (let k = 0; k < 16; k++) {
    x.beginPath();
    for (let a = 0; a <= 360; a += 4) {
      const r = 120 + k * 46 + Math.sin(a * Math.PI / 45 + k) * 14;
      const px = 860 + Math.cos(a * Math.PI / 180) * r, py = 360 + Math.sin(a * Math.PI / 180) * r * 0.8;
      a ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  const { counted } = totals();
  x.fillStyle = '#1a1510';
  x.font = '700 56px "Bodoni Moda", serif';
  x.fillText('MIKOVA', 90, 160);
  x.fillStyle = '#925d10';
  x.font = '600 28px Inter, sans-serif';
  x.fillText('М О Я   К А Р Т А   2 1   Д Н Я', 90, 300);
  x.fillStyle = '#1a1510';
  x.font = '400 104px "Playfair Display", serif';
  wrapText(x, CHALLENGE.title, 90, 430, 900, 116);
  x.font = 'italic 400 48px "Playfair Display", serif';
  x.fillStyle = '#6a5a3c';
  x.fillText(CHALLENGE.subtitle, 90, 680);

  const size = 112, gap = 18, gx = (1080 - (size * 7 + gap * 6)) / 2, gy = 800;
  DAYS.forEach((d, i) => {
    const info = dayInfo(d.day);
    const px = gx + (i % 7) * (size + gap), py = gy + Math.floor(i / 7) * (size + gap + 10);
    const fill = { done: '#2f6238', partial: '#a9cbae', missed: '#ece2cc', today: '#925d10', locked: '#e1d7c2' }[info.state];
    roundRect(x, px, py, size, size, 20);
    x.fillStyle = fill; x.fill();
    x.strokeStyle = 'rgba(26,21,16,0.12)';
    x.lineWidth = 3; x.stroke();
    x.fillStyle = ['done', 'today'].includes(info.state) ? '#fff' : '#1a1510';
    x.font = '400 46px "Playfair Display", serif';
    x.textAlign = 'center';
    x.fillText(String(d.day), px + size / 2, py + size / 2 + 8);
    if (info.counted) { x.font = '600 26px Inter, sans-serif'; x.fillText('✓', px + size / 2, py + size - 14); }
    x.textAlign = 'left';
  });

  x.fillStyle = '#1a1510';
  x.font = '400 220px "Playfair Display", serif';
  x.fillText(String(counted), 90, 1440);
  const w = x.measureText(String(counted)).width;
  x.font = '400 56px "Playfair Display", serif';
  x.fillStyle = '#6a5a3c';
  x.fillText(`из 21 ${plural(counted, 'дня', 'дней', 'дней')} пройдено`, 110 + w, 1440);

  if ($('[data-map-goal]').checked && store.goal().goal.trim()) {
    x.fillStyle = '#925d10';
    x.font = '600 26px Inter, sans-serif';
    x.fillText('М О Я   Ц Е Л Ь', 90, 1540);
    x.fillStyle = '#1a1510';
    x.font = 'italic 400 44px "Playfair Display", serif';
    wrapText(x, store.goal().goal.trim(), 90, 1610, 900, 56, 3);
  }
  x.fillStyle = '#6a5a3c';
  x.font = '500 30px Inter, sans-serif';
  x.fillText('21 день с Оксаной Миковой · oksanamikova.com', 90, 1840);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function wrapText(x, text, px, py, maxW, lh, maxLines = 4) {
  const words = text.split(/\s+/);
  let line = '', lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (x.measureText(test).width > maxW && line) {
      x.fillText(line, px, py + lines * lh);
      line = word;
      if (++lines >= maxLines) return;
    } else line = test;
  }
  if (line) x.fillText(line, px, py + lines * lh);
}

function initMap() {
  const img = $('[data-map-img]'), dl = $('[data-map-download]'), share = $('[data-map-share]');
  const goalBox = $('[data-map-goal]');
  goalBox.checked = store.get().mapGoal;
  goalBox.addEventListener('change', () => store.update({ mapGoal: goalBox.checked }));
  let file;
  $('[data-map-make]').addEventListener('click', async () => {
    const blob = await makeMap();
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
    img.hidden = false;
    dl.href = img.src;
    dl.hidden = false;
    file = new File([blob], 'moya-karta-21-dnya.png', { type: 'image/png' });
    share.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  });
  share.addEventListener('click', () => {
    navigator.share({ files: [file], title: 'Моя карта 21 дня' }).catch(() => {});
  });
}

// ---------- Прочее ----------
let toastTimer;
function toast(text) {
  const t = $('[data-toast]');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

$('[data-wipe]').addEventListener('click', () => {
  if (!confirm('Удалить все отметки, цель и заметки из вашего браузера? Это нельзя отменить.')) return;
  store.wipe();
  location.reload();
});

function initDemo() {
  if (!params.has('demo')) return;
  const box = $('[data-demo]'), range = $('[data-demo-range]'), out = $('[data-demo-out]');
  box.hidden = false;
  const label = (v) => (v === 0 ? '2 ноября, до старта' : v === 22 ? '24 ноября, после финала' : `день ${v}, ${dateLabel(v)}`);
  const set = (v) => {
    demoNow = v === 0 ? openAt(1) - DAY_MS : v === 22 ? openAt(21) + DAY_MS : openAt(v) + 6 * 36e5;
    out.textContent = label(v);
    renderAll();
  };
  range.value = demoNow ? Math.max(0, Math.min(22, currentDay())) : 0;
  range.addEventListener('input', () => set(Number(range.value)));
  set(Number(range.value));
}

// Появление карточек при первом показе календаря.
function initReveal() {
  const seq = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); seq.unobserve(e.target); }
  }, { threshold: 0.12 });
  $$('.reveal-seq').forEach((el) => seq.observe(el));

  const grid = $('[data-grid]');
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    $$('.win', grid).forEach((w, i) => { w.style.animationDelay = `${i * 40}ms`; w.classList.add('reveal'); });
    obs.disconnect();
  }, { threshold: 0.1 }).observe(grid);
}

// ---------- Компас и скролл первого экрана ----------
async function initHero() {
  const hero = $('.hero');
  const intro = $('.hero__stage--intro'), partsStage = $('.hero__stage--parts');
  let compass = null;
  try {
    const { createCompass } = await import('./compass.js');
    compass = createCompass($('.hero__canvas'));
  } catch (err) {
    console.warn('3D-компас недоступен, показываем картинку', err);
    document.documentElement.classList.add('no-webgl');
  }
  const routeStage = $('.hero__stage--route');
  const fade = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
  const onScroll = () => {
    const r = hero.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    // 0–0.45: разлёт, 0.55–0.85: детали ложатся в маршрут из 21 точки.
    compass?.setProgress(fade(p, 0.05, 0.45), fade(p, 0.55, 0.85));
    intro.style.opacity = String(1 - fade(p, 0.02, 0.18));
    intro.style.visibility = p > 0.2 ? 'hidden' : 'visible';
    const o = Math.min(fade(p, 0.28, 0.4), 1 - fade(p, 0.5, 0.58));
    partsStage.style.opacity = String(o);
    partsStage.style.transform = `translateY(${(1 - o) * 20}px)`;
    const ro = fade(p, 0.78, 0.9);
    routeStage.style.opacity = String(ro);
    routeStage.style.transform = `translate(-50%, ${(1 - ro) * 20}px)`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
}

renderStatic();
renderStreams();
renderAll();
$('[data-reminder]').addEventListener('click', () => {
  download(new Blob([reminderIcs()], { type: 'text/calendar;charset=utf-8' }), 'napominanie-21-den.ics');
  toast('Откройте файл, и напоминание появится в календаре');
});
initGoal();
initMap();
initDemo();
initReveal();
initHero();

const m = location.hash.match(/^#day-(\d{1,2})$/);
if (m && +m[1] >= 1 && +m[1] <= 21) {
  $('#calendar').scrollIntoView();
  openDialog(+m[1]);
}
// Если вкладка висит открытой, новое задание должно появиться само в 06:00.
setInterval(() => { if (!params.has('demo') && !dialog.open) renderAll(); }, 60_000);
