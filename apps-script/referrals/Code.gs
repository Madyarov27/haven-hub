// Haven Tashkent referrals: saves {time, name, code} to the sheet, then sends the visitor to HQ signup.
// Bound to the "Referrals" Google Sheet (Extensions > Apps Script).

const SIGNUP_URL = 'https://haven.hackclub.com/tashkent'; // HQ's signup page for your city
const HEADERS = ['time', 'name', 'code'];

// Run once from the editor: writes the header row.
function setup() {
  const sheet = getSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

// Visitor opens <web app URL>?code=abc -> types their name -> row saved -> redirected to signup.
function doGet(e) {
  const code = clean(e.parameter.code);
  return HtmlService.createHtmlOutput(page(code))
    .setTitle('Haven Tashkent')
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
  name = clean(name);
  code = clean(code);
  if (!name) return { ok: false, error: 'name is required' };
  getSheet().appendRow([new Date(), name, code]);
  return { ok: true, url: SIGNUP_URL };
}

// Run from the editor after testing: removes every row whose code is TEST.
function deleteTestRows() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][2] === 'TEST') sheet.deleteRow(i + 1);
  }
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// Trim, cap length, and stop the sheet from treating input as a formula.
function clean(value) {
  const text = String(value || '').trim().slice(0, 100);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function page(code) {
  const codeJson = JSON.stringify(code).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:360px;margin:15vh auto;padding:0 16px">
  <h2>Haven Tashkent</h2>
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
