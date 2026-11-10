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
  function save(k, v) { localStorage.setItem(LS + k, JSON.stringify(v)); }
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
    reading: ["Reading", "Metode 3 — extensive reading: catat struktur & kolokasi"],
    cycle: ["Cycle", "Metode 4 — draft → correct → rewrite"],
    corrector: ["Koreksi Grammar", "Periksa & koreksi grammar — aturan offline + LanguageTool online"],
    errors: ["Error Log", "Metode 5 — pelacakan kesalahan agar tidak terulang"],
    plan: ["Rencana", "Jadwal mingguan yang menggabungkan semua metode"],
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
  jText.addEventListener("input", function () { jCount(); jAutosave(); });
  jText.value = load("draftJournal", "");
  jCount(); jRenderDraftFlag();

  $("#btnSaveJournal").addEventListener("click", function () {
    var txt = jText.value.trim();
    if (!txt) { toast("Tulis sesuatu dulu 🙂"); return; }
    var list = load("journal", []);
    list.unshift({ id: uid(), date: todayISO(), topic: PROMPTS[promptIdx][0], prompt: PROMPTS[promptIdx][1], words: countWords(txt), text: txt });
    save("journal", list);
    jText.value = ""; save("draftJournal", "");
    jCount(); jRenderDraftFlag();
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

  function runLocalCheck() {
    var text = corrText.value;
    corrLastWasLT = false;
    corrIssues = collectLocalIssues(text);
    renderCorrIssues(text);
  }

  function runLTCheck() {
    var raw = corrText.value;
    var text = raw.trim();
    if (!text) { toast("Tulis teks dulu."); return; }
    var btn = $("#btnCheckOnline");
    btn.disabled = true; btn.textContent = "Memeriksa…";
    $("#corrSummary").textContent = "Menghubungi LanguageTool…";
    fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: text, language: "en-US" }).toString()
    }).then(function (r) { return r.json(); }).then(function (data) {
      var base = raw.indexOf(text); // jaga offset bila ada leading whitespace
      corrIssues = (data.matches || []).map(function (x) {
        return {
          start: x.offset + base,
          end: x.offset + x.length + base,
          wrong: text.substr(x.offset, x.length),
          fix: x.replacements && x.replacements[0] ? x.replacements[0].value : "",
          msg: x.message + (x.rule && x.rule.id ? " [" + x.rule.id + "]" : ""),
          src: "lt", stale: false
        };
      });
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

  $("#btnApplyAll").addEventListener("click", function () {
    var text = corrText.value, total = 0;
    for (var round = 0; round < 5; round++) {           // cascade: terapkan ulang sampai bersih
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
    corrText.value = text;
    saveCorrDraft();
    runLocalCheck();
    toast(total + " perbaikan diterapkan ✅");
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

  /* ---------------- settings ---------------- */
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
  goto("dashboard");
})();
