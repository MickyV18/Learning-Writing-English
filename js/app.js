/* ============================================================
   English Writing Trainer — app logic (v2)
   Data disimpan di localStorage dengan prefix ewt2_.
   Data v1 (ewt_v1_) dimigrasikan otomatis.
   ============================================================ */
(function () {
  "use strict";

  var LS = "ewt2_";
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------------- storage ---------------- */
  function load(k, d) {
    try {
      var v = localStorage.getItem(LS + k);
      return v === null ? d : JSON.parse(v);
    } catch (e) { return d; }
  }
  function saveLocal(k, v) { localStorage.setItem(LS + k, JSON.stringify(v)); }
  function save(k, v) { saveLocal(k, v); cloudSave(k, v); kcNoticeSave(k); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayISO(d) { d = d || new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fmtDate(iso) {
    try {
      var p = iso.split("-");
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    } catch (e) { return iso; }
  }
  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, self = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }
  function countWords(s) { var m = s.trim().match(/\S+/g); return m ? m.length : 0; }

  /* ---------------- state ---------------- */
  var settings = load("settings", { name: "", goal: 150, theme: "dark" });
  var acts = load("acts", {});         // { iso: { journal:1, copy:1, read:1, cyc:1 } }
  var copyBest = load("copyBest", {}); // { textKey: bestAccuracy }

  function markDay(kind) {
    var iso = todayISO();
    if (!acts[iso]) acts[iso] = {};
    acts[iso][kind] = (acts[iso][kind] || 0) + 1;
    save("acts", acts);
    renderStreak(); renderDashboard();
  }

  /* ---------------- migration from v1 ---------------- */
  (function migrate() {
    function old(k) { try { var v = localStorage.getItem("ewt_v1_" + k); return v === null ? null : JSON.parse(v); } catch (e) { return null; } }
    if (!load("migrated", false)) {
      var oj = old("journal"), ord = old("reading"), oc = old("cycles"), oe = old("errors"), od = old("days"), ob = old("copyBest");
      var j = load("journal", null);
      if (oj && !j) save("journal", oj.map(function (it) {
        return { id: uid(), date: it.date || todayISO(), topic: it.topic || "—", prompt: "", words: it.words || countWords(it.text || ""), text: it.text || "" };
      }));
      var r = load("readings", null);
      if (ord && !r) save("readings", ord.map(function (it) { return { id: uid(), date: it.date, source: it.source, notes: it.notes }; }));
      var c = load("cycles", null);
      if (oc && !c) save("cycles", oc.map(function (it) {
        return { id: uid(), date: it.date, steps: it.steps || 0, similarity: null, draft: it.draft || "", corrected: "", rewrite: "" };
      }));
      var e = load("errors", null);
      if (oe && !e) save("errors", oe.map(function (it) { return { id: uid(), date: it.date, type: it.type, wrong: it.wrong, right: it.right }; }));
      if (od && !Object.keys(acts).length) {
        var m = {};
        Object.keys(od).forEach(function (iso) { m[iso] = { journal: 1 }; });
        acts = m; save("acts", m);
      }
      if (typeof ob === "number" && !Object.keys(copyBest).length) copyBest = { built0: ob };
      save("migrated", true);
    }
  })();

  /* ---------------- toast & modal ---------------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  var modalCb = null;
  function confirmBox(title, msg, cb) {
    $("#modalTitle").textContent = title;
    $("#modalMsg").textContent = msg;
    modalCb = cb;
    $("#modalBackdrop").classList.remove("hidden");
    $("#modalOk").focus();
  }
  $("#modalOk").addEventListener("click", function () {
    $("#modalBackdrop").classList.add("hidden");
    if (modalCb) modalCb(); modalCb = null;
  });
  $("#modalCancel").addEventListener("click", function () { $("#modalBackdrop").classList.add("hidden"); modalCb = null; });
  $("#modalBackdrop").addEventListener("click", function (e) { if (e.target === this) { this.classList.add("hidden"); modalCb = null; } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { $("#modalBackdrop").classList.add("hidden"); modalCb = null; } });

  /* ---------------- navigation ---------------- */
  var PAGES = {
    dashboard: ["Dashboard", "Ringkasan latihanmu hari ini"],
    journal: ["Journaling", "Metode 1 — menulis rutin dengan prompt harian"],
    copywork: ["Copywork", "Metode 2 — imitasi teks berkualitas untuk membangun intuisi"],
    reading: ["Reading", "Baca artikel online (Wikipedia) — lalu catat pola & uji pemahaman"],
    cycle: ["Cycle", "Metode 4 — draft → correct → rewrite"],
    corrector: ["Koreksi Grammar", "Periksa & koreksi grammar — aturan offline + LanguageTool online"],
    errors: ["Error Log", "Metode 5 — pelacakan kesalahan agar tidak terulang"],
    plan: ["Rencana", "Jadwal mingguan yang menggabungkan semua metode"],
    account: ["Akun & Sinkronisasi", "Kode sinkron (nol setup) atau masuk Google — progress mengikuti perangkat mana pun"],
    settings: ["Pengaturan", "Profil, tema, dan kelola data"]
  };
  function goto(page) {
    $$(".page").forEach(function (s) { s.classList.toggle("hidden", s.id !== "page-" + page); });
    $$(".nav-item").forEach(function (b) {
      if (b.dataset.page === page) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("#pageTitle").textContent = PAGES[page][0];
    $("#pageSub").textContent = PAGES[page][1];
    if (page === "account") renderAccount();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$(".nav-item").forEach(function (b) { b.addEventListener("click", function () { goto(b.dataset.page); }); });
  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-goto]");
    if (g) goto(g.dataset.goto);
  });

  /* ---------------- dashboard / streak ---------------- */
  function currentStreak() {
    var n = 0, d = new Date();
    var firstYes = todayISO(d);
    // hari ini belum dihitung belum walau streak versi "lalu kemarin tetap hidup"
    if (!acts[firstYes]) d.setDate(d.getDate() - 1);
    for (;;) {
      var iso = todayISO(d);
      if (acts[iso] && Object.keys(acts[iso]).length) { n++; d.setDate(d.getDate() - 1); }
      else break;
      if (n > 400) break;
    }
    return n;
  }
  function renderStreak() {
    $("#streakChipNum").textContent = currentStreak();
    var grid = $("#calGrid"); if (!grid) return;
    grid.innerHTML = "";
    // jajarkan kolom: mulai dari 34 hari lalu (4 minggu penuh + sisa) agar 7 kolom rapikan
    var cells = [];
    for (var i = 34; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      cells.push(d);
    }
    var firstCell = cells[0].getDay(); // 0=Sun
    for (var s = 0; s < firstCell; s++) grid.appendChild(document.createElement("div"));
    cells.forEach(function (d) {
      var iso = todayISO(d);
      var el = document.createElement("div");
      var act = acts[iso] ? Object.keys(acts[iso]).length : 0;
      el.className = "day" + (act ? " done" : "") + (iso === todayISO() ? " today" : "") + (!act && iso !== todayISO() ? " none" : "");
      el.title = fmtDate(iso) + (act ? " — " + act + " aktivitas" : " — kosong");
      el.dataset.iso = iso;
      grid.appendChild(el);
    });
  }
  $("#calGrid").addEventListener("click", function (e) {
    var el = e.target.closest(".day");
    if (!el || !el.dataset.iso) return;
    var iso = el.dataset.iso;
    confirmBox("Ubah hari ini", (acts[iso] ? "Hapus" : "Tandai") + " aktivitas untuk " + fmtDate(iso) + "?", function () {
      if (acts[iso]) delete acts[iso]; else acts[iso] = { manual: 1 };
      save("acts", acts);
      renderStreak(); renderDashboard();
    });
  });

  var T_DONE = ["Kerjakan minimal satu aktivitas hari ini untuk menjaga streak.",
    "Pembuka bagus — masih ada waktu untuk aktivitas kedua hari ini.",
    "Dua aktivitas selesai! Satu langkah lagi untuk hari yang lengkap.",
    "Tiga dari empat — selisih satu, kejar!",
    "Empat aktivitas hari ini. Konsistensi seperti ini yang mengubah kemampuan." ];

  function renderDashboard() {
    var j = load("journal", []), c = load("cycles", []), e = load("errors", []), r = load("readings", []);
    $("#s-entries").textContent = j.length;
    $("#s-sessions").textContent = c.length;
    var best = 0; Object.keys(copyBest).forEach(function (k) { if (copyBest[k] > best) best = copyBest[k]; });
    $("#s-copybest").textContent = best ? best + "%" : "–";
    $("#s-errors").textContent = e.length;
    var words = 0; j.forEach(function (x) { words += x.words || 0; });
    $("#s-words").textContent = words.toLocaleString("id-ID");

    // greeting
    var h = new Date().getHours();
    var time = h < 5 ? "Selamat malam" : h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
    $("#greeting").textContent = time + (settings.name ? ", " + settings.name : "") + " 👋";
    var today = acts[todayISO()] ? Object.keys(acts[todayISO()]).length : 0;
    $("#greetMsg").textContent = T_DONE[Math.min(today, 4)];

    // checklist bars
    var t = acts[todayISO()] || {};
    [["journal", t.journal || 0], ["copy", t.copy || 0], ["read", t.read || 0], ["cyc", t.cyc || 0]].forEach(function (p) {
      var f = $("#ck-" + p[0]);
      f.style.width = Math.min(100, p[1] / 1 * 100) + "%";
      f.style.background = p[1] ? "var(--green)" : "var(--accent)";
    });
  }

  /* ---------------- journal ---------------- */
  var PROMPTS = [
    ["Opini", "Do you think students should be allowed to use AI tools for homework? Give two reasons."],
    ["Keseharian", "Describe your day so far in 8–10 sentences. What happened, and how did you feel?"],
    ["Naratif", "Write about a small mistake you made that taught you something useful."],
    ["Perbandingan", "Compare studying alone and studying in a group. Which suits you better, and why?"],
    ["Deskripsi", "Describe the room you are in right now using as many senses as possible."],
    ["Masa depan", "What skill do you want to master in the next two years, and what is your plan?"],
    ["Eksplanasi", "Explain a hobby or routine of yours to someone who has never heard of it."],
    ["Argumen", "Some people say social media does more harm than good. What is your position?"],
    ["Refleksi", "What is one thing you did well this week, and one thing you want to fix next week?"],
    ["Hipotetis", "If you could instantly master one language skill (speaking, writing, listening), which one would you choose, and why?"],
    ["Teknologi", "Should smartphones be banned in classrooms? Argue your case in one paragraph."],
    ["Cerita", "Retell a movie or story you enjoyed recently — its plot, and why it worked (or did not)."]
  ];
  var promptIdx = load("promptIdx", -1);
  function setPrompt() {
    var i;
    do { i = Math.floor(Math.random() * PROMPTS.length); } while (i === promptIdx && PROMPTS.length > 1);
    promptIdx = i; save("promptIdx", i);
    $("#promptTag").textContent = PROMPTS[i][0];
    $("#promptText").textContent = PROMPTS[i][1];
  }
  $("#btnPrompt").addEventListener("click", setPrompt);
  setPrompt();

  var jText = $("#jText");
  function jRenderDraftFlag() {
    $("#jDraftFlag").textContent = jText.value.trim() ? "draf tersimpan otomatis ✓" : "";
    $("#jDraftFlag").style.color = "var(--green)";
  }
  var jAutosave = debounce(function () {
    save("draftJournal", jText.value);
    jRenderDraftFlag();
  }, 500);
  function jCount() {
    var n = countWords(jText.value), goal = settings.goal || 150;
    $("#jCount").textContent = n + " kata — target " + goal;
    var bar = $("#jBar");
    bar.style.width = Math.min(100, n / goal * 100) + "%";
    bar.style.background = n >= goal ? "var(--green)" : "var(--accent)";
  }
  jText.addEventListener("input", function () { jCount(); jAutosave(); jMarkStale(); });
  jText.value = load("draftJournal", "");
  jCount(); jRenderDraftFlag();

  $("#btnSaveJournal").addEventListener("click", function () {
    var txt = jText.value.trim();
    if (!txt) { toast("Tulis sesuatu dulu 🙂"); return; }
    var list = load("journal", []);
    list.unshift({ id: uid(), date: todayISO(), topic: PROMPTS[promptIdx][0], prompt: PROMPTS[promptIdx][1], words: countWords(txt), text: txt });
    save("journal", list);
    jText.value = ""; save("draftJournal", "");
    jCount(); jRenderDraftFlag(); jClearIssues();
    markDay("journal"); renderJournalList();
    toast("Entri tersimpan — " + countWords(txt) + " kata 🎉");
  });

  function renderJournalList() {
    var q = ($("#jSearch").value || "").toLowerCase();
    var list = load("journal", []);
    var el = $("#jList"); el.innerHTML = "";
    var shown = list.filter(function (it) { return !q || (it.topic + " " + it.text).toLowerCase().indexOf(q) > -1; });
    shown.slice(0, 30).forEach(function (it) {
      var li = document.createElement("div");
      li.className = "entry";
      li.innerHTML =
        '<div class="entry-head">' +
        '<span class="tag">' + esc(it.topic) + "</span>" +
        "<b>" + it.words + " kata</b>" +
        '<span class="meta">' + fmtDate(it.date) + "</span>" +
        '<button class="icon-btn entry-del" data-del="' + it.id + '" title="Hapus entri">✕</button>' +
        "</div>" +
        '<div class="entry-body">' + esc(it.text) + "</div>";
      el.appendChild(li);
    });
    if (!shown.length) el.innerHTML = '<div class="entry meta">' + (list.length ? "Tidak ada entri yang cocok." : "Belum ada entri. Mulai tulis hari ini!") + "</div>";
  }
  $("#jSearch").addEventListener("input", renderJournalList);
  $("#jList").addEventListener("click", function (e) {
    var del = e.target.closest(".entry-del");
    if (del) {
      var id = del.dataset.del;
      confirmBox("Hapus entri?", "Entri ini akan dihapus permanen dari journal.", function () {
        save("journal", load("journal", []).filter(function (x) { return x.id !== id; }));
        renderJournalList(); renderDashboard(); toast("Entri dihapus");
      });
      return;
    }
    var head = e.target.closest(".entry-head");
    if (head) head.parentElement.classList.toggle("open");
  });
  renderJournalList();

  /* ---------------- journal grammar check ---------------- */
  var jIssues = [];   // {start,end,wrong,fix,msg,src,stale} — bentuk sama dengan corrector
  var jLastWasLT = false;
  var jChecked = false;

  function jMarkStale() {
    // teks berubah → offset hasil cek lama tidak valid lagi
    if (!jIssues.length) return;
    jIssues.forEach(function (iss) { iss.stale = true; });
    renderJIssues();
  }

  function renderJIssues() {
    var el = $("#jIssues");
    var text = jText.value;
    var nLocal = jIssues.filter(function (i) { return i.src === "local"; }).length;
    var nLT = jIssues.length - nLocal;
    $("#jCheckSummary").textContent = jIssues.length
      ? jIssues.length + " saran" + (nLocal ? " — " + nLocal + " offline" : "") + (nLT ? " — " + nLT + " online" : "")
      : "";
    $("#jTools").classList.toggle("hidden", !jIssues.length);

    el.innerHTML = "";
    if (!jIssues.length) {
      if (text.trim() && jChecked) {
        el.innerHTML = '<div class="ok-note">Tidak ada masalah ditemukan' + (jLastWasLT ? "" : " oleh aturan offline") + ' — tulismu bagus! 🎉</div>';
      }
      return;
    }
    jIssues.forEach(function (iss, idx) {
      var fs = Math.max(0, iss.start - 40), fe = Math.min(text.length, iss.end + 40);
      var ctx = esc(text.slice(fs, iss.start)) + '<span class="hl">' + esc(text.slice(iss.start, iss.end) || "…") + "</span>" + esc(text.slice(iss.end, fe));
      var li = document.createElement("div");
      li.className = "issue" + (iss.stale ? " stale" : "");
      li.innerHTML =
        '<div class="issue-main" style="flex:1;">' +
        '<span class="tag src' + (iss.src === "lt" ? " lt" : "") + '">' + (iss.src === "lt" ? "LanguageTool" : "Offline") + "</span>" +
        (iss.fix ? "<s style='color:var(--red)'>" + esc(iss.wrong) + "</s>" : "") +
        (iss.fix ? " → <b class='w-ok'>" + esc(iss.fix) + "</b> " : " ") +
        "<span class='meta'>" + esc(iss.msg) + "</span>" +
        "</div>" +
        "<div class='issue-ctx'>" + ctx + "</div>" +
        (iss.fix ? '<button class="btn sm primary issue-apply" data-i="' + idx + '"' + (iss.stale ? " disabled" : "") + ">Terapkan</button>" : "");
      el.appendChild(li);
    });
  }

  function jRunLocalCheck() {
    jLastWasLT = false;
    jChecked = true;
    jIssues = collectLocalIssues(jText.value);
    renderJIssues();
  }

  function jRunLTCheck() {
    var raw = jText.value;
    if (!raw.trim()) { toast("Tulis journal dulu 🙂"); return; }
    var btn = $("#btnJCheckOnline");
    btn.disabled = true; btn.textContent = "Memeriksa…";
    $("#jCheckSummary").textContent = "Menghubungi LanguageTool…";
    fetchLTIssues(raw).then(function (issues) {
      jChecked = true;
      jIssues = issues;
      jLastWasLT = true;
      renderJIssues();
      btn.disabled = false; btn.textContent = "Periksa online";
      if (!jIssues.length) toast("LanguageTool tidak menemukan masalah 🎉");
    }).catch(function () {
      btn.disabled = false; btn.textContent = "Periksa online";
      $("#jCheckSummary").textContent = "";
      toast("Gagal menghubungi LanguageTool — periksa koneksi internet.");
    });
  }

  function jClearIssues() {
    jIssues = []; jLastWasLT = false; jChecked = false;
    $("#jCheckSummary").textContent = "";
    $("#jTools").classList.add("hidden");
    $("#jIssues").innerHTML = "";
  }

  function jRecheckLocal() {
    jIssues = collectLocalIssues(jText.value);
    renderJIssues();
  }

  $("#btnJCheckLocal").addEventListener("click", jRunLocalCheck);
  $("#btnJCheckOnline").addEventListener("click", jRunLTCheck);

  $("#btnJApplyAll").addEventListener("click", function () {
    var res = applyAllLocalIssues(jText.value);
    jText.value = res.text;
    save("draftJournal", jText.value);
    jCount(); jRenderDraftFlag();
    jRecheckLocal();
    toast(res.count + " perbaikan diterapkan ✅");
  });

  $("#jIssues").addEventListener("click", function (e) {
    var b = e.target.closest(".issue-apply");
    if (!b || b.disabled) return;
    var iss = jIssues[+b.dataset.i];
    if (!iss) return;
    jText.value = spliceIssue(jText.value, iss);
    save("draftJournal", jText.value);
    jCount(); jRenderDraftFlag();
    if (iss.src === "local") {
      jRecheckLocal();
      toast("Saran diterapkan — hasil diperiksa ulang");
    } else {
      jIssues.forEach(function (x) { if (x !== iss) x.stale = true; });
      renderJIssues();
      toast("Diterapkan. Jalankan periksa ulang untuk saran lainnya.");
    }
  });

  /* ---------------- copywork ---------------- */
  var TEXTS = [
    { key: "built0", genre: "Opini", title: "Remote work", body: "Working from home has changed the way we think about productivity. At first, many managers worried that employees would waste time without supervision. In practice, however, the opposite often happened: people worked longer hours and reported fewer distractions. The real challenge is not laziness but isolation, and the companies that solve it well tend to offer both flexibility and community." },
    { key: "built1", genre: "Naratif", title: "A rainy morning", body: "The rain began before sunrise, tapping softly against the window until the whole street turned silver. By the time I stepped outside, puddles had gathered along the pavement, each one holding a copy of the grey sky. I walked slowly, listening to the rhythm of water on umbrellas, and for a moment the noisy city felt quiet, almost gentle." },
    { key: "built2", genre: "Ekspositori", title: "Why sleep matters", body: "Sleep is not a luxury; it is a biological necessity. During deep sleep, the brain sorts the day's memories and clears away waste, which is why a single bad night can cloud both mood and concentration. Studies consistently show that people who sleep seven to eight hours make fewer errors and learn faster. Protecting your sleep, therefore, may be the simplest way to protect your mind." },
    { key: "built3", genre: "Persuasif", title: "Learning by doing", body: "Nobody learns to swim by reading about water. Skills grow through practice, feedback, and correction, in that order. A beginner who writes one imperfect paragraph every day will soon overtake a reader who studies grammar for months without writing at all. Progress feels uncomfortable because it is supposed to: every mistake you notice is a lesson arriving early." },
    { key: "built4", genre: "Deskripsi", title: "A corner coffee shop", body: "Tucked between a bookstore and a bakery, the coffee shop announces itself only by smell. Its two windows pour warm light onto the pavement, and inside, chairs of mismatched wood circle small round tables. The barista greets regulars by name and memorizes orders without writing them down. Even the silence here has texture: pages turning, cups clinking, the low murmur of unhurried talk." },
    { key: "built5", genre: "Argumentasi", title: "City or countryside", body: "Urban defenders point to opportunity: jobs, institutions, and people packed within a few square kilometres. Rural advocates answer with space, cleaner air, and a slower rhythm that protects mental health. Both are right, which is precisely the problem. The choice is never between good and bad but between different versions of a good life, and honesty demands that we admit the price of whichever version we pick." },
    { key: "built6", genre: "Email formal", title: "A polite request", body: "Dear Mr. Tanaka, I am writing to follow up on our meeting last Tuesday regarding the proposed schedule. Could you let me know whether the revised dates work for your team? If any of them conflict with your commitments, I would be happy to arrange alternatives. I look forward to hearing from you at your earliest convenience. Kind regards, Alex." },
    { key: "built7", genre: "Ringkasan", title: "Summarizing an idea", body: "In short, the book argues that talent is overrated and deliberate practice is everything. The author supports this claim with studies of musicians, chess players, and athletes, all of whom improve through focused repetition rather than gift. Critics reply that opportunity and timing play roles the author underplays. Even so, the practical advice stands: work at the edge of your ability, get feedback, and repeat." }
  ];
  var copySel = $("#copySelect");
  TEXTS.forEach(function (t, i) {
    var o = document.createElement("option");
    o.value = t.key;
    o.textContent = t.genre + " — " + t.title;
    copySel.appendChild(o);
  });
  var oc = document.createElement("option");
  oc.value = "custom"; oc.textContent = "Teks sendiri (paste di bawah)";
  copySel.appendChild(oc);

  var copyMode = "copy";
  function currentTarget() {
    if (copySel.value === "custom") return $("#customCopy").value.trim();
    var t = TEXTS.filter(function (x) { return x.key === copySel.value; })[0];
    return t ? t.body : "";
  }
  function currentKey() { return copySel.value; }
  function renderTarget() {
    var body = currentTarget();
    var box = $("#copyTarget");
    box.innerHTML = body
      ? body.split(/\s+/).map(function (w) { return "<span>" + esc(w) + "</span>"; }).join(" ")
      : '<span class="lbl">Pilih teks di atas, atau tempel teksmu sendiri.</span>';
    box.classList.toggle("blur", copyMode === "recall" && !$("#copyResult").classList.contains("showing"));
    $("#recallNote").classList.toggle("hidden", copyMode !== "recall");
  }
  $$(".seg-btn[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () {
      copyMode = b.dataset.mode;
      $$(".seg-btn[data-mode]").forEach(function (x) { x.classList.toggle("active", x === b); });
      $("#copyResult").classList.remove("showing");
      renderTarget();
    });
  });
  copySel.addEventListener("change", function () {
    $("#customWrap").classList.toggle("hidden", copySel.value !== "custom");
    resetCopyUI();
    renderTarget();
    showBest();
  });
  $("#customCopy").addEventListener("input", debounce(function () { renderTarget(); }, 200));

  function showBest() {
    var b = copyBest[currentKey()];
    $("#copyBestNote").textContent = b ? "Rekormu: " + b + "%" : "";
  }
  function resetCopyUI() {
    $("#copyInput").value = "";
    $("#copyAcc").textContent = "Akurasi: –";
    var res = $("#copyResult");
    res.classList.remove("showing"); res.classList.add("hidden"); res.innerHTML = "";
    renderTarget();
  }
  $("#btnCopyReset").addEventListener("click", resetCopyUI);

  // tokenizer + LCS diff
  function tokens(s) { return s.trim().match(/\S+/g) || []; }
  function norm(w) { return w.toLowerCase().replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/gi, ""); }
  function makeDiff(a, b) { // a = target words, b = typed words
    var n = a.length, m = b.length;
    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) {
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    var ma = new Array(n).fill(false), mb = new Array(m).fill(false);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (norm(a[i]) === norm(b[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) { ma[i] = mb[j] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { ma: ma, mb: mb };
  }
  $("#btnCopyCheck").addEventListener("click", function () {
    var target = currentTarget();
    if (!target) { toast("Pilih atau tempel teks dulu."); return; }
    var typed = $("#copyInput").value.trim();
    if (!typed) { toast("Belum ada yang diketik."); return; }
    var tw = tokens(target), iw = tokens(typed);
    var d = makeDiff(tw, iw);
    var matches = d.ma.filter(Boolean).length;
    var acc = tw.length ? Math.round(matches / tw.length * 100) : 0;

    // render target dengan status kata
    var box = $("#copyTarget"), spans = box.querySelectorAll("span");
    if (spans.length === tw.length) tw.forEach(function (_, i) {
      spans[i].className = d.ma[i] ? "w-ok" : "w-miss";
    });
    box.classList.remove("blur");
    $("#copyResult").classList.remove("hidden");
    $("#copyResult").classList.add("showing");

    var typedHtml = iw.map(function (w, i) {
      return '<span class="' + (d.mb[i] ? "w-ok" : "w-extra") + '">' + esc(w) + "</span>";
    }).join(" ");
    var extras = d.mb.filter(function (x) { return !x; }).length;
    var misses = d.ma.filter(function (x) { return !x; }).length;
    var verdict;
    if (acc === 100 && extras === 0) verdict = "Sempurna. Intuisi struktur kalimatmu terasah.";
    else if (acc >= 85) verdict = "Bagus! Lihat kata merah di target — itu yang keliru atau terlewat. Tulis ulang sekali lagi untuk mengunci.";
    else if (acc >= 60) verdict = "Cukup. Coba salin kalimat per kalimat, bukan satu blok besar.";
    else verdict = "Jangan berkecil hati — pecah jadi dua kalimat pertama dulu, kuasai itu, lalu lanjut.";
    $("#copyResult").innerHTML =
      "<b>Akurasi " + acc + "%</b> — cocok " + matches + "/" + tw.length + " kata. " +
      (misses ? 'Terlewat/keliru: <span class="w-miss">' + misses + "</span> kata. " : "") +
      (extras ? 'Ekstra: <span class="w-extra">' + extras + "</span> kata. " : "") +
      verdict +
      '<div class="altctrl"><span class="lbl">Penulisanmu:</span><br>' + typedHtml + "</div>";
    $("#copyAcc").textContent = "Akurasi: " + acc + "%";
    if (acc > (copyBest[currentKey()] || 0)) {
      copyBest[currentKey()] = acc; save("copyBest", copyBest);
      showBest(); toast("Rekor baru: " + acc + "%! 🎉");
    }
    markDay("copy"); renderDashboard();
  });
  showBest(); renderTarget();

  /* ---------------- reading ---------------- */
  $("#btnSaveReading").addEventListener("click", function () {
    var src = $("#readSource").value.trim() || "(tanpa sumber)";
    var notes = $("#readNotes").value.trim();
    if (!notes) { toast("Catat minimal satu pola atau kolokasi."); return; }
    var list = load("readings", []);
    list.unshift({ id: uid(), date: todayISO(), source: src, notes: notes });
    save("readings", list);
    $("#readSource").value = ""; $("#readNotes").value = "";
    markDay("read"); renderReadingList(); renderDashboard();
    toast("Catatan bacaan tersimpan");
  });
  function renderReadingList() {
    var q = ($("#rSearch").value || "").toLowerCase();
    var list = load("readings", []);
    var el = $("#rList"); el.innerHTML = "";
    var shown = list.filter(function (it) { return !q || (it.source + " " + it.notes).toLowerCase().indexOf(q) > -1; });
    shown.slice(0, 30).forEach(function (it) {
      var li = document.createElement("div");
      li.className = "entry";
      li.innerHTML =
        '<div class="entry-head"><b>' + esc(it.source) + "</b>" +
        '<span class="meta">' + fmtDate(it.date) + "</span>" +
        '<button class="icon-btn entry-del" data-del="' + it.id + '" title="Hapus">✕</button></div>' +
        '<div class="entry-body" style="display:block;">' + esc(it.notes) + "</div>";
      el.appendChild(li);
    });
    if (!shown.length) el.innerHTML = '<div class="entry meta">' + (list.length ? "Tidak ada catatan yang cocok." : "Belum ada catatan bacaan.") + "</div>";
  }
  $("#rSearch").addEventListener("input", renderReadingList);
  $("#rList").addEventListener("click", function (e) {
    var del = e.target.closest(".entry-del");
    if (del) {
      var id = del.dataset.del;
      confirmBox("Hapus catatan?", "Catatan bacaan ini akan dihapus permanen.", function () {
        save("readings", load("readings", []).filter(function (x) { return x.id !== id; }));
        renderReadingList(); toast("Catatan dihapus");
      });
    }
  });
  renderReadingList();

  /* ---------------- reading online (Wikipedia + News in Levels + teks latihan bawaan) ---------------- */
  var READ_HOSTS = { simple: "https://simple.wikipedia.org", en: "https://en.wikipedia.org" };
  var NIL_HOST = "https://www.newsinlevels.com";
  var readArticle = null;   // { title, url, text, src, libLv?, libQs?, disc?, counted? }
  var readQuestions = [];   // tiap item: {kind:"cloze",sent,answer,options,done,ok} | {kind:"lib",text,options,ai,done,ok}
  var readDone = 0, readCorrect = 0;

  // Teks latihan bawaan (bisa offline): passage gaya tes reading ESL + soal pemahaman asli.
  var READ_LIBRARY = [
    { t: "The Lost Wallet", lv: "A2",
      x: "Last Saturday, Maya was walking home from the market. On the sidewalk, she saw a brown wallet. It was old and almost empty, but inside there was 200,000 rupiah and a library card. The card had a name on it: Mr. Tan.\n\nMaya knew the name. Mr. Tan lived in her apartment building, on the fifth floor. He was quiet and he always said hello, but she did not know him well.\n\nSome people might keep the money, but Maya did not even think about it. She went straight to the fifth floor and knocked on Mr. Tan's door.\n\nMr. Tan opened the door slowly. When Maya showed him the wallet, his face changed. \"Thank you,\" he said. \"That library card is more important to me than the money. I use it every day.\"\n\nA week later, Maya found a small note under her door. It said: \"Thank you for being honest. Come for tea on Sunday.\" Now they are friends, and Maya always gets a cup of tea when she visits.",
      q: [
        { q: "Where did Maya find the wallet?", o: ["In the market", "On the sidewalk", "On the fifth floor", "Under her door"], a: 1 },
        { q: "Why was the library card important to Mr. Tan?", o: ["He sold old cards", "He used it every day", "It had his money in it", "It was new and beautiful"], a: 1 },
        { q: "What did Mr. Tan do a week later?", o: ["He moved to a new building", "He gave Maya the money", "He invited Maya for tea", "He went to the market"], a: 2 },
        { q: "The story mainly shows that…", o: ["money is everything", "kindness can start a friendship", "markets are dangerous", "old people are lonely"], a: 1 }
      ] },
    { t: "Bread at Home", lv: "A2",
      x: "Making bread at home is easier than many people think. You need only four things: flour, water, salt, and yeast.\n\nFirst, mix the flour and salt in a big bowl. Then add warm water and the yeast. Mix everything with a spoon until the dough is soft. Next, leave the dough in a warm place for two hours. The yeast makes the dough grow bigger. This is the most important step, so do not be impatient.\n\nAfter two hours, put the dough on a table and press it with your hands. Give it the shape you want: long, round, or small rolls. Then put it in the oven at 220 degrees for about thirty minutes.\n\nWhen the bread is ready, it will sound empty when you knock on the bottom. Wait before you cut it. Many people cut bread too early, and then the inside is still wet. If you wait twenty minutes, your bread will be perfect.",
      q: [
        { q: "What is the most important step?", o: ["Cutting the bread early", "Leaving the dough in a warm place", "Using cold water", "Pressing the dough on a table"], a: 1 },
        { q: "How do you know the bread is ready?", o: ["It stops smelling", "It sounds empty when you knock on the bottom", "The oven turns off", "It falls when you touch it"], a: 1 },
        { q: "What do many people do too early?", o: ["Add salt", "Cut the bread", "Open the oven", "Wash the bowl"], a: 1 },
        { q: "How long does the dough rest?", o: ["Twenty minutes", "Thirty minutes", "Two hours", "Two days"], a: 2 }
      ] },
    { t: "The Night Bus", lv: "A2",
      x: "When Diego missed the last train, he had to take the night bus home. The bus was almost empty. There was only an old woman with a big red bag, a student reading a book, and a man sleeping near the window.\n\nAt the third stop, the old woman stood up, but she forgot her red bag. Diego took the bag and ran after her, but the bus doors closed and the bus moved. He pressed the stop button, but it was too late.\n\nThe student looked up from her book. \"I know that bag,\" she said. \"The woman gets off at the hospital. We can take the bus back there.\" The sleeping man woke up and laughed. \"You are all very kind,\" he said. \"This is the friendliest bus in the city.\"\n\nTwenty minutes later, the bus came back to the hospital. The old woman was standing there with two police officers, but when she saw her red bag in Diego's hands, she smiled and everyone laughed. She offered to pay him, but Diego only asked for her name. \"I want to say hello next time,\" he said.",
      q: [
        { q: "Why was the bus almost empty?", o: ["It was very late at night", "The bus was broken", "Tickets were expensive", "It was a holiday"], a: 0 },
        { q: "Who helped Diego find the woman?", o: ["The driver", "The police officers", "The student", "The sleeping man"], a: 2 },
        { q: "Where did the bus go back to?", o: ["The market", "The train station", "The hospital", "The first stop"], a: 2 },
        { q: "What did Diego want from the woman?", o: ["Money", "Her red bag back", "Her name", "A free ticket"], a: 2 }
      ] },
    { t: "Why Do We Yawn?", lv: "B1",
      x: "For a long time, people believed that we yawn because our brain needs more oxygen. The idea is simple: when we are tired, we breathe slowly, so the brain gets less oxygen, and a yawn forces a big breath to fix it. It sounds logical, but scientists have tested it, and it is wrong. In experiments, people breathed pure oxygen, which should stop the yawning. It did not.\n\nA more modern idea points to temperature. According to this theory, the brain heats up when we are tired or bored, and yawning brings cool air into the body, cooling the brain so it can work better. This explains something strange: people yawn more in summer than in winter, when the air is cooler.\n\nThere is one more thing about yawning that scientists find interesting: it spreads. If you see, hear, or even read about a yawn, you will probably yawn within a few minutes. This \"contagious\" yawning seems connected to empathy, our ability to feel what other people feel. Studies show that people who score higher on empathy tests also yawn more often when they see others yawn.\n\nSo the next time a yawn travels around your classroom, remember: it is not about oxygen. Your brain is cooling itself, and your friends' brains are copying you.",
      q: [
        { q: "What did the old theory say?", o: ["Yawning cools the blood", "The brain needs more oxygen", "Yawning is a sign of illness", "Tired people breathe faster"], a: 1 },
        { q: "Why do people yawn more in summer?", o: ["They are sleepier in summer", "The warmer air cools the brain less", "Oxygen levels drop in summer", "They read more in summer"], a: 1 },
        { q: "Contagious yawning is connected to…", o: ["oxygen", "temperature", "empathy", "tiredness"], a: 2 },
        { q: "What happened when people breathed pure oxygen?", o: ["They yawned less", "They stopped yawning completely", "They still yawned", "They yawned more often"], a: 2 }
      ] },
    { t: "The Rise of Working from Home", lv: "B1",
      x: "Ten years ago, working from home was rare. Most companies believed that people could only work together in one office, and managers watched their employees from behind a desk. Today, millions of people work from home at least part of the week, and many say they will never go back to five days in an office.\n\nThe change has two sides. On the good side, workers save hours every day because they do not travel. They can eat lunch with their families, wear comfortable clothes, and work at the time when they feel most awake. Many companies also save money, because they need smaller offices.\n\nBut the new freedom has a price. Some people find it hard to stop working, because the laptop is always there, even at eleven at night. Others feel lonely without colleagues, and new workers learn less because nobody sits next to them to answer their questions. Managers also worry that it is harder to build trust through a screen.\n\nBecause of this, many companies now choose a middle way: two or three days in the office for meetings and teamwork, and the rest at home. It is not perfect, but it seems to be the future of work, at least for jobs that can be done on a computer.",
      q: [
        { q: "Why do workers save hours every day?", o: ["Offices are smaller", "They do not travel", "Meetings are shorter", "They eat at their desk"], a: 1 },
        { q: "What is one negative for new workers?", o: ["They must work at night", "Nobody sits next to them to answer questions", "They wear uncomfortable clothes", "They pay for their lunch"], a: 1 },
        { q: "Why do some managers worry?", o: ["Workers ask too many questions", "It is harder to build trust through a screen", "Offices cost more money", "Laptops break often"], a: 1 },
        { q: "What is the \"middle way\" that many companies choose?", o: ["No office at all", "Five days in the office", "A few office days plus work at home", "Work only at night"], a: 2 }
      ] },
    { t: "Bees in Trouble", lv: "B1",
      x: "When you see a bee in your garden, you might feel afraid. But these small insects are some of the most important animals on our planet. About one third of the food we eat, including apples, almonds, tomatoes, and coffee, depends on bees moving pollen from flower to flower.\n\nThe problem is simple and serious: bees are disappearing. In some regions, beekeepers lose 30 to 40 percent of their colonies every year. Scientists point to several causes. Pesticides used on farms can poison bees or damage their memory, so they cannot find their way home. A parasite called the varroa mite drinks their blood and spreads viruses. And modern farming creates huge fields with one crop and few flowers, so bees cannot find enough food.\n\nThe good news is that everyone can help. Planting flowers on a balcony, buying honey from local beekeepers, and avoiding pesticides in a garden are small actions, but thousands of small gardens together create a real \"highway\" of food for bees. Governments are starting to act too: several countries have banned the most dangerous pesticides, and farmers are learning to leave wild flowers at the edges of their fields.",
      q: [
        { q: "How much of our food depends on bees?", o: ["All of it", "About one third", "About one half", "Almost none"], a: 1 },
        { q: "What does the varroa mite do?", o: ["It eats flowers", "It drinks bees' blood and spreads viruses", "It eats the honey", "It damages crops"], a: 1 },
        { q: "Why do modern farm fields cause a problem for bees?", o: ["They are too small", "They have one crop and few flowers", "They are full of parasites", "They are too warm"], a: 1 },
        { q: "What can a person with a balcony do to help?", o: ["Buy cheap honey", "Keep a colony in the house", "Plant flowers", "Avoid coffee"], a: 2 }
      ] },
    { t: "The Paradox of Choice", lv: "B2",
      x: "Western culture tells us that more choice means more freedom and more happiness. A supermarket offers 200 kinds of breakfast cereal; a dating app shows thousands of possible partners; a streaming service offers more films than anyone could watch in a lifetime. Common sense says we should feel lucky. Yet psychologists have found that in many cases, more options make us less satisfied, not more.\n\nThe problem begins with expectation. When there are only two options, it is easy to choose and easy to accept the result. When there are four hundred, we start believing that a perfect option must exist, and after we choose, we compare our choice with everything we did not choose. Regret grows, and the pleasure of our decision shrinks. Choosing also costs mental energy, and the more options we face, the more tired our brain becomes; this is one reason people put off big decisions or make them carelessly.\n\nResearchers call the strongest sufferers \"maximisers\": people who feel they must find the single best option, check every possibility, and refuse to settle. Maximisers often make objectively better choices than \"satisficers\", who take the first option that is good enough. But maximisers also tend to feel worse about their lives. The lesson is uncomfortable for a culture built on abundance: to feel happier, do not look for the best choice. Look for a good one, take it, and stop looking.",
      q: [
        { q: "What does common sense say about choice?", o: ["More choice brings happiness", "Fewer options feel better", "Choosing is exhausting", "Choice is a human right"], a: 0 },
        { q: "Why does regret grow when there are many options?", o: ["The best option always fails", "We compare our choice with everything we did not choose", "Sellers give wrong information", "We forget what we wanted"], a: 1 },
        { q: "Who are \"maximisers\"?", o: ["People who take the first good option", "People who must find the single best option", "People who never buy anything", "Store managers"], a: 1 },
        { q: "What is the lesson of the text?", o: ["Always check every possibility", "Avoid big decisions", "Pick a good option and stop looking", "Use apps to compare prices"], a: 2 }
      ] },
    { t: "Learning a Language as an Adult", lv: "B2",
      x: "Adults often believe a myth about themselves: that children learn languages easily and adults cannot. Children do reach excellent pronunciation, and they never worry about mistakes. But in many other ways, adults are better learners. They already understand how grammar works, they can read explanations, and they can study on purpose, while a child simply plays for years.\n\nThe real problem is not ability but two habits. The first is impatience: adults compare themselves to native speakers after three months and decide they have no talent. The second is the fear of looking stupid. A child who says \"I goed to school\" gets a smile and a correction; an adult who makes the same mistake may feel ashamed and go silent. And silence, in language learning, is fatal: the skill grows only in the moments when we produce the language badly.\n\nResearch on \"comprehensible input\" adds a third piece of advice. The fastest learners read and listen to material slightly above their level: enough new words to grow, but few enough to follow the story. Graded readers, podcasts for learners, and TV with subtitles in the target language all do this job. Twenty minutes every day beats two hours on Sunday, because the brain builds memory between study sessions, not only during them.\n\nSo an adult learner's plan is simple: speak early, accept mistakes, read slightly difficult texts daily, and give it a year, not a month.",
      q: [
        { q: "In what way are children better than adults?", o: ["Understanding grammar", "Pronunciation", "Reading explanations", "Studying on purpose"], a: 1 },
        { q: "What is \"fatal\" for adult learners?", o: ["Native speakers", "Grammar books", "Staying silent", "Short study sessions"], a: 2 },
        { q: "What is \"comprehensible input\"?", o: ["Material slightly above your level", "Easy children's stories", "Lists of grammar rules", "Translation exercises"], a: 0 },
        { q: "What does the research say about study time?", o: ["Two hours on Sunday is best", "Short daily sessions beat long rare ones", "Night study works best", "Only classroom study works"], a: 1 }
      ] },
    { t: "A Short History of Tea", lv: "B2",
      x: "The story of tea begins in ancient China, where legend says the emperor Shen Nong discovered it around 2700 BCE when leaves from a wild tree blew into his pot of boiling water. For hundreds of years, tea was a medicine, drunk to stay awake and to treat illness. Only around the Tang dynasty did it become an everyday pleasure, and poets wrote about the calm it brought.\n\nTea reached Japan with Buddhist monks, who used it to stay awake during meditation; the Japanese later turned tea drinking into a ceremony about beauty and attention. In Europe, tea arrived in the seventeenth century and was at first a luxury for the rich, so expensive that people kept it in locked boxes. When prices fell, tea conquered England: by the 1800s, even workers drank sweet tea with every break, and the \"afternoon tea\" of the upper class became a national ritual.\n\nTea changed world history more than any other drink. It created global trade routes, and the British desire to control it contributed to wars, including the Opium Wars with China. In India, tea plantations were built by the British to break China's monopoly, and today India drinks more tea than any country except China itself.",
      q: [
        { q: "How was tea first used?", o: ["As food", "As a medicine", "In ceremonies", "For trade"], a: 1 },
        { q: "Why was tea kept in locked boxes in Europe?", o: ["It was poisonous", "It was very expensive", "It smelled bad", "It was illegal"], a: 1 },
        { q: "Why did the British build tea plantations in India?", o: ["Indian tea tasted better", "To break China's monopoly", "Buddhist monks asked for it", "The climate was warmer"], a: 1 },
        { q: "What did Buddhist monks use tea for?", o: ["Cooking", "Healing wounds", "Staying awake during meditation", "Paying taxes"], a: 2 }
      ] },
    { t: "Sleep and the Teenage Brain", lv: "B2",
      x: "Every school morning, millions of teenagers fight the same enemy: the alarm clock at six or seven. Their parents call them lazy, but biology tells another story. During adolescence, the body's internal clock moves later by one to two hours. A teenager who went to sleep at ten as a child now feels awake until midnight, yet still needs eight to ten hours of sleep. Early school times make this math impossible, and most teenagers build a large \"sleep debt\" during the week, then try to repay it on weekends.\n\nResearch shows that this debt is not harmless. Sleep is when the brain organizes what it learned during the day; cutting sleep cuts memory. Tired teenagers also show weaker self-control, more accidents, and higher rates of anxiety and depression. One American study followed schools that moved their start time from 7:30 to 8:30: students slept about an hour more, attendance improved, and car accidents among young drivers fell by around 16 percent.\n\nChanging schedules is politically hard, because buses, parents' work hours, and sports teams all depend on the old times. But some places are adapting: individual schools now experiment with later starts, and some doctors recommend that schools stop scheduling important exams in the first lesson. The science is clear enough that the question is no longer whether teenagers need later sleep, but how society wants to arrange it.",
      q: [
        { q: "What happens to the teenage body clock?", o: ["It moves earlier", "It moves later by one to two hours", "It stops working", "It stays the same"], a: 1 },
        { q: "How much sleep do teenagers need?", o: ["About 6 hours", "About 6 to 7 hours", "About 8 to 10 hours", "About 12 hours"], a: 2 },
        { q: "What happened in the American study?", o: ["Test scores fell", "Car accidents fell by about 16 percent", "Students woke up earlier", "Attendance got worse"], a: 1 },
        { q: "Why is changing schedules hard?", o: ["Students refuse to change", "Buses and parents' schedules depend on the old times", "Teachers dislike sleeping", "No research exists"], a: 1 }
      ] }
  ];

  function wikiUrl(host) {
    return host + "/w/api.php?action=query&format=json&origin=*&generator=random&grnnamespace=0&grnlimit=1&prop=extracts&explaintext=1";
  }
  function readTrim(text) {
    // buang bagian referensi & potong di batas paragraf ~3000 karakter
    var cutAt = text.search(/^(#{0,4}\s*)?(References?|External links?|See also|Notes?|Bibliography|Further reading|Gallery|Sources?|Footnotes?)\s*$/im);
    if (cutAt > 240) text = text.slice(0, cutAt);
    if (text.length > 3000) {
      var cut = text.slice(0, 3000);
      var lastP = cut.lastIndexOf("\n");
      var lastS = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
      text = cut.slice(0, (lastP > 400 ? lastP : lastS) + 1);
    }
    return text.trim();
  }
  function readFetchWiki(srcKey) {
    $("#readStatus").textContent = "Mengambil artikel…";
    $("#btnReadFetch").disabled = true;
    var host = READ_HOSTS[srcKey];
    function tryOnce(triesLeft) {
      fetch(wikiUrl(host)).then(function (r) { return r.json(); }).then(function (j) {
        var pages = (j.query && j.query.pages) ? Object.keys(j.query.pages).map(function (k) { return j.query.pages[k]; }) : [];
        var p = pages[0];
        var txt = p && typeof p.extract === "string" ? readTrim(p.extract) : "";
        if (!p || p.missing !== undefined || txt.length < 350) {
          if (triesLeft > 0) { tryOnce(triesLeft - 1); }        // artikel stub/kosong → coba lagi
          else {
            $("#btnReadFetch").disabled = false;
            $("#readStatus").textContent = "";
            toast("Artikel temuan terlalu pendek — coba lagi.");
          }
          return;
        }
        readArticle = {
          title: p.title,
          url: host + "/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_")),
          text: txt,
          src: srcKey
        };
        $("#btnReadFetch").disabled = false;
        save("readLast", readArticle);
        renderReadArticle();
      }).catch(function () {
        $("#btnReadFetch").disabled = false;
        $("#readStatus").textContent = "";
        toast("Gagal mengambil — periksa internet.");
      });
    }
    tryOnce(6);
  }
  function readFetchCustom(urlRaw) {
    var url = (urlRaw || "").trim();
    if (!/^https?:\/\//i.test(url)) { toast("Tempel URL yang benar (mulai https://)."); return; }
    $("#readStatus").textContent = "Mengurai halaman…";
    $("#btnReadFetch").disabled = true;
    jinaFetch(url).then(function (md) {
      var title = "Artikel", body = mdToText(md);
      var mt = md.match(/^Title:\s*(.+)$/m);
      if (mt) title = mt[1].trim();
      body = readTrim(body);
      if (body.length < 350) throw new Error("terlalu pendek");
      readArticle = { title: title, url: url, text: body, src: "custom" };
      $("#btnReadFetch").disabled = false;
      $("#readStatus").textContent = "";
      save("readLast", readArticle);
      renderReadArticle();
    }).catch(function (e) {
      $("#btnReadFetch").disabled = false;
      $("#readStatus").textContent = "";
      toast("Gagal mengambil halaman (" + (e.message || "error") + ")");
    });
  }
  // fetch lewat ekstraktor r.jina.ai (CORS terbuka, tanpa API key)
  function jinaFetch(url) {
    return fetch("https://r.jina.ai/" + url).then(function (r) {
      if (!r.ok) throw new Error("" + r.status);
      return r.text();
    });
  }
  // markdown r.jina.ai → teks rapi: gambar/link/bold dibuang, tabel jadi baris " · ", heading dipertahankan
  function mdToText(md) {
    var body = md
      .replace(/^(Title|URL Source|Final URL|Published Time):.*$/gm, "")
      .replace(/^Markdown Content:\s*/m, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                         // gambar
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")                      // link → teks (2× utk link bersarang)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")                            // bold
      .replace(/(^|[\s(">])\*([^*\n]+)\*(?=[\s).,;:!?<]|$)/g, "$1$2") // italic
      .replace(/`([^`]+)`/g, "$1")                                  // kode inline
      .replace(/^>\s?/gm, "");                                      // blockquote
    body = body.split("\n").map(function (l) {                       // tabel → baris teks
      if (!/^\|/.test(l)) return l;
      if (/^[\s|:\-]+$/.test(l)) return "";
      return l.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }).filter(Boolean).join(" · ");
    }).join("\n");
    return body
      .replace(/\[\d+\]|\[citation needed\]|\[edit\]/gi, "")        // referensi
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  // teks → HTML rapi: paragraf, heading markdown → h3, list → ul
  function readToHtml(text) {
    var out = [];
    text.split(/\n{2,}/).forEach(function (b0) {
      var b = b0.replace(/[ \t]+/g, " ").trim();
      if (!b) return;
      var lines = b.split("\n").map(function (l) { return l.trim(); });
      if (lines.every(function (l) { return /^[-*•]\s+/.test(l); })) {
        out.push('<ul class="read-ul">' + lines.map(function (l) {
          return "<li>" + esc(l.replace(/^[-*•]\s+/, "")) + "</li>";
        }).join("") + "</ul>");
        return;
      }
      if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) {
        out.push('<h3 class="read-h">' + esc(lines[0].replace(/^#{1,4}\s+/, "").replace(/[*_]+/g, "")) + "</h3>");
        return;
      }
      out.push("<p>" + esc(b) + "</p>");
    });
    return out.join("");
  }
  function renderReadArticle() {
    if (!readArticle) return;
    $("#readTitle").textContent = readArticle.title;
    $("#readLink").style.display = readArticle.url ? "" : "none";
    if (readArticle.url) $("#readLink").href = readArticle.url;
    $("#readPane").classList.remove("hidden");
    var words = countWords(readArticle.text);
    var tag = readArticle.src === "lib" ? "teks latihan • level " + readArticle.libLv
      : readArticle.src === "nil" ? "News in Levels • tingkat " + readArticle.nilLevel
      : "Wikipedia";
    $("#readMeta").textContent = tag + " • " + words + " kata • ±" + Math.max(1, Math.round(words / 180)) + " menit";
    $("#readBody").innerHTML = readToHtml(readArticle.text) +
      (readArticle.disc ? '<p class="read-disc"><b>Wacana:</b> ' + esc(readArticle.disc) + "</p>" : "");
    $("#readBody").scrollTop = 0;
    buildReadQuiz();
  }

  // --- sumber: teks latihan bawaan (offline), passage + soal pemahaman asli ---
  function readFetchLib(levelKey, silent) {
    var pool = READ_LIBRARY.filter(function (p) { return !levelKey || levelKey === "any" || p.lv === levelKey; });
    if (!pool.length) pool = READ_LIBRARY.slice(0);
    var oldT = readArticle && readArticle.src === "lib" ? readArticle.title : "";
    if (pool.length > 1) {
      var f = pool.filter(function (p) { return p.t !== oldT; });
      if (f.length) pool = f;
    }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    readArticle = { title: pick.t, url: "", text: pick.x, src: "lib", libLv: pick.lv, libQs: pick.q };
    $("#readStatus").textContent = "";
    save("readLast", readArticle);
    renderReadArticle();
    if (!silent) toast("Teks latihan " + pick.lv + " dimuat — baca lalu jawab soalnya.");
  }

  // --- sumber: News in Levels, berita dunia utk pembelajar dalam 3 tingkat ---
  function nilSlug(key) {
    var map = { A2: "level-1", B1: "level-2", B2: "level-3" };
    if (map[key]) return map[key];
    var all = ["level-1", "level-2", "level-3"];
    return all[Math.floor(Math.random() * all.length)];
  }
  function nilExtract(md) {
    var s = md.indexOf("Markdown Content:");
    var b = s > -1 ? md.slice(s + 17) : md;
    var cut = b.search(/^### LEARN 3000 WORDS/m);
    if (cut > -1) b = b.slice(0, cut);
    cut = b.search(/^#### Test/m);
    if (cut > -1) b = b.slice(0, cut);
    var out = [], disc = "";
    b.split("\n").forEach(function (l0) {
      var l = l0.trim();
      if (!l) { if (out.length && out[out.length - 1] !== "") out.push(""); return; }
      if (/^!\[/.test(l)) return;                          // gambar
      if (/^#{1,4}\s+/.test(l)) {                          // heading → kandidat pertanyaan wacana
        var h = l.replace(/^#{1,4}\s+/, "");
        if (/\?$/.test(h) && out.join(" ").length > 200 && !disc) disc = h;
        return;
      }
      if (/^\*?\s*\[Level \d\]/.test(l)) return;           // pilihan tingkat
      if (/^\d{1,2}-\d{1,2}-\d{4}/.test(l)) return;        // tanggal
      if (/^You can watch the original/i.test(l)) return;
      l = l.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/!\[[^\]]*\]/g, "");   // gambar (juga bersarang)
      l = l.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*{1,2}/g, "");
      out.push(l);
    });
    return { text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), disc: disc };
  }
  function readFetchNil(levelKey, triesLeft) {
    var lv = nilSlug(levelKey);
    $("#readStatus").textContent = "Mengambil berita tingkat " + lv.replace("level-", "L") + "…";
    $("#btnReadFetch").disabled = true;
    jinaFetch(NIL_HOST + "/level/" + lv + "/").then(function (md) {
      var links = [];
      md.split("\n").forEach(function (l) {
        var m = l.match(/^###\s*\[(.+?)\]\((https:\/\/www\.newsinlevels\.com\/products\/[^)\s]+)\)/);
        if (m) links.push({ t: m[1], u: m[2] });
      });
      if (!links.length) throw new Error("daftar kosong");
      var pick = links[Math.floor(Math.random() * links.length)];
      return jinaFetch(pick.u).then(function (art) {
        var ex = nilExtract(art);
        if (ex.text.length < 250) throw new Error("terlalu pendek");
        readArticle = {
          title: pick.t.replace(/\s*[-–]\s*level\s*\d+\s*$/i, "").trim(),
          url: pick.u, text: ex.text, src: "nil",
          disc: ex.disc, nilLevel: lv.replace("level-", "")
        };
        $("#btnReadFetch").disabled = false;
        $("#readStatus").textContent = "";
        save("readLast", readArticle);
        renderReadArticle();
        toast("Berita tingkat " + lv.replace("level-", "L") + " dimuat ✓");
      });
    }).catch(function (e) {
      $("#btnReadFetch").disabled = false;
      $("#readStatus").textContent = "";
      if (triesLeft > 0 && String(e.message || e) === "terlalu pendek") { readFetchNil(levelKey, triesLeft - 1); return; }
      toast("Gagal mengambil berita (" + (e.message || e) + ") — coba lagi.");
    });
  }

  // --- kuis: cloze dari kata panjang yang muncul satu kali di teks
  function splitSents(text) {
    var t = text.replace(/\n+/g, " ");
    var out = [], m, re = /[^.!?]+[.!?]+["”')\]]?/g;
    while ((m = re.exec(t)) !== null) { out.push(m[0].trim()); if (out.length > 300) break; }
    return out;
  }
  function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function buildReadQuiz() {
    if (readArticle && readArticle.libQs) { buildLibQuiz(); return; }
    readQKind = "cloze";
    var sents = splitSents(readArticle.text).filter(function (s) {
      var w = s.split(/\s+/).length;
      return w >= 6 && w <= 30;
    });
    // hitung frekuensi kata "bernilai" di seluruh teks
    var freq = {};
    readArticle.text.replace(/[A-Za-z][A-Za-z'-]+/g, function (w) { freq[w.toLowerCase()] = (freq[w.toLowerCase()] || 0) + 1; return w; });
    var pool = Object.keys(freq).filter(function (w) {
      return freq[w] === 1 && w.length >= (readArticle.src === "simple" ? 6 : 7);
    });
    var rare = shuffleArr(pool.slice(0)).filter(function (w) { return w.length <= 13; });
    readQuestions = []; readDone = 0; readCorrect = 0;
    var used = {};
    for (var i = 0; i < sents.length && readQuestions.length < 5 && rare.length; i++) {
      var s = sents[i];
      var words = s.replace(/[^\w\s'-]/g, " ").split(/\s+/);
      var placed = null, pos = -1;
      for (var k = 0; k < words.length; k++) {
        var w = words[k].toLowerCase();
        if (freq[w] === 1 && w.length >= 5 && !used[w] && rare.indexOf(w) > -1) { placed = words[k]; pos = k; break; }
      }
      if (placed === null) continue;
      used[placed.toLowerCase()] = true;
      var distractors = shuffleArr(rare.filter(function (x) { return used[x] !== true && x !== placed.toLowerCase() && Math.abs(x.length - placed.length) <= 4; })).slice(0, 3);
      while (distractors.length < 3 && rare.length > 3) {
        var add = shuffleArr(rare.filter(function (x) { return used[x] !== true; }))[0];
        if (!add || distractors.indexOf(add) > -1) break;
        distractors.push(add);
      }
      if (distractors.length < 3) continue;
      var options = shuffleArr([placed.toLowerCase()].concat(distractors));
      var q = { kind: "cloze", sent: s, answer: placed.toLowerCase(), options: options, done: false, ok: false };
      readQuestions.push(q);
    }
    renderReadQuiz();
  }
  // kuis dari teks latihan bawaan: soal pemahaman asli, opsi diacak
  function buildLibQuiz() {
    readQuestions = shuffleArr(readArticle.libQs.slice(0)).map(function (q) {
      var options = shuffleArr(q.o.slice(0));
      return { kind: "lib", text: q.q, options: options, ai: options.indexOf(q.o[q.a]), done: false, ok: false };
    });
    readDone = 0; readCorrect = 0;
    renderReadQuiz();
  }
  function renderReadQuiz() {
    var el = $("#readQList");
    el.innerHTML = "";
    $("#readQuiz").classList.toggle("hidden", !readQuestions.length);
    if (!readQuestions.length) {
      $("#readQScore").textContent = "Teks ini tidak cukup kaya untuk membuat soal — baca saja, lalu catat polanya.";
      return;
    }
    readQuestions.forEach(function (q, qi) {
      var li = document.createElement("div");
      li.className = "entry rq";
      // cloze: sisip titik blank di kata yang hilang; lib: pertanyaan utuh
      var bodyHtml;
      if (q.kind === "lib") bodyHtml = esc(q.text);
      else {
        var re = new RegExp("\\b" + q.answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
        bodyHtml = esc(q.sent.replace(re, "______"));
      }
      li.innerHTML =
        '<div class="entry-head"><span class="tag q-num">Soal ' + (qi + 1) + "</span></div>" +
        '<div class="entry-body" style="display:block;">' + bodyHtml + "</div>" +
        '<div class="row wrap gap8" style="margin-top:8px;">' +
        q.options.map(function (o, oi) {
          return '<button class="btn ghost sm opt-btn" data-q="' + qi + '" data-o="' + oi + '"' + (q.done ? " disabled" : "") + ">" + esc(o) + "</button>";
        }).join("") +
        "</div>";
      el.appendChild(li);
    });
    $("#readQScore").textContent = "0/" + readQuestions.length + " dijawab";
  }
  $("#readQuiz").addEventListener("click", function (e) {
    var b = e.target.closest(".opt-btn");
    if (!b || b.disabled) return;
    var qi = +b.dataset.q, oi = +b.dataset.o;
    var q = readQuestions[qi];
    if (!q || q.done) return;
    q.done = true;
    q.ok = q.kind === "lib" ? (oi === q.ai) : (q.options[oi] === q.answer);
    readDone++; if (q.ok) readCorrect++;
    var ci = q.kind === "lib" ? q.ai : q.options.indexOf(q.answer); // tombol jawaban benar
    $$("#readQList .opt-btn").forEach(function (btn) {
      if (+btn.dataset.q !== qi) return;
      btn.disabled = true;
      if (+btn.dataset.o === ci && !btn.classList.contains("correct")) btn.classList.add("correct");
      if (btn === b && !q.ok) btn.classList.add("wrong");
    });
    var n = readQuestions.length;
    if (readDone >= n) {
      $("#readQScore").textContent = readCorrect + "/" + n + " benar. " +
        (readCorrect === n ? "Sempurna — pemahamanmu tajam 🎯" : readCorrect >= Math.ceil(n * 0.6) ? "Bagus — baca ulang bagian yang keliru." : "Coba baca teksnya sekali lagi, lalu tekan Soal baru.");
      if (!readArticle.counted) { readArticle.counted = true; save("readLast", readArticle); markDay("read"); renderDashboard(); toast("Bacaan dituntaskan ✓ streak jalan 🔥"); }
    } else {
      $("#readQScore").textContent = readDone + "/" + n + " dijawab • " + readCorrect + " benar";
    }
  });

  function syncReadSrc(v) {
    $("#readUrl").classList.toggle("hidden", v !== "custom");
    $("#readLibLevel").classList.toggle("hidden", !(v === "lib" || v === "nil"));
    $("#btnReadFetch").textContent = v === "custom" ? "Baca artikel ↗" : v === "lib" ? "↻ Latihan baru" : v === "nil" ? "↻ Berita baru" : "↻ Ambil bacaan";
  }
  $("#readSrcSel").addEventListener("change", function () { syncReadSrc(this.value); });
  $("#btnReadFetch").addEventListener("click", function () {
    var v = $("#readSrcSel").value;
    if (v === "custom") readFetchCustom($("#readUrl").value);
    else if (v === "lib") readFetchLib($("#readLibLevel").value, false);
    else if (v === "nil") readFetchNil($("#readLibLevel").value, 3);
    else readFetchWiki(v);
  });
  $("#btnReadNewQs").addEventListener("click", function () {
    if (readArticle && readArticle.src === "lib") readFetchLib($("#readLibLevel").value, true);  // passage baru
    else if (readArticle) buildReadQuiz();                                                        // soal cloze baru
  });
  $("#btnReadToNotes").addEventListener("click", function () {
    if (!readArticle) { toast("Ambil bacaan dulu."); return; }
    $("#readSource").value = readArticle.title + " — " + (readArticle.url || "(teks latihan internal)");
    $("#readNotes").focus();
    toast("Sumber terisi — tulis catatan pola yang kamu temukan");
  });
  syncReadSrc($("#readSrcSel").value);
  readArticle = load("readLast", null);
  if (readArticle && readArticle.text) renderReadArticle();

  /* ---------------- cycle ---------------- */
  var cyIds = ["cyDraft", "cyFixed", "cyRewrite"];
  var cySaveDraft = debounce(function () {
    save("draftCycle", { draft: $("#cyDraft").value, fixed: $("#cyFixed").value, rewrite: $("#cyRewrite").value });
  }, 500);
  cyIds.forEach(function (id) {
    (function () {
      var el = $("#" + id);
      el.addEventListener("input", cySaveDraft);
    })();
  });
  (function restoreCycleDraft() {
    var d = load("draftCycle", null);
    if (d) { $("#cyDraft").value = d.draft || ""; $("#cyFixed").value = d.fixed || ""; $("#cyRewrite").value = d.rewrite || ""; }
  })();

  $("#btnCyDiff").addEventListener("click", function () {
    var a = $("#cyFixed").value.trim(), b = $("#cyRewrite").value.trim();
    var box = $("#cyDiff");
    if (!a) { toast("Isi dulu langkah 2 (corrected)."); return; }
    var aw = tokens(a), bw;
    if (!b) {
      box.classList.remove("hidden");
      box.innerHTML = "Belum ada rewrite. Tulis dulu dari ingatan, lalu bandingkan.";
      return;
    }
    bw = tokens(b);
    var d = makeDiff(aw, bw);
    var matches = d.ma.filter(Boolean).length;
    var sim = aw.length ? Math.round(matches / aw.length * 100) : 0;
    var html = aw.map(function (w, i) {
      return '<span class="' + (d.ma[i] ? "w-ok" : "w-miss") + '">' + esc(w) + "</span>";
    }).join(" ");
    var miss = d.ma.filter(function (x) { return !x; }).length;
    box.classList.remove("hidden");
    box.innerHTML =
      "Kemiripan rewrite dengan corrected: <b>" + sim + "%</b> (" + matches + "/" + aw.length + " kata" +
      (miss ? ", " + miss + " berbeda/terlewat" : "") + ").<br>" +
      "<span class='lbl'>Hijau = persis. Merah = berbeda: bila memang parafrasa sadar, tidak masalah; bila tidak, catat di Error Log.</span>" +
      '<div class="altctrl">' + html + "</div>";
    $("#cySimilarity").textContent = "Terakhir dibandingkan: " + sim + "%";
    save("lastSim", sim);
  });

  function checklistCount() {
    return ["ck1", "ck2", "ck3", "ck4"].filter(function (id) { return $("#" + id).checked; }).length;
  }
  ["ck1", "ck2", "ck3", "ck4"].forEach(function (id) {
    $("#" + id).addEventListener("change", function () {
      $("#cyStatus").textContent = checklistCount() + "/4 langkah kejujuran terpenuhi";
    });
  });
  $("#btnSaveCycle").addEventListener("click", function () {
    var d = $("#cyDraft").value.trim();
    if (!d) { toast("Tulis draft dulu (langkah 1)."); return; }
    var list = load("cycles", []);
    list.unshift({
      id: uid(), date: todayISO(),
      draft: d, corrected: $("#cyFixed").value.trim(), rewrite: $("#cyRewrite").value.trim(),
      steps: checklistCount(), similarity: load("lastSim", null)
    });
    save("cycles", list);
    cyIds.forEach(function (id) { $("#" + id).value = ""; });
    ["ck1", "ck2", "ck3", "ck4"].forEach(function (id) { $("#" + id).checked = false; });
    save("draftCycle", {}); save("lastSim", null);
    $("#cyDiff").classList.add("hidden");
    $("#cyStatus").textContent = ""; $("#cySimilarity").textContent = "";
    markDay("cyc"); renderCycleList(); renderDashboard();
    toast("Sesi cycle selesai 👏");
  });
  function renderCycleList() {
    var list = load("cycles", []);
    var el = $("#cyList"); el.innerHTML = "";
    list.slice(0, 20).forEach(function (it) {
      var li = document.createElement("div");
      li.className = "entry";
      li.innerHTML =
        '<div class="entry-head"><b>' + fmtDate(it.date) + "</b>" +
        '<span class="tag">' + (it.steps || 0) + "/4 langkah</span>" +
        (it.similarity !== null && it.similarity !== undefined ? '<span class="tag">mirip ' + it.similarity + "%</span>" : "") +
        '<span class="meta">' + esc((it.draft || "").slice(0, 80)) + ((it.draft || "").length > 80 ? "…" : "") + "</span>" +
        '<button class="icon-btn entry-del" data-del="' + it.id + '" title="Hapus">✕</button></div>';
      el.appendChild(li);
    });
    if (!list.length) el.innerHTML = '<div class="entry meta">Belum ada sesi. Mulai dengan draft satu paragraf.</div>';
  }
  $("#cyList").addEventListener("click", function (e) {
    var del = e.target.closest(".entry-del");
    if (del) {
      var id = del.dataset.del;
      confirmBox("Hapus sesi?", "Sesi cycle ini akan dihapus permanen.", function () {
        save("cycles", load("cycles", []).filter(function (x) { return x.id !== id; }));
        renderCycleList(); renderDashboard(); toast("Sesi dihapus");
      });
    }
  });
  renderCycleList();

  /* ---------------- errors ---------------- */
  $("#btnAddErr").addEventListener("click", function () {
    var w = $("#errWrong").value.trim(), r = $("#errRight").value.trim();
    if (!w || !r) { toast("Isi versi salah dan versi benar."); return; }
    var list = load("errors", []);
    list.unshift({ id: uid(), date: todayISO(), type: $("#errType").value, wrong: w, right: r });
    save("errors", list);
    $("#errWrong").value = ""; $("#errRight").value = "";
    markDay("err"); renderErrStats(); renderErrList(); renderDashboard();
    toast("Dicatat. Kesalahan ini tidak akan terulang.");
  });
  function renderErrStats() {
    var list = load("errors", []), el = $("#errStats");
    var by = {};
    list.forEach(function (x) { by[x.type] = (by[x.type] || 0) + 1; });
    var keys = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    var max = keys.length ? by[keys[0]] : 0;
    el.innerHTML = "";
    keys.slice(0, 6).forEach(function (k) {
      var row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML =
        "<span>" + esc(k) + "</span>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round(by[k] / max * 100) + '%"></div></div>' +
        '<span class="bar-num">' + by[k] + "</span>";
      el.appendChild(row);
    });
    if (!keys.length) el.innerHTML = '<span class="meta">Belum ada data. Setiap kesalahan yang dikoreksi layak dicatat di sini.</span>';
    $("#errStatsCard").classList.toggle("hidden", !keys.length);
  }
  function renderErrList() {
    var q = ($("#errSearch").value || "").toLowerCase();
    var list = load("errors", []);
    var el = $("#errList"); el.innerHTML = "";
    var shown = list.filter(function (x) { return !q || (x.type + " " + x.wrong + " " + x.right).toLowerCase().indexOf(q) > -1; });
    shown.forEach(function (x) {
      var li = document.createElement("div");
      li.className = "entry";
      li.innerHTML =
        '<div class="entry-head"><span class="tag">' + esc(x.type) + "</span>" +
        "<span><s style='color:var(--red)'>" + esc(x.wrong) + "</s> → <b class='w-ok'>" + esc(x.right) + "</b></span>" +
        '<span class="meta">' + fmtDate(x.date) + "</span>" +
        '<button class="icon-btn entry-del" data-del="' + x.id + '" title="Hapus">✕</button></div>';
      el.appendChild(li);
    });
    if (!shown.length) el.innerHTML = '<div class="entry meta">' + (list.length ? "Tidak ada yang cocok." : "Belum ada kesalahan dicatat — bagus, tetapi pastikan kamu masih menulis!") + "</div>";
  }
  $("#errSearch").addEventListener("input", renderErrList);
  $("#errList").addEventListener("click", function (e) {
    var del = e.target.closest(".entry-del");
    if (del) {
      var id = del.dataset.del;
      confirmBox("Hapus catatan?", "Kesalahan ini akan dihapus dari log.", function () {
        save("errors", load("errors", []).filter(function (x) { return x.id !== id; }));
        renderErrList(); renderErrStats(); renderDashboard(); toast("Dihapus");
      });
    }
  });
  $("#btnExportErr").addEventListener("click", function () {
    downloadFile("error-log-" + todayISO() + ".json", JSON.stringify(load("errors", []), null, 2));
    toast("Error log diekspor");
  });
  renderErrStats(); renderErrList();

  /* ---------------- corrector (grammar checker) ---------------- */
  var corrText = $("#corrText");
  var corrOrigin = "none";          // "cycle" | "journal" | "none"
  var corrIssues = [];              // {start,end,wrong,fix,msg,src,stale}
  var corrLastWasLT = false;

  function keepCase(orig, repl) {
    if (orig.length > 2 && orig === orig.toUpperCase()) return repl.toUpperCase();
    if (orig[0] === orig[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
    return repl;
  }
  function wordRule(w) { return new RegExp("\\b" + w + "\\b", "gi"); }
  function mapRules(map, msg) {
    return Object.keys(map).map(function (k) {
      return { re: wordRule(k), msg: msg, fix: function (m) { return keepCase(m[0], map[m[0].toLowerCase()]); } };
    });
  }

  /* kamus kamus */
  var MISSPELL = { alot: "a lot", definately: "definitely", seperate: "separate", recieve: "receive", occured: "occurred", untill: "until", wich: "which", teh: "the", becuase: "because", goverment: "government", tommorow: "tomorrow", writting: "writing", begining: "beginning", beleive: "believe", belive: "believe", carefull: "careful", completly: "completely", enviroment: "environment", expecially: "especially", foriegn: "foreign", independant: "independent", neccessary: "necessary", posession: "possession", publically: "publicly", recomend: "recommend", sucessful: "successful", thier: "their", truely: "truly", useing: "using", hisself: "himself", theirselves: "themselves", woudnt: "wouldn't", "woudn't": "wouldn't", coudnt: "couldn't", "coudn't": "couldn't" };
  var APOS = { dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't", hasnt: "hasn't", havent: "haven't", wouldnt: "wouldn't", couldnt: "couldn't", shouldnt: "shouldn't", im: "I'm", ive: "I've" };
  var UNCOUNT = { informations: "information", advices: "advice", equipments: "equipment", furnitures: "furniture", musics: "music", knowledges: "knowledge", homeworks: "homework", softwares: "software", feedbacks: "feedback", luggages: "luggage", childrens: "children", peoples: "people", moneys: "money" };
  var NEGMAP = { no: "any", nothing: "anything", nobody: "anybody", none: "any", never: "ever" };
  var V3 = { go: "goes", do: "does", want: "wants", need: "needs", make: "makes", take: "takes", see: "sees", know: "knows", think: "thinks", live: "lives", work: "works", play: "plays", write: "writes", read: "reads", come: "comes", like: "likes", say: "says", use: "uses", find: "finds", give: "gives", tell: "tells", leave: "leaves", feel: "feels", look: "looks", help: "helps", talk: "talks", start: "starts", show: "shows", hear: "hears", run: "runs", move: "moves", eat: "eats", drink: "drinks", sleep: "sleeps", get: "gets", ask: "asks", call: "calls", try: "tries", seem: "seems", turn: "turns", mean: "means", keep: "keeps" };
  var PAST = { went: "go", saw: "see", ate: "eat", took: "take", made: "make", came: "come", got: "get", knew: "know", thought: "think", found: "find", said: "say", told: "tell", began: "begin", brought: "bring", bought: "buy", wrote: "write", spoke: "speak", ran: "run", drank: "drink", slept: "sleep", left: "leave", felt: "feel", gave: "give" };
  var PART = { saw: "seen", went: "gone", ate: "eaten", took: "taken", wrote: "written", began: "begun", drank: "drunk", ran: "run", spoke: "spoken", gave: "given", did: "done" };
  var VOWEL_EX = ["useful", "user", "users", "university", "unique", "unit", "unite", "united", "usual", "usually", "european", "eule", "one", "once"];

  // filter: jangan koreksi jika subjek berada setelah modal/kata bantu
  function auxBefore(text, m) {
    var before = text.slice(Math.max(0, m.index - 16), m.index);
    return /\b(?:\w+n't|will|would|shall|can|could|should|may|might|must|did|to|not|let|see|watch|hear|help|make|want)\s*$/i.test(before);
  }

  var RULES = [].concat(
    mapRules(MISSPELL, "Kemungkinan salah ketik."),
    mapRules(APOS, "Bentuk singkat butuh apostrof."),
    mapRules(UNCOUNT, "Kata benda tak terhitung (uncountable) tidak berbentuk jamak."),
    mapRules({ gonna: "going to", wanna: "want to", gotta: "got to" }, "Singkatan lisan — dalam tulisan formal tulis lengkap."),
    mapRules({ nowdays: "nowadays" }, "Ejaan yang benar: nowadays."),

    // I kapital
    (function () {
      try { var re = /(?<![A-Za-z])i(?=[\s'’.,;:!?)]|$)/g; re.test("i"); return [{ re: re, msg: "Kata ganti 'I' selalu ditulis kapital.", fix: function () { return "I"; } }]; }
      catch (e) { return []; }
    })(),

    // agree tanpa to be
    { re: /\b(am|is|are|was|were)\s+agreed?\b/gi, msg: "'Agree' adalah verbiasa — tanpa to be (“I agree”, bukan “I am agree”).", fix: function (m) { return keepCase(m[0], "agree"); } },

    // agreement: subjek jamak
    { re: /\b(they|we|you|people|students|children)\s+(has|was|is)\b/gi, msg: "Subjek jamak pakai have/were/are.", fix: function (m) { return keepCase(m[0], m[1] + " " + ({ has: "have", was: "were", is: "are" })[m[2].toLowerCase()]); } },
    { re: /\b(they|we|you|people|students|children)\s+doesn't\b/gi, msg: "Subjek jamak pakai don't.", fix: function (m) { return keepCase(m[0], m[1] + " don't"); } },

    // agreement: subjek tunggal orang ke-3
    { re: /\b(he|she|it|everyone|everybody|someone|somebody|anybody|nobody)\s+have\b/gi, msg: "Subjek tunggal orang ke-3: “has”. (Di cek agar “could/must have” tidak tersentu.)", fix: function (m, text) { if (auxBefore(text, m)) return null; return keepCase(m[0], m[1] + " has"); } },
    { re: new RegExp("\\b(he|she|it|everyone|everybody|someone|somebody|anybody|nobody)\\s+(" + Object.keys(V3).join("|") + ")\\b", "gi"), msg: "Subjek tunggal orang ke-3 butuh -s/-es.", fix: function (m, text) { if (auxBefore(text, m)) return null; return keepCase(m[0], m[1] + " " + V3[m[2].toLowerCase()]); } },
    { re: /\b(he|she|it|everyone|everybody|someone|somebody|nobody)\s+don't\b/gi, msg: "Subjek tunggal orang ke-3: “doesn't”.", fix: function (m) { return keepCase(m[0], m[1] + " doesn't"); } },

    // aux + bentuk verba
    { re: new RegExp("\\b(didn't|did not|doesn't|does not|don't|do not)\\s+(" + Object.keys(PAST).join("|") + ")\\b", "gi"), msg: "Setelah do/does/did pakai bentuk dasar verba.", fix: function (m) { return keepCase(m[0], m[0].replace(/\S+$/, PAST[m[2].toLowerCase()])); } },
    { re: new RegExp("\\b(have|has|had)\\s+(" + Object.keys(PART).join("|") + ")\\b", "gi"), msg: "Setelah have/has/had pakai past participle.", fix: function (m) { return keepCase(m[0], m[0].replace(/\S+$/, PART[m[2].toLowerCase()])); } },
    { re: /\b(?:should|could|would|must|might)(?:n't)?\s+of\b/gi, msg: "“should/could/would … of” salah dengar — sebenarnya “… have”.", fix: function (m) { return keepCase(m[0], m[0].replace(/\s+of$/i, " have")); } },

    // negasi ganda
    { re: /\b(don't|doesn't|didn't|can't|cannot|won't|couldn't)\s+(?:[a-z]+\s+)?(no|nothing|nobody|none|never)\b/gi, msg: "Negasi ganda — dalam bahasa Inggris standar cukup satu.", fix: function (m) { var p = m[0].split(/\s+/); p[p.length - 1] = NEGMAP[p[p.length - 1].toLowerCase()]; return keepCase(m[0], p.join(" ")); } },

    // there is + jamak
    { re: /\bthere\s+(is|was)\s+(?:(?:a\s+lot\s+of|lots\s+of|plenty\s+of)\s+)?(many|several|multiple|two|three|four|five|six|seven|eight|nine|ten|\d+|people|students|children|friends|books|things|questions|problems)\b/gi, msg: "Subjek jamak setelah “there” butuh are/were.", fix: function (m) { var v = m[1].toLowerCase() === "is" ? "are" : "were"; return keepCase(m[0], m[0].replace(/is|was/i, v)); } },
    { re: /\btheir\s+(is|are|was|were)\b/gi, msg: "Maksudmu “there” (ada), bukan “their” (mereka punya).", fix: function (m) { return keepCase(m[0], "there " + m[1]); } },
    { re: /\bits\s+(a|an|the)\b/gi, msg: "Maksudmu “it's” (it is), bukan “its” (kepunyaan).", fix: function (m) { return keepCase(m[0], "it's " + m[1]); } },

    // a/an
    { re: /\ba\s+([a-z][\w'-]*)/gi, msg: "Kata berbunyi vokal pakai “an”.", fix: function (m) { var low = m[1].toLowerCase(); if (!/^[aeiou]/.test(low)) return null; for (var i = 0; i < VOWEL_EX.length; i++) { if (low.indexOf(VOWEL_EX[i]) === 0) return null; } return keepCase(m[0], "an " + m[1]); } },
    { re: /\ban\s+((?:uni|us[er]?|eu)[a-z'-]*)/gi, msg: "“an” hanya untuk bunyi vokal — u/eu di sini berbunyi /yu/.", fix: function (m) { var low = m[1].toLowerCase(); for (var i = 0; i < VOWEL_EX.length; i++) { if (low.indexOf(VOWEL_EX[i]) === 0) return keepCase(m[0], "a " + m[1]); } return null; } },
    { re: /\ba\s+(hour\w*|honou?r\w*|onest\w*)/gi, msg: "Huruf “h” di sini tidak dibunyikan — pakai “an”.", fix: function (m) { return keepCase(m[0], "an " + m[1]); } },

    // much/many, more comparative
    { re: /\bmuch\s+(people|students|books|things|friends|words|questions)\b/gi, msg: "Kata jamak terhitung pakai “many”.", fix: function (m) { return keepCase(m[0], "many " + m[1]); } },
    { re: /\bmore\s+(better|worse|faster|slower|bigger|smaller|easier|harder|cheaper|safer)\b/gi, msg: "Jangan gandakan bentuk comparative.", fix: function (m) { return keepCase(m[0], m[1]); } },
    { re: /\b(most|more|very|quite|really|absolutely)\s+(unique|perfect|impossible|essential|necessary|final)\b/gi, msg: "Adjektiva absolut tidak bergradasi.", fix: function (m) { return keepCase(m[0], m[2]); } },
    { re: /\bamount\s+of\s+(people|students|children)\b/gi, msg: "Kata terhitung jamak pakai “number of”.", fix: function (m) { return keepCase(m[0], "number of " + m[1]); } },

    // every / each
    { re: /\bevery\s+(students|things|days|times|books|people)\b/gi, msg: "“Every” diikuti kata tunggal.", fix: function (m) { if (m[1].toLowerCase() === "people") return keepCase(m[0], "everyone"); return keepCase(m[0], "each of the " + m[1]); } },
    { re: /\beach\s+of\s+(them|us|you)\s+are\b/gi, msg: "“Each” adalah subjek tunggal — pakai “is”.", fix: function (m) { return keepCase(m[0], m[0].replace(/are$/i, "is")); } },

    // preposisi
    { re: /\bdepend\s+of\b/gi, msg: "Kolokasi yang benar: “depend on”.", fix: function (m) { return keepCase(m[0], "depend on"); } },
    { re: /\bmarried\s+with\b/gi, msg: "Kolokasi yang benar: “married to”.", fix: function (m) { return keepCase(m[0], "married to"); } },
    { re: /\bin\s+the\s+internet\b/gi, msg: "Yang benar: “on the internet”.", fix: function (m) { return keepCase(m[0], "on the internet"); } },
    { re: /\b(?:on|in|at)\s+yesterday\b/gi, msg: "“Yesterday” tak butuh preposisi.", fix: function (m) { return "yesterday"; } },
    { re: /\b(?:in|at)\s+(last|next|this)\s+(week|month|year|semester)\b/gi, msg: "Tidak butuh preposisi di sini.", fix: function (m) { return keepCase(m[0], m[1] + " " + m[2]); } },
    { re: /\b(?:in|at)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, msg: "Nama hari pakai “on”.", fix: function (m) { return keepCase(m[0], "on " + m[1]); } },
    { re: /\bexplain\s+(me|us)\b/gi, msg: "Yang benar: “explain to me”.", fix: function (m) { return keepCase(m[0], "explain to " + m[1]); } },
    { re: /\bask\s+to\s+(him|her|them|me|us)\b/gi, msg: "“Ask” langsung diikuti objek tanpa “to”.", fix: function (m) { return keepCase(m[0], "ask " + m[1]); } },
    { re: /\blisten\s+(me|him|her|them|us)\b/gi, msg: "Yang benar: “listen to …”.", fix: function (m) { return keepCase(m[0], "listen to " + m[1]); } },
    { re: /\bdiscuss\s+about\b/gi, msg: "“Discuss” langsung diikuti objek — tanpa “about”.", fix: function (m) { return keepCase(m[0], "discuss"); } },
    { re: /\benter\s+to\b/gi, msg: "“Enter” langsung diikuti objek.", fix: function (m) { return "enter"; } },

    // tanda baca & kapital
    { re: /(?:^|[.!?]\s+)([a-z])/g, msg: "Awal kalimat ditulis kapital.", fix: function (m) { return m[0].replace(/[a-z]/, function (c) { return c.toUpperCase(); }); } },
    { re: /\s+([,.!?;:])/g, msg: "Tidak ada spasi sebelum tanda baca.", fix: function (m) { return m[1]; } },
    { re: /([,.!?;:])\1+/g, msg: "Tanda baca cukup satu.", fix: function (m) { return m[1]; } },
    { re: /,([A-Za-z])/g, msg: "Berikan spasi setelah koma.", fix: function (m) { return m[0].replace(",", ", "); } },
    { re: /  +|\t+/g, msg: "Spasi ganda sebaiknya dirapikan jadi satu.", fix: function () { return " "; } }
  );

  function collectLocalIssues(text) {
    var found = [], used = [];
    RULES.forEach(function (rule) {
      rule.re.lastIndex = 0;
      var m;
      while ((m = rule.re.exec(text)) !== null) {
        if (m[0].length === 0) { rule.re.lastIndex++; continue; }
        var repl = rule.fix ? rule.fix(m, text) : null;
        if (repl === null || repl === m[0]) { continue; }
        var s = m.index, e = m.index + m[0].length;
        if (used.some(function (u) { return s < u[1] && e > u[0]; })) continue; // jangan tumpang tindih
        used.push([s, e]);
        found.push({ start: s, end: e, wrong: m[0], fix: repl, msg: rule.msg, src: "local", stale: false });
      }
    });
    // titik penutup
    var tt = text.replace(/\s+$/, "");
    if (tt.length > 25 && /[A-Za-z'"]$/.test(tt)) {
      found.push({ start: tt.length, end: tt.length, wrong: "(akhir teks)", fix: ".", msg: "Kalimat pernyataan diakhiri titik.", src: "local", stale: false });
    }
    found.sort(function (a, b) { return a.start - b.start; });
    return found;
  }

  function spliceIssue(text, iss) {
    return text.slice(0, iss.start) + iss.fix + text.slice(iss.end);
  }

  // cek online LanguageTool, dipakai fitur corrector & journal — kembalikan daftar issue
  function fetchLTIssues(raw) {
    var text = raw.trim();
    var base = raw.indexOf(text); // jaga offset bila ada leading whitespace
    return fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: text, language: "en-US" }).toString()
    }).then(function (r) { return r.json(); }).then(function (data) {
      return (data.matches || []).map(function (x) {
        return {
          start: x.offset + base,
          end: x.offset + x.length + base,
          wrong: text.substr(x.offset, x.length),
          fix: x.replacements && x.replacements[0] ? x.replacements[0].value : "",
          msg: x.message + (x.rule && x.rule.id ? " [" + x.rule.id + "]" : ""),
          src: "lt", stale: false
        };
      });
    });
  }

  function runLocalCheck() {
    var text = corrText.value;
    corrLastWasLT = false;
    corrIssues = collectLocalIssues(text);
    renderCorrIssues(text);
  }

  function runLTCheck() {
    var raw = corrText.value;
    if (!raw.trim()) { toast("Tulis teks dulu."); return; }
    var btn = $("#btnCheckOnline");
    btn.disabled = true; btn.textContent = "Memeriksa…";
    $("#corrSummary").textContent = "Menghubungi LanguageTool…";
    fetchLTIssues(raw).then(function (issues) {
      corrIssues = issues;
      corrLastWasLT = true;
      renderCorrIssues(raw);
      btn.disabled = false; btn.textContent = "Periksa online";
      if (!corrIssues.length) toast("LanguageTool tidak menemukan masalah 🎉");
    }).catch(function () {
      btn.disabled = false; btn.textContent = "Periksa online";
      toast("Gagal menghubungi LanguageTool — periksa koneksi internet.");
      $("#corrSummary").textContent = "";
    });
  }

  function renderCorrIssues(text) {
    var el = $("#corrIssues"); el.innerHTML = "";
    var nLocal = corrIssues.filter(function (i) { return i.src === "local"; }).length;
    var nLT = corrIssues.length - nLocal;
    $("#corrSummary").textContent = corrIssues.length
      ? corrIssues.length + " saran ditemukan" + (nLocal ? " — " + nLocal + " offline" : "") + (nLT ? " — " + nLT + " online" : "")
      : "";
    $("#corrTools").classList.toggle("hidden", !corrIssues.length);

    if (!corrIssues.length) {
      el.innerHTML = text.trim()
        ? '<div class="ok-note">Tidak ada masalah yang ditemukan' + (corrLastWasLT ? "" : " oleh aturan offline") + ' — tulismu bagus! 🎉</div>'
        : "";
      return;
    }
    corrIssues.forEach(function (iss, idx) {
      var fs = Math.max(0, iss.start - 40), fe = Math.min(text.length, iss.end + 40);
      var ctx = esc(text.slice(fs, iss.start)) + '<span class="hl">' + esc(text.slice(iss.start, iss.end) || "…") + "</span>" + esc(text.slice(iss.end, fe));
      var li = document.createElement("div");
      li.className = "issue" + (iss.stale ? " stale" : "");
      li.innerHTML =
        '<div class="issue-main" style="flex:1;">' +
        '<span class="tag src' + (iss.src === "lt" ? " lt" : "") + '">' + (iss.src === "lt" ? "LanguageTool" : "Offline") + "</span>" +
        (iss.fix ? "<s style='color:var(--red)'>" + esc(iss.wrong) + "</s>" : "") +
        (iss.fix ? " → <b class='w-ok'>" + esc(iss.fix) + "</b> " : " ") +
        "<span class='meta'>" + esc(iss.msg) + "</span>" +
        "</div>" +
        "<div class='issue-ctx'>" + ctx + "</div>" +
        (iss.fix ? '<button class="btn sm primary issue-apply" data-i="' + idx + '"' + (iss.stale ? " disabled" : "") + ">Terapkan</button>" : "");
      el.appendChild(li);
    });
  }

  $("#btnCheckLocal").addEventListener("click", runLocalCheck);
  $("#btnCheckOnline").addEventListener("click", runLTCheck);

  $("#corrIssues").addEventListener("click", function (e) {
    var b = e.target.closest(".issue-apply");
    if (!b || b.disabled) return;
    var iss = corrIssues[+b.dataset.i];
    if (!iss) return;
    corrText.value = spliceIssue(corrText.value, iss);
    saveCorrDraft();
    if (iss.src === "local") { runLocalCheck(); toast("Saran diterapkan — memeriksa ulang"); }
    else { corrIssues.forEach(function (x) { if (x !== iss) x.stale = true; }); renderCorrIssues(corrText.value); toast("Diterapkan. Jalankan periksa ulang untuk saran lainnya."); }
  });

  // terapkan semua perbaikan lokal secara berantai (cascade) sampai bersih
  function applyAllLocalIssues(text) {
    var total = 0, round;
    for (round = 0; round < 5; round++) {
      var iss = collectLocalIssues(text);
      var valid = iss.filter(function (x) { return x.fix; }).sort(function (a, b) { return b.start - a.start; });
      if (!valid.length) break;
      var used = [], n = 0;
      valid.forEach(function (x) {
        if (used.some(function (u) { return x.start < u[1] && x.end > u[0]; })) return;
        text = spliceIssue(text, x);
        used.push([x.start, x.end]);
        n++;
      });
      if (!n) break;
      total += n;
    }
    return { text: text, count: total };
  }

  $("#btnApplyAll").addEventListener("click", function () {
    var res = applyAllLocalIssues(corrText.value);
    corrText.value = res.text;
    saveCorrDraft();
    runLocalCheck();
    toast(res.count + " perbaikan diterapkan ✅");
  });

  function copyText(t, ok) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(ok, function () { fallbackCopy(t); ok(); });
    } else { fallbackCopy(t); ok(); }
  }
  function fallbackCopy(t) {
    var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove();
  }
  $("#btnCorrCopy").addEventListener("click", function () {
    copyText(corrText.value, function () { toast("Teks tersalin ke clipboard"); });
  });

  // --- sumber teks
  var corrSave = debounce(function () { save("draftCorr", corrText.value); }, 400);
  function saveCorrDraft() { save("draftCorr", corrText.value); }
  corrText.addEventListener("input", corrSave);
  corrText.value = load("draftCorr", "");

  function corrSetOrigin(o) {
    corrOrigin = o;
    $("#corrNote").textContent = o === "cycle" ? "Sumber: draft Cycle — hasil akhir bisa dikirim kembali." :
      o === "journal" ? "Sumber: entri journal terakhir." : "";
    $("#btnToCycle").classList.toggle("hidden", o !== "cycle");
  }
  $("#corrLoad").addEventListener("click", function () {
    var v = $("#corrSource").value;
    if (v === "cycle") {
      var d = $("#cyDraft").value.trim();
      if (!d) { toast("Draft Cycle masih kosong."); return; }
      corrText.value = d; corrSetOrigin("cycle");
    } else if (v === "journal") {
      var j = load("journal", []);
      if (!j.length) { toast("Belum ada entri journal."); return; }
      corrText.value = j[0].text; corrSetOrigin("journal");
    } else { corrSetOrigin("none"); }
    saveCorrDraft();
    toast("Teks dimuat — klik “Periksa offline” atau “Periksa online”.");
  });
  corrSetOrigin(load("corrOriginSaved", "none") === "cycle" ? "cycle" : "none");
  save("corrOriginSaved", corrOrigin);

  $("#btnToCycle").addEventListener("click", function () {
    if (!corrText.value.trim()) { toast("Teksnya kosong."); return; }
    $("#cyFixed").value = corrText.value;
    save("draftCycle", { draft: $("#cyDraft").value, fixed: corrText.value, rewrite: $("#cyRewrite").value });
    toast("Terkirim ke langkah 2 (Corrected) ✅");
    goto("cycle");
  });
  $("#btnCycleToCorrector").addEventListener("click", function () {
    var d = $("#cyDraft").value.trim();
    if (!d) { toast("Tulis draft di langkah 1 dulu."); return; }
    corrText.value = d; saveCorrDraft(); corrSetOrigin("cycle");
    save("corrOriginSaved", "cycle");
    goto("corrector");
  });

  /* ============================================================
     akun & sinkronisasi cloud (Firebase Auth + Firestore)
     Layout Firestore:
       users/{uid}                     → doc meta (field "meta.{key}")
       users/{uid}/lists/{key}         → readings | cycles | errors ({ data:[...] })
       users/{uid}/journal/{entryId}   → 1 doc per entri journal
     Draft (draftJournal/draftCycle/draftCorr) tetap lokal per perangkat.
     Data ditulis melalui save() → cache localStorage + write-through cloud.
     ============================================================ */
  var META_KEYS = ["settings", "acts", "copyBest", "promptIdx"];
  var LIST_KEYS = ["readings", "cycles", "errors"];

  var cloudConfigured = typeof firebase !== "undefined" && typeof FIREBASE_CONFIG !== "undefined" && !!FIREBASE_CONFIG.apiKey;
  var cloudReady = false;      // true setelah init — baru save() boleh menyentuh cloud
  var syncing = false;         // pull/push besar berjalan — write-through dipause
  var fbUser = null;
  var auth = null, db = null;
  var cloudJournalIdx = {};    // id → JSON entri, kondisi cloud terakhir yang diketahui

  function markDirty(k) { var d = load("syncDirty", {}); d[k] = 1; saveLocal("syncDirty", d); }
  function clearDirty(k) { var d = load("syncDirty", {}); delete d[k]; saveLocal("syncDirty", d); }
  function clearAllDirty() { saveLocal("syncDirty", {}); }
  function dirtyKeys() { return Object.keys(load("syncDirty", {})).filter(function (k) { return META_KEYS.indexOf(k) > -1 || LIST_KEYS.indexOf(k) > -1 || k === "journal"; }); }

  // write-through: dipanggil dari save() untuk setiap perubahan data
  function cloudSave(k, v) {
    if (!cloudReady || syncing) return;
    if (k !== "journal" && META_KEYS.indexOf(k) < 0 && LIST_KEYS.indexOf(k) < 0) return;
    if (!fbUser) { markDirty(k); return; }   // belum login / logout → antri
    pushKeys([k]).then(function () { renderAccount(); })
      .catch(function () { markDirty(k); renderAccount(); });
  }

  function dotObj(k, v) { var o = {}; o["meta." + k] = v; return o; }
  function indexById(list) { var m = {}; list.forEach(function (e) { if (e && e.id) m[e.id] = e; }); return m; }

  // siapkan satu batch tulis untuk daftar kunci
  function buildPushBatch(keys) {
    var ur = db.collection("users").doc(fbUser.uid);
    var lists = ur.collection("lists");
    var batch = db.batch();
    keys.forEach(function (k) {
      var v = load(k, null);
      if (v === null || v === undefined) { clearDirty(k); return; }
      if (k === "journal") { pushJournalToBatch(batch, ur, v); clearDirty(k); }
      else if (LIST_KEYS.indexOf(k) > -1) { batch.set(lists.doc(k), { data: v }); clearDirty(k); }
      else { batch.set(ur, dotObj(k, v), { merge: true }); clearDirty(k); }   // meta
    });
    return batch;
  }
  // diff entri journal: tulis yang berubah/hilang saja
  function pushJournalToBatch(batch, ur, list) {
    var jr = ur.collection("journal");
    var seen = {};
    list.forEach(function (e) {
      if (!e || !e.id) return;
      seen[e.id] = true;
      var json = JSON.stringify(e);
      if (cloudJournalIdx[e.id] !== json) {
        batch.set(jr.doc(e.id), e);
        cloudJournalIdx[e.id] = json;
      }
    });
    Object.keys(cloudJournalIdx).forEach(function (id) {
      if (!seen[id]) { batch.delete(jr.doc(id)); delete cloudJournalIdx[id]; }
    });
  }
  function pushKeys(keys) { return buildPushBatch(keys).commit(); }

  function flushDirty() {
    if (!fbUser || syncing) return;
    var keys = dirtyKeys();
    if (keys.length) {
      pushKeys(keys).then(function () { renderAccount(); })
        .catch(function () {
          keys.forEach(function (k) { markDirty(k); });
          toast("Sinkron tertunda (offline?) — akan dicoba lagi");
          renderAccount();
        });
    }
  }

  // gabung journal: union per id; same account → salinan lokal menang jika ada dua versi
  function mergeJournal(local, cloudArr, sameAccount) {
    var localIdx = indexById(local), out = [];
    cloudArr.forEach(function (c) {
      if (c && c.id) localIdx[c.id] = (localIdx[c.id] && sameAccount) ? localIdx[c.id] : c;
    });
    Object.keys(localIdx).forEach(function (id) { out.push(localIdx[id]); });
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return out;
  }

  function pullAll() {
    if (!fbUser) return;
    syncing = true;
    var ur = db.collection("users").doc(fbUser.uid);
    var sameAccount = load("lastUid", null) === fbUser.uid;
    Promise.all([ur.get(), ur.collection("lists").get(), ur.collection("journal").get()])
      .then(function (res) {
        var udoc = res[0], listsSnap = res[1], jSnap = res[2];
        var cloud = { meta: {}, lists: {}, journal: [] };
        cloudJournalIdx = {};
        if (udoc.exists) {
          var m = udoc.get("meta") || {};
          META_KEYS.forEach(function (k) { if (m[k] !== undefined && m[k] !== null) cloud.meta[k] = m[k]; });
        }
        listsSnap.forEach(function (d) { cloud.lists[d.id] = d.data().data; });
        jSnap.forEach(function (d) {
          var e = d.data(); cloud.journal.push(e); cloudJournalIdx[e.id] = JSON.stringify(e);
        });

        // ---------- journal: union ----------
        var localJ = load("journal", []);
        var mergedJ = mergeJournal(localJ, cloud.journal, sameAccount);

        // ---------- meta ----------
        var ca = cloud.meta.acts, cb = cloud.meta.copyBest, cs = cloud.meta.settings, cp = cloud.meta.promptIdx;
        if (sameAccount) {
          // simpan preferensi/penanda lokal, gabung entri aktivitas & rekaman
          if (ca) {
            var la = load("acts", {});
            Object.keys(ca).forEach(function (iso) { if (!la[iso] || !Object.keys(la[iso]).length) la[iso] = ca[iso]; });
            saveLocal("acts", la);
          }
          if (cb) {
            var lc = load("copyBest", {});
            Object.keys(cb).forEach(function (k) { if (lc[k] === undefined || cb[k] > lc[k]) lc[k] = cb[k]; });
            saveLocal("copyBest", lc);
          }
        } else {
          if (ca) saveLocal("acts", ca);
          else if (!Object.keys(load("acts", {})).length) saveLocal("acts", {});
          if (cb && Object.keys(cb).length) saveLocal("copyBest", cb);
          if (cs) saveLocal("settings", cs);                          // akun lain: cloud menang
          if (cp !== undefined) saveLocal("promptIdx", cp);
        }
        if (cs && sameAccount) { /* pertahankan settings lokal (preferensi perangkat) */ }

        // ---------- lists: cloud menang bila ada ----------
        LIST_KEYS.forEach(function (k) {
          if (cloud.lists[k] !== undefined) saveLocal(k, cloud.lists[k]);
        });

        // ---------- upload bagian lokal yang belum ada di cloud ----------
        var batch = db.batch();
        mergedJ.forEach(function (e) {
          if (!cloudJournalIdx[e.id]) {
            batch.set(ur.collection("journal").doc(e.id), e);
            cloudJournalIdx[e.id] = JSON.stringify(e);
          }
        });
        META_KEYS.forEach(function (k) {
          var cloudVal = cloud.meta[k];
          if (cloudVal === undefined) {
            var v = load(k, null);
            if (v !== null && v !== undefined) batch.set(ur, dotObj(k, v), { merge: true });
          }
        });
        LIST_KEYS.forEach(function (k) {
          if (cloud.lists[k] === undefined) {
            var v = load(k, null);
            if (v && v.length) batch.set(ur.collection("lists").doc(k), { data: v });
          }
        });

        saveLocal("journal", mergedJ);
        return batch.commit().catch(function () {
          // gagal → paksa push ulang penuh pada flush berikutnya
          cloudJournalIdx = {};
          ["journal"].concat(LIST_KEYS, META_KEYS).forEach(markDirty);
        });
      })
      .then(function () {
        saveLocal("lastUid", fbUser.uid);
        clearAllDirty();
        syncing = false;
        afterSync();
        flushDirty();
        toast("Data tersinkron dari akunmu ✓");
      })
      .catch(function (err) {
        syncing = false;
        renderAccount();
        console.error("pullAll gagal", err);
        toast("Gagal sinkron — periksa Firestore & internet");
      });
  }

  function afterSync() {
    // muat ulang state global & refresh semua tampilan
    settings = load("settings", { name: "", goal: 150, theme: "dark" });
    acts = load("acts", {});
    copyBest = load("copyBest", {});
    promptIdx = load("promptIdx", 0);
    if (promptIdx < 0 || promptIdx >= PROMPTS.length) promptIdx = 0;
    document.documentElement.dataset.theme = settings.theme || "dark";
    $("#setName").value = settings.name || "";
    $("#setGoal").value = settings.goal || 150;
    themeSegRender();
    $("#promptTag").textContent = PROMPTS[promptIdx][0];
    $("#promptText").textContent = PROMPTS[promptIdx][1];
    jCount(); jRenderDraftFlag();
    renderJournalList(); renderTarget(); showBest();
    renderReadingList(); renderCycleList(); renderErrStats(); renderErrList();
    renderStreak(); renderDashboard(); renderAccount();
  }

  /* ============================================================
     sinkron cepat via GitHub (gist privat — tanpa server sendiri)
     - token PAT scope=gist; data disimpan sebagai gist privat milikmu
     - file "ewt-progress.json" = seluruh snapshot data utama
     - push otomatis ±7 detik setelah ada perubahan; pull di hubungkan/awal
     ============================================================ */
  var GH_API = "https://api.github.com";
  var KC_FILE = "ewt-progress.json";
  var KC_SYNC_KEYS = ["journal", "readings", "cycles", "errors", "acts", "copyBest", "settings", "promptIdx"];
  var kcReady = false;
  var kcDirty = false;
  var kcBusy = false;

  function kcToken() { var t = load("kcToken", ""); return typeof t === "string" ? t.trim() : ""; }

  function kcNoticeSave(k) {
    if (!kcReady) return;
    if (KC_SYNC_KEYS.indexOf(k) < 0) return;
    if (!kcToken()) return;
    kcDirty = true;
    kcPushSoon();
  }

  function kcSnapshot() {
    var o = { app: "ewt", ts: new Date().toISOString(), data: {} };
    KC_SYNC_KEYS.forEach(function (k) {
      var v = load(k, null);
      if (v !== null && v !== undefined) o.data[k] = v;
    });
    return o;
  }

  function kcApply(snap) {
    var d = (snap && snap.data) || {};
    saveLocal("journal", mergeJournal(load("journal", []), d.journal || [], true));
    if (d.acts) {
      var la = load("acts", {});
      Object.keys(d.acts).forEach(function (iso) { if (!la[iso] || !Object.keys(la[iso]).length) la[iso] = d.acts[iso]; });
      saveLocal("acts", la);
    }
    if (d.copyBest) {
      var lc = load("copyBest", {});
      Object.keys(d.copyBest).forEach(function (k) { if (lc[k] === undefined || d.copyBest[k] > lc[k]) lc[k] = d.copyBest[k]; });
      saveLocal("copyBest", lc);
    }
    ["readings", "cycles", "errors", "settings", "promptIdx"].forEach(function (k) {
      if (d[k] !== undefined && d[k] !== null) saveLocal(k, d[k]);
    });
  }

  // --- transport API gist ---
  function ghHeaders(tok) { return { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + tok }; }

  // fetch dengan batas waktu — tanpa ini, jaringan macet bikin status sinkron terkunci
  var KCFETCH_MS = 20000, kcBusyAt = 0;
  function ghFetch(url, opts) {
    opts = opts || {};
    var msg = "";
    if (typeof AbortController === "undefined") return fetch(url, opts);
    var ctrl = new AbortController();
    opts.signal = ctrl.signal;
    var timer = window.setTimeout(function () { ctrl.abort(); }, KCFETCH_MS);
    return fetch(url, opts).then(function (r) { window.clearTimeout(timer); return r; }, function (e) {
      window.clearTimeout(timer);
      msg = (e && e.name === "AbortError" || !navigator.onLine) ? "batas waktu/hilang koneksi" : (e && e.message) || "jaringan";
      throw new Error(msg);
    });
  }
  // watchdog: lepas kunci macet bila opsi berjalan >45 detik
  function kcUnstick() {
    if (kcBusy && Date.now() - kcBusyAt > 45000) { kcBusy = false; return true; }
    return false;
  }

  function kcListGists(tok) {
    return ghFetch(GH_API + "/gists?per_page=100", { headers: ghHeaders(tok) }).then(function (r) {
      if (!r.ok) { return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(r.status + " " + (j.message || "")); }); }
      return r.json();
    });
  }
  function kcFindGist(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].files && list[i].files[KC_FILE]) return list[i].id;
    }
    return null;
  }
  function kcCreateGist(tok) {
    var files = {};
    files[KC_FILE] = { content: JSON.stringify({ app: "ewt", ts: "", data: {} }) };
    return ghFetch(GH_API + "/gists", {
      method: "POST", headers: ghHeaders(tok),
      body: JSON.stringify({ description: "Writing Trainer — data sinkron (dibuat otomatis)", public: false, files: files })
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(r.status + " " + (j.message || "")); });
      return r.json();
    }).then(function (g) { saveLocal("kcGistId", g.id); return g.id; });
  }
  function kcGetGist(tok, id) {
    return ghFetch(GH_API + "/gists/" + id, { headers: ghHeaders(tok) }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(r.status + " " + (j.message || "")); });
      return r.json();
    });
  }
  // isi kop file gist → string JSON atau null bila belum ada data
  function kcGistContent(g) {
    var f = g && g.files && g.files[KC_FILE];
    if (!f || !f.content || !f.content.trim() || f.content.trim() === "{}") return null;
    return f.truncated && f.raw_url
      ? ghFetch(f.raw_url, { headers: ghHeaders(kcToken()) }).then(function (r) { if (!r.ok) throw new Error("" + r.status); return r.text(); })
      : Promise.resolve(f.content);
  }
  function kcPatchContent(tok, id, content) {
    var files = {}; files[KC_FILE] = { content: content };
    return ghFetch(GH_API + "/gists/" + id, {
      method: "PATCH", headers: ghHeaders(tok),
      body: JSON.stringify({ files: files })
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(r.status + " " + (j.message || "")); });
      return true;
    });
  }
  // pastikan gist ada: sink detail dari cache, cari di daftar, atau buat baru
  // pastikan gist ada: id dari cache → cari di daftar gist → atau buat baru
  function kcEnsureGist(tok) {
    var id = load("kcGistId", "");
    if (id) return Promise.resolve(id);
    return kcListGists(tok).then(function (l) {
      var found = kcFindGist(l);
      if (found) { saveLocal("kcGistId", found); return found; }
      return kcCreateGist(tok);
    });
  }

  function kcPush(manual, cb) {
    var tok = kcToken();
    if (!tok) { if (manual) toast("Token GitHub belum dihubungkan."); if (cb) cb(false); return; }
    if (kcUnstick()) toast("Sinkron yang macet dilepaskan — dicoba lagi.");
    if (kcBusy) { if (manual) toast("Sinkron sedang berjalan…"); if (cb) cb(false); return; }
    kcBusy = true; kcBusyAt = Date.now();
    var kp = $("#kcStatus");
    if (kp) kp.textContent = "Mengirim ke gist…";
    kcEnsureGist(tok).then(function (id) {
      return kcPatchContent(tok, id, JSON.stringify(kcSnapshot())).catch(function (e) {
        if (String(e).indexOf("404") === 0) { saveLocal("kcGistId", ""); return kcEnsureGist(tok).then(function (id2) { return kcPatchContent(tok, id2, JSON.stringify(kcSnapshot())); }); }
        throw e;
      });
    }).then(function () {
      kcBusy = false;
      kcDirty = false;
      saveLocal("kcLastPush", new Date().toISOString());
      renderAccount();
      if (manual) toast("Data terkirim ke gist ✓");
      if (cb) cb(true);
    }).catch(function (e) {
      kcBusy = false;
      console.warn("kcPush:", e);
      if (String(e).indexOf("401") > -1) toast("Token GitHub ditolak (401) — buat token baru lalu hubungkan lagi.");
      else if (String(e).indexOf("403") > -1) toast("Gist ditolak (403) — jalankan tautan token dengan sidang gist sudah aktif.");
      else if (manual) toast("Kirim gagal — " + e);
      renderAccount();
      if (cb) cb(false);
    });
  }
  var kcPushSoon = debounce(function () { kcPush(false); }, 7000);

  // pull merge-commit: tarik → gabung → kirim hasil merge ke gist
  function kcPull(opts) {
    opts = opts || {};
    var tok = kcToken();
    if (!tok) { if (!opts.silent) toast("Token GitHub belum dihubungkan."); return; }
    if (kcUnstick()) toast("Sinkron yang macet dilepaskan — dicoba lagi.");
    if (kcBusy) { if (!opts.silent) toast("Sinkron sedang berjalan…"); return; }
    kcBusy = true; kcBusyAt = Date.now();
    if (!opts.silent) toast("Mengambil data dari gist…");
    var kp = $("#kcStatus");
    if (kp) kp.textContent = "Mengambil dari gist…";

    var knownId = load("kcGistId", "");
    var find = knownId
      ? kcGetGist(tok, knownId)
      : kcListGists(tok).then(function (l) {
        var id = kcFindGist(l);
        if (!id) { return { gist: null, id: null }; }
        saveLocal("kcGistId", id);
        return kcGetGist(tok, id).then(function (g) { return { gist: g, id: id }; });
      });

    find.then(function (res) {
      kcBusy = false;
      if (!res) { // token valid, gist belum ada → data lokal jadi tunggal
        renderAccount();
        if (!opts.silent) toast("Gist belum ada — data lokal dikirim ✓");
        kcPush(false, null);
        if (opts.onDone) opts.onDone(true);
        return;
      }
      var g = res.gist || res; // dari kcGetGist → langsung objek gist; dari pencarian → {gist, id}
      kcGistContent(g).then(function (raw) {
        if (raw === null) {
          // gist masih kosong
          kcPush(false, null);
          renderAccount();
          if (!opts.silent) toast("Gist masih kosong — data lokal dikirim ✓");
          if (opts.onDone) opts.onDone(true);
          return;
        }
        var obj = null;
        try { obj = JSON.parse(raw); } catch (e) { obj = null; }
        if (!obj || obj.app !== "ewt" || typeof obj.data !== "object") {
          renderAccount();
          toast("Isi gist tidak dikenali — bukan data aplikasi ini.");
          if (opts.onDone) opts.onDone(false);
          return;
        }
        kcApply(obj);
        afterSync();
        saveLocal("kcLastPull", new Date().toISOString());
        kcPush(false, null);           // commit hasil merge ke gist
        renderAccount();
        if (!opts.silent) toast("Data terambil dari gist ✓");
        if (opts.onDone) opts.onDone(true);
      }).catch(function (e) {
        kcBusy = false;
        console.warn("kcPull:", e);
        renderAccount();
        if (String(e).indexOf("404") > -1) { saveLocal("kcGistId", ""); toast("Gist tidak ditemukan (404) — akan dibuat ulang saat kirim."); }
        else if (!opts.silent) toast("Gagal membaca gist — " + e);
      });
    }).catch(function (e) {
      kcBusy = false;
      console.warn("kcPull:", e);
      renderAccount();
      var msg = String(e);
      if (msg.indexOf("404") > -1) {
        saveLocal("kcGistId", "");
        if (!opts.silent) toast("Gist tidak ada lagi (404) — dibuat ulang saat kirim.");
        window.setTimeout(function () { kcPush(false, null); }, 0);   // buat ulang gist dengan data lokal
      }
      else if (msg.indexOf("401") > -1) toast("Token GitHub ditolak (401) — buat token baru lalu hubungkan lagi.");
      else if (!opts.silent) toast("Tarik gagal — " + e);
      else toast("Tarik tertunda — periksa internet.");
    });
  }

  function kcConnect(raw) {
    var tok = (raw || "").trim();
    if (!tok) { toast("Tempel token dulu — klik „Buat token” untuk membuatnya."); return; }
    toast("Memeriksa token…");
    kcListGists(tok).then(function (l) {
      saveLocal("kcToken", tok);
      var id = kcFindGist(l);
      if (id) { saveLocal("kcGistId", id); }
      renderAccount();
      if (id) { kcPull({ silent: false }); }
      else {
        kcPush(true, function (ok) { if (ok) toast("Terhubung ✓ — gist privat dibuat otomatis"); });
      }
    }).catch(function (e) {
      console.warn("kcConnect:", e);
      toast("Token ditolak GitHub — pastikan disalin lengkap & scope gist aktif.");
    });
    $("#kcInput").value = "";
  }

  /* --- UI halaman akun bagian sinkron cepat --- */
  $("#btnKcConnect").addEventListener("click", function () { kcConnect($("#kcInput").value); });
  $("#kcInput").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#btnKcConnect").click(); } });
  $("#btnKcCopy").addEventListener("click", function () { copyText(load("kcGistId", ""), function () { toast("ID gist disalin"); }); });
  $("#btnKcPush").addEventListener("click", function () { kcPush(true); });
  $("#btnKcPull").addEventListener("click", function () { kcPull({ silent: false }); });
  $("#btnKcDisconnect").addEventListener("click", function () {
    confirmBox("Putuskan sinkron gist?", "Data di gist tidak dihapus — salinan lokal di perangkat ini juga dipertahankan. Hubungkan lagi kapan saja.", function () {
      saveLocal("kcToken", "");
      saveLocal("kcGistId", "");
      kcDirty = false;
      renderAccount();
      toast("Terputus — data lokal dipertahankan");
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && kcReady && kcDirty && kcToken()) kcPush(false, null);
  });
  // pembersih otomatis: kalau ada opsi yang macet (mis. jaringan mati di tengah fetch)
  window.setInterval(function () { if (kcUnstick() && !document.hidden) renderAccount(); }, 20000);
  // aktif setelah semua definisi — save() yang jalan sebelum titik ini (migration,
  // init awal) sengaja tidak tersinkron agar cloud tidak di-spam saat startup
  kcReady = true;

  /* ---------------- UI halaman akun ---------------- */
  function renderAccount() {
    // --- kode sinkron (nol setup) ---
    var tok = kcToken();
    $("#kcOff").classList.toggle("hidden", !!tok);
    $("#kcOn").classList.toggle("hidden", !tok);
    if (tok) {
      var gid = load("kcGistId", "");
      $("#kcCodeLabel").textContent = gid ? "gist privat • " + gid.slice(0, 8) + "…" : "GitHub berjalan (gist dibuat saat kirim pertama)";
      var lp = load("kcLastPush", null);
      var optOff = navigator.onLine === false ? " • offline — perubahan menyusul" : "";
      $("#kcStatus").textContent =
        "Sinkron otomatis aktif — perubahan terkirim ±7 detik setelah tersimpan." +
        (lp ? " Terakhir kirim: " + new Date(lp).toLocaleTimeString("id-ID") : "") + optOff;
    }
    // --- Google/Firebase (opsional) ---
    $("#accNoConfig").classList.toggle("hidden", cloudConfigured);
    if (!cloudConfigured) return;
    var signed = !!fbUser;
    $("#accSignedOut").classList.toggle("hidden", signed);
    $("#accSignedIn").classList.toggle("hidden", !signed);
    if (!signed) return;
    $("#accName").textContent = fbUser.displayName || fbUser.email || "Pengguna";
    $("#accEmail").textContent = fbUser.email || "";
    var ph = $("#accPhoto");
    if (fbUser.photoURL) { ph.src = fbUser.photoURL; ph.style.display = ""; } else { ph.style.display = "none"; }
    var pend = dirtyKeys().length;
    $("#accSync").textContent =
      "Sinkron otomatis aktif • perubahan ditulis ke Firestore saat data berubah" +
      (pend ? " • " + pend + " kelompok data menunggu (kembali online?) ✔" : "");
  }

  function initCloud() {
    if (!cloudConfigured) { renderAccount(); return; }
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) {
      console.error("Firebase init gagal", e);
      toast("Firebase gagal dimuat — mode lokal tetap jalan");
      renderAccount();
      return;
    }

    auth.onAuthStateChanged(function (u) {
      fbUser = u;
      if (u) {
        pullAll();
      } else {
        renderAccount();
      }
    });

    $("#btnGoogleLogin").addEventListener("click", function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      auth.signInWithPopup(provider).catch(function (e) {
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
          auth.signInWithRedirect(provider);
        } else if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
          toast("Gagal masuk: " + e.code);
        }
        renderAccount();
      });
    });

    $("#btnLogout").addEventListener("click", function () {
      confirmBox("Keluar dari akun?", "Data yang sudah tersinkron tetap aman di cloud. Salinan lokal di browser ini dipertahankan, dan akan dipakai lagi kalau kamu masuk kembali.", function () {
        auth.signOut().then(function () {
          clearAllDirty();
          renderAccount();
          toast("Keluar — data lokal dipertahankan");
        });
      });
    });

    $("#btnSyncNow").addEventListener("click", function () {
      if (!fbUser) { toast("Belum masuk."); return; }
      if (syncing) { toast("Sinkron sedang berjalan…"); return; }
      toast("Menarik data terbaru dari cloud…");
      flushDirty();
      pullAll();
    });

    window.addEventListener("online", flushDirty);
    cloudReady = true;
    renderAccount();
  }


  $("#setName").value = settings.name || "";
  $("#setGoal").value = settings.goal || 150;
  function themeSegRender() {
    $$("#themeSeg .seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.t === settings.theme); });
  }
  $$("#themeSeg .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      settings.theme = b.dataset.t; themeSegRender();
      document.documentElement.dataset.theme = settings.theme;
      save("settings", settings);
    });
  });
  themeSegRender();
  $("#btnSaveSettings").addEventListener("click", function () {
    settings.name = $("#setName").value.trim();
    var g = parseInt($("#setGoal").value, 10);
    settings.goal = (g >= 20 && g <= 1000) ? g : 150;
    save("settings", settings);
    document.documentElement.dataset.theme = settings.theme;
    renderDashboard(); jCount();
    toast("Pengaturan tersimpan");
  });

  function downloadFile(name, content) {
    var blob = new Blob([content], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  $("#btnExportAll").addEventListener("click", function () {
    var out = { app: "english-writing-trainer", version: 2, exportedAt: new Date().toISOString(), data: {} };
    ["settings", "journal", "readings", "cycles", "errors", "acts", "copyBest"].forEach(function (k) { out.data[k] = load(k, null); });
    downloadFile("writing-trainer-backup-" + todayISO() + ".json", JSON.stringify(out, null, 2));
    toast("Backup diekspor");
  });
  $("#btnImportAll").addEventListener("click", function () { $("#importFile").click(); });
  $("#importFile").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        var payload = obj.data || obj; // terima format v2 maupun flat
        var valid = ["journal", "readings", "cycles", "errors", "acts", "copyBest", "settings"].some(function (k) { return payload[k] !== undefined; });
        if (!valid) { toast("File tidak dikenali"); return; }
        confirmBox("Import backup?", "Semua data saat ini akan ditimpa dengan isi file backup.", function () {
          Object.keys(payload).forEach(function (k) { if (payload[k] !== null) save(k, payload[k]); });
          location.reload();
        });
      } catch (err) { toast("File JSON tidak valid"); }
    };
    reader.readAsText(f);
    e.target.value = "";
  });
  $("#btnResetAll").addEventListener("click", function () {
    confirmBox(" hapus SEMUA data?", "Journal, cycle, error log, streak, dan pengaturan akan hilang permanen. Pertimbangkan export dulu.", function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(LS) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      location.reload();
    });
  });

  /* ---------------- init ---------------- */
  $("#dateChip").textContent = fmtDate(todayISO());
  document.documentElement.dataset.theme = settings.theme || "dark";
  renderStreak(); renderDashboard();
  initCloud(); renderAccount();
  if (kcToken()) setTimeout(function () { kcPull({ silent: true }); }, 800);   // tarik cloud saat app dibuka
  goto("dashboard");
})();
