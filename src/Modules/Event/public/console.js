/* eslint-env browser */
/**
 * Organiser console behaviour.
 *
 * Served as a file rather than inlined in the page: Helmet's default policy is
 * `script-src 'self'`, with no 'unsafe-inline', so an inline <script> is blocked outright.
 */
(function () {
  var STORAGE_KEY = "gate.console.token";
  var form = document.getElementById("token-form");
  var tokenInput = document.getElementById("token");
  var statusEl = document.getElementById("status");
  var table = document.getElementById("events");
  var tbody = table.querySelector("tbody");

  // Convenience only, and scoped to this browser: the token is never sent anywhere but this API.
  // Wrapped because storage throws outright in some privacy modes.
  try {
    var saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) tokenInput.value = saved;
  } catch (e) {
    /* storage unavailable — the field just starts empty */
  }

  // Stock figures come from Inventory and are null when it cannot be read. Rendering that as a
  // dash matters: showing 0 would read as sold out.
  function text(value) {
    return value === null || value === undefined || value === "" ? "\u2014" : String(value);
  }

  function render(events) {
    tbody.textContent = "";
    events.forEach(function (event) {
      var row = tbody.insertRow();
      [
        [text(event.name), false],
        [text(event.status), false],
        [event.startsAt ? new Date(event.startsAt).toLocaleString() : "\u2014", false],
        [text(event.capacity), true],
        [text(event.reserved), true],
        [text(event.sold), true],
        [text(event.remaining), true],
      ].forEach(function (pair) {
        var cell = row.insertCell();
        // textContent, not innerHTML: event names are organiser-supplied.
        cell.textContent = pair[0];
        if (pair[1]) cell.className = "num";
      });
    });
    table.hidden = events.length === 0;
    statusEl.textContent = events.length === 0 ? "No events yet." : events.length + " event(s).";
  }

  form.addEventListener("submit", function (submitEvent) {
    submitEvent.preventDefault();
    var token = tokenInput.value.trim();
    statusEl.textContent = "Loading\u2026";
    table.hidden = true;

    fetch("/v1/console/events", { headers: { Authorization: "Bearer " + token } })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(body && body.message ? body.message : "Request failed (" + response.status + ")");
          }
          return body;
        });
      })
      .then(function (body) {
        try {
          window.localStorage.setItem(STORAGE_KEY, token);
        } catch (e) {
          /* storage unavailable — nothing to persist */
        }
        render(body.data || []);
      })
      .catch(function (error) {
        statusEl.textContent = error.message;
      });
  });
})();
