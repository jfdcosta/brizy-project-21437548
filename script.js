document.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; }, { passive: true });
document.addEventListener('keydown', () => { document.documentElement.dataset.input = 'keyboard'; });
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');
function closeMenu() { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
const params = new URLSearchParams(location.search);
const allowedFilters = ['all', 'birthday', 'wedding', 'little'];
function setFilter(value, updateURL = false) {
  const filter = allowedFilters.includes(value) ? value : 'all';
  document.querySelectorAll('[data-filter]').forEach(button => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  let count = 0;
  document.querySelectorAll('[data-category]').forEach(card => {
    card.hidden = filter !== 'all' && card.dataset.category !== filter;
    if (!card.hidden) count++;
  });
  document.querySelector('#filter-status').textContent = `${count} cakes shown.`;
  if (updateURL) {
    const url = new URL(location.href);
    if (filter === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', filter);
    history.replaceState(null, '', url);
  }
}
setFilter(params.get('category'));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter, true)));
const form = document.querySelector('#enquiry-form');
const dialog = document.querySelector('#cake-dialog');
let selectedDesign = '';
let trigger = null;
document.querySelectorAll('[data-cake]').forEach(button => button.addEventListener('click', () => {
  trigger = button;
  selectedDesign = button.dataset.title;
  const image = document.querySelector('#cake-dialog-image');
  image.src = button.dataset.image;
  image.alt = button.dataset.description;
  const thumbnail = button.querySelector('img');
  image.width = thumbnail.width;
  image.height = thumbnail.height;
  document.querySelector('#cake-dialog-title').textContent = selectedDesign;
  document.querySelector('#cake-dialog-description').textContent = button.dataset.description;
  document.querySelector('#cake-dialog-caption').textContent = button.dataset.caption;
  document.querySelector('#cake-dialog-source').href = button.dataset.source;
  dialog.showModal();
}));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (trigger) trigger.focus({ preventScroll: true }); });
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
document.querySelector('#use-design').addEventListener('click', () => {
  dialog.close();
  const idea = form.elements.idea;
  const inspiration = `I like the “${selectedDesign}” cake from your Instagram portfolio.`;
  idea.value = idea.value ? idea.value + '\n' + inspiration : inspiration;
  document.querySelector('#enquire').scrollIntoView({ behavior: 'instant' });
  idea.focus({ preventScroll: true });
});
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
form.elements.date.min = localDate;
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(data.get('date') + 'T12:00:00'));
  document.querySelector('#draft-text').value = `Hi Nisha! My name is ${data.get('name')}.\n\nI’d like to ask about a cake for ${data.get('occasion').toLowerCase()} on ${date}, for approximately ${data.get('guests')} guests.\n\n${data.get('idea') || 'I’m still gathering design ideas.'}\n\nCould you let me know your availability, options, pricing, and collection details? Thank you!`;
  document.querySelector('#draft-panel').hidden = false;
  document.querySelector('#copy-status').textContent = 'Your draft is ready. No enquiry has been sent.';
});
document.querySelector('#copy-draft').addEventListener('click', async () => {
  const text = document.querySelector('#draft-text');
  try {
    await navigator.clipboard.writeText(text.value);
    document.querySelector('#copy-status').textContent = 'Copied. You can paste this into your message to Nisha.';
  } catch {
    text.focus(); text.select();
    document.querySelector('#copy-status').textContent = 'Select and copy the draft using your device’s copy command.';
  }
});
document.querySelectorAll('video').forEach(video => video.addEventListener('play', () => {
  document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
}));
