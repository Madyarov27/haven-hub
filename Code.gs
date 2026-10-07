// Haven referrals: saves {time, name, code} to the sheet, then sends the visitor to HQ signup with ?ref=<code>.
// Bound to the "Referrals" Google Sheet (Extensions > Apps Script).
//
// Deploy: Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
// Share the Sheet with organizers only.
//
// doPost and save are open: anyone can add rows. Fine for v1, rows are confirmed at check-in.

const SIGNUP_URL = 'https://haven.hackclub.com/tashkent'; // HQ's signup page for your city
const EVENT_NAME = 'Haven Tashkent';
const HEADERS = ['time', 'name', 'code'];
// Ambassadors' codes, in capitals, e.g. ['DILNURA', 'AZIZ']. A code that is not listed is saved as blank.
// Empty list = every code is saved as it came.
const CODES = [];

// Functions ending in _ cannot be called by visitors through google.script.run.

// Run once from the editor: writes the header row. Does nothing once the sheet has rows.
function setup() {
  const sheet = sheet_();
  if (sheet.getLastRow() > 1) return;
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

// The referral page (index.html on GitHub Pages) posts here; this form is the fallback.
// Visitor opens <web app URL>?code=abc -> types their name -> row saved -> redirected to signup.
function doGet(e) {
  const code = cleanCode_(e.parameter.code);
  return HtmlService.createHtmlOutput(page_(code))
    .setTitle(EVENT_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// For a custom referral page: POST name=...&code=... (form-encoded), then redirect yourself.
function doPost(e) {
  const result = save(e.parameter.name, e.parameter.code);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Called by the form (google.script.run) and by doPost.
function save(name, code) {
  name = clean_(name);
  code = cleanCode_(code);
  if (CODES.length && CODES.indexOf(code) < 0) code = ''; // unknown code: still works, saved as blank
  if (!name) return { ok: false, error: 'name is required' };
  sheet_().appendRow([new Date(), name, code]);
  return { ok: true, url: code ? SIGNUP_URL + '?ref=' + encodeURIComponent(code) : SIGNUP_URL };
}

// Run from the editor after testing: removes every row whose name starts with TEST.
function deleteTestRows() {
  const sheet = sheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (/^TEST/.test(String(values[i][1]))) sheet.deleteRow(i + 1);
  }
}

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// Trim, cap length, and stop the sheet from treating input as a formula.
function clean_(value) {
  const text = String(value || '').trim().slice(0, 100);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// Codes go into the sheet and into the signup link: capitals, digits, _ and - only.
function cleanCode_(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').replace(/^-+/, '').slice(0, 32).toUpperCase();
}

function page_(code) {
  const codeJson = JSON.stringify(code).replace(/</g, '\\u003c');
  const eventHtml = EVENT_NAME.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:360px;margin:15vh auto;padding:0 16px">
  <h2>${eventHtml}</h2>
  <form id="form">
    <input id="name" placeholder="Your name" required maxlength="100" autofocus
           style="width:100%;box-sizing:border-box;padding:12px;font-size:16px">
    <button id="button" style="width:100%;margin-top:12px;padding:12px;font-size:16px">Sign up</button>
  </form>
  <p id="message"></p>
  <script>
    const code = ${codeJson};
    const form = document.getElementById('form');
    const button = document.getElementById('button');
    const message = document.getElementById('message');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      button.disabled = true;
      message.textContent = 'Saving...';
      google.script.run
        .withSuccessHandler(function (result) {
          if (!result.ok) return fail(result.error);
          // Fallback link in case the browser blocks the automatic redirect.
          message.innerHTML = 'Saved! <a target="_top" id="go">Continue to signup</a>';
          document.getElementById('go').href = result.url;
          window.top.location.href = result.url;
        })
        .withFailureHandler(function (error) { fail(error.message); })
        .save(document.getElementById('name').value, code);
    });

    function fail(text) {
      button.disabled = false;
      message.textContent = 'Could not save: ' + text;
    }
  </script>
</body>
</html>`;
}
