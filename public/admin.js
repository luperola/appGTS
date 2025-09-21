let TOKEN = null;
const $ = (id) => document.getElementById(id);

function ymdToDmy(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}
function setTodayMaxDate(inputId) {
  const el = $(inputId);
  if (!el) return;
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  el.max = `${yyyy}-${mm}-${dd}`;
}

function currentFiltersPayload() {
  return {
    macchina: $("f-macchina").value.trim() || undefined,
    linea: $("f-linea").value.trim() || undefined,
    operator: $("f-operator").value.trim() || undefined,
    descrContains: $("f-descr").value.trim() || undefined,
    dataFrom: ymdToDmy($("f-from").value.trim()) || undefined,
    dataTo: ymdToDmy($("f-to").value.trim()) || undefined,
  };
}

async function search() {
  const payload = currentFiltersPayload();
  const res = await fetch("/api/entries/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const out = await res.json();
  if (!res.ok) {
    $("loginMsg").textContent = out.error || "Errore";
    return;
  }
  const tbody = document.querySelector("#tbl tbody");
  tbody.innerHTML = "";
  for (const e of out.entries) {
    const tr = document.createElement("tr");
    tr.dataset.id = e.id; // serve per cancellazione singola
    tr.innerHTML = `
      <td>${e.operator}</td>
      <td>${e.macchina}</td>
      <td>${e.linea}</td>
      <td>${Number(e.ore).toFixed(2)}</td>
      <td>${e.data}</td>
      <td>${e.descrizione}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger btn-del" data-id="${
          e.id
        }" title="Elimina riga">Elimina</button>
      </td>`;
    tbody.appendChild(tr);
  }
  window.__lastEntries = out.entries;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearFilters() {
  ["f-macchina", "f-linea", "f-operator", "f-descr", "f-from", "f-to"].forEach(
    (id) => {
      const el = $(id);
      if (el) el.value = "";
    }
  );
}
$("btnReset").addEventListener("click", () => {
  clearFilters();
  search();
});

document.addEventListener("DOMContentLoaded", () => {
  setTodayMaxDate("f-from");
  setTodayMaxDate("f-to");

  document
    .getElementById("loginForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("user").value;
      const password = document.getElementById("pass").value;

      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        alert("Credenziali errate");
        return;
      }
      localStorage.setItem("adminKey", "admin"); // token minimale
      alert("Login OK");
    });

  $("filterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    search();
  });

  $("btnCsv").addEventListener("click", async () => {
    const entries = window.__lastEntries || [];
    const res = await fetch("/api/export/csv", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + TOKEN,
      },
      body: JSON.stringify({ entries }),
    });
    const blob = await res.blob();
    downloadBlob(blob, "report.csv");
  });

  $("btnXlsx").addEventListener("click", async () => {
    const entries = window.__lastEntries || [];
    const res = await fetch("/api/export/xlsx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + TOKEN,
      },
      body: JSON.stringify({ entries }),
    });
    const blob = await res.blob();
    downloadBlob(blob, "report.xlsx");
  });

  $("btnDeleteFiltered").addEventListener("click", async () => {
    if (!TOKEN) return;
    const ok = window.confirm(
      "Confermi l'eliminazione di TUTTI i record attualmente filtrati?"
    );
    if (!ok) return;
    const filters = currentFiltersPayload();
    const res = await fetch("/api/entries/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + TOKEN,
      },
      body: JSON.stringify(filters),
    });
    const out = await res.json();
    if (res.ok) {
      $("loginMsg").textContent = `Eliminati ${out.deleted} record.`;
      search();
    } else {
      $("loginMsg").textContent = out.error || "Errore eliminazione";
    }
  });

  $("btnDeleteAll").addEventListener("click", async () => {
    if (!TOKEN) return;
    const ok = window.confirm(
      "ATTENZIONE: questa azione eliminerà TUTTE le presenze. Confermi?"
    );
    if (!ok) return;
    const res = await fetch("/api/entries/all", {
      method: "DELETE",
      headers: { Authorization: "Bearer " + TOKEN },
    });
    const out = await res.json();
    if (res.ok) {
      $("loginMsg").textContent = `Eliminati ${out.deleted} record (tutti).`;
      search();
    } else {
      $("loginMsg").textContent = out.error || "Errore eliminazione";
    }
  });

  // === NUOVO: delega per eliminazione singola riga ===
  document.querySelector("#tbl tbody").addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".btn-del");
    if (!btn) return;
    if (!TOKEN) return;

    const id = btn.dataset.id;
    const ok = window.confirm("Eliminare questa riga?");
    if (!ok) return;

    const res = await fetch(`/api/entries/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + TOKEN },
    });
    const out = await res.json();
    if (res.ok) {
      // rimuovo la riga dal DOM senza ricaricare tutta la tabella
      const tr = btn.closest("tr");
      if (tr) tr.remove();
      $("loginMsg").textContent = "Riga eliminata.";
    } else {
      $("loginMsg").textContent = out.error || "Errore eliminazione riga";
    }
  });
});
