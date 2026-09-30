// Haven Hub — site settings. Nothing here is secret.
window.HUB_CONFIG = {
  // Running your own copy of the website for ONE hub? Put that hub's deployment ID (AKfy…) here,
  // so links work without ?hub=. Leave empty on the shared site.
  defaultHub: '',
  // Maintainers: the "Make a copy" link of the public template Sheet (…/spreadsheets/d/<id>/copy).
  templateSheet: '',
  repo: 'https://github.com/notazizelse/haven-hub',
  // Hubs that run on their own server (server/ in this repo), by short name → their API address.
  // Links then look like https://notazizelse.github.io/haven-hub/?hub=tashkent&u=…&t=…
  hubs: {},
  // The newest backend (Code.gs) version. Admins running an older one see an "update available" banner.
  latestBackend: '4.1.1',
};
