/* ============================================================
   English Writing Trainer — bank topik & mesin penilaian tulisan
   ------------------------------------------------------------
   File ini berisi dua hal murni (tanpa DOM, tanpa jaringan):
   1) PROMPTS  — bank tugas writing bergaya "Write & Improve"
                 (situasi + jenis tugas + level CEFR + rencana menulis)
   2) score()  — penilaian menulis 0-100 berbasis rubrik 6 dimensi
   ============================================================ */
(function () {
  "use strict";

  /* ==========================================================
     1) BANK TOPIK WRITING
     g  = genre   lv = level CEFR   sk = skill yang dilatih
     q  = instruksi tugas (English)   min = target panjang kata
     guide = rencana menulis (Indonesia)
     ========================================================== */
  var PROMPTS = [
    /* ---------- Opini ---------- */
    { g: "Opini", lv: "A2", sk: "Alasan sederhana", min: 60,
      q: "What is the best day of the week? Explain your answer in 5-6 sentences.",
      guide: "Pola: jawaban -> 2 alasan -> 1 contoh -> penutup." },
    { g: "Opini", lv: "B1", sk: "Posisi dan bukti", min: 120,
      q: "Some people think that homework should be removed from school. Do you agree or disagree? Give reasons and examples from your own experience.",
      guide: "Struktur: thesis (1 kalimat) -> 2 alasan + contoh -> satu pihak yang berlawanan -> kesimpulan." },
    { g: "Opini", lv: "B1", sk: "Tokoh panutan", min: 120,
      q: "Who is the most influential person of the last fifty years? Explain why you chose him or her.",
      guide: "Sebutkan 3 kualitas yang menjelaskan pengaruhnya, lalu hubungkan dengan contoh nyata." },
    { g: "Opini", lv: "B2", sk: "Argumen berimbang", min: 150,
      q: "Should cities ban cars from their centres? Discuss both sides and give your own view.",
      guide: "Struktur: dua pihak (1 paragraf masing-masing) -> bobot masing-masing -> keputusanmu." },
    { g: "Opini", lv: "B2", sk: "Efek jangka panjang", min: 150,
      q: "Is it better to learn a skill from books or from practice? Explain the long-term results of each method.",
      guide: "Bandingkan: cepat atau lambat, murah atau mahal, stabil atau berisiko, lalu pilih dengan alasan." },
    { g: "Opini", lv: "C1", sk: "Kritik dan argumen", min: 180,
      q: "Is social media a net positive for society? Argue your case and answer the strongest counter-argument.",
      guide: "Struktur: thesis -> 2 argumen kuat + bukti -> acknowledge argumen lawan -> rebuttal -> penutup." },
    { g: "Opini", lv: "A2", sk: "Preferensi harian", min: 60,
      q: "What do you usually do to relax after a busy day? Describe your habit and say why it works for you.",
      guide: "Pola: kebiasaan -> detail (kapan, di mana) -> alasan -> perasaan setelahnya." },
    { g: "Opini", lv: "B1", sk: "Opini dan saran", min: 120,
      q: "What is the biggest problem for young people in your town today? Give your opinion and two practical suggestions.",
      guide: "Struktur: masalah -> dampak -> 2 saran konkret (tiap 1 paragraf) -> penutup." },

    /* ---------- Argumentasi ---------- */
    { g: "Argumentasi", lv: "B1", sk: "Diskusi dua sisi", min: 120,
      q: "Should children learn how to cook at school? Discuss both sides and say what you think.",
      guide: "Setiap sisi 1 paragraf (alasan + contoh), lalu keputusanmu di paragraf terakhir." },
    { g: "Argumentasi", lv: "B1", sk: "Teknologi di sekolah", min: 120,
      q: "Should students be allowed to use AI tools to help them write essays? Give your opinion with reasons.",
      guide: "Pola: posisi -> 2 alasan + contoh nyata -> risiko (jika ada) -> rekomendasi." },
    { g: "Argumentasi", lv: "B2", sk: "Ukuran keberhasilan", min: 150,
      q: "Are examinations a good way to measure a student's ability? Explain your view with examples.",
      guide: "Bahas 3 sudut: guru, siswa, dunia kerja -> gunakan bukti, bukan opini." },
    { g: "Argumentasi", lv: "B2", sk: "Keadilan dan prioritas", min: 150,
      q: "Professional athletes earn much more than teachers. Is this fair? Explain why or why not.",
      guide: "Struktur: klaim -> argumen ekonomi (pasar) -> argumen moral (nilai) -> kesimpulan." },
    { g: "Argumentasi", lv: "C1", sk: "Struktur sebab-akibat", min: 180,
      q: "Does economic growth really improve the lives of ordinary people? Analyse the argument and reach a conclusion.",
      guide: "Pakai pola sebab-akibat berlapis (pertumbuhan -> harga -> daya beli) dan acknowledge trade-offs." },
    { g: "Argumentasi", lv: "B2", sk: "Energi dan lingkungan", min: 150,
      q: "Is nuclear power the best answer to climate change? Weigh the advantages and disadvantages.",
      guide: "Pola: data -> manfaat nyata -> risiko (termasuk kebocoran radiasi) -> biaya -> posisi akhir." },

    /* ---------- Naratif ---------- */
    { g: "Naratif", lv: "A2", sk: "Rangkaian peristiwa", min: 70,
      q: "Tell the story of a time when you helped a stranger. What happened, and how did you feel afterwards?",
      guide: "Pola: kapan dan di mana -> kejadian -> apa yang kamu lakukan -> hasil dan perasaan." },
    { g: "Naratif", lv: "B1", sk: "Titik balik cerita", min: 120,
      q: "Write about a day that changed your mind about something important.",
      guide: "Pola: keadaan awal -> kejadian pemicu -> perubahan pikiran -> pelajaran yang diambil." },
    { g: "Naratif", lv: "B1", sk: "Humor dan detail", min: 120,
      q: "Write a short funny story about the day everything went wrong.",
      guide: "Pakai satu masalah besar, 3 reaksi orang, lalu twist di akhir." },
    { g: "Naratif", lv: "B2", sk: "Refleksi", min: 150,
      q: "Write about a decision you made that you would take back today. What would you do differently?",
      guide: "Pola: keputusan -> alasan saat itu -> akibatnya -> apa yang akan kamu ubah sekarang." },
    { g: "Naratif", lv: "B2", sk: "Surat ke diri masa depan", min: 150,
      q: "Write a letter to yourself five years from now. Describe your life now and what you hope to have achieved.",
      guide: "Gaya surat pribadi: sapaan -> kehidupan sekarang -> harapan -> pengharapan untuk masa depan." },
    { g: "Naratif", lv: "C1", sk: "Sudut pandang ganda", min: 180,
      q: "Tell the same event twice: first from your point of view, then from someone else's. How does that change the story?",
      guide: "Gunakan kata ganti orang dan jamak (I/they, my/their) supaya perbedaan sudut pandang terasa." },
    { g: "Naratif", lv: "A2", sk: "Rutinitas", min: 60,
      q: "Describe what you did last weekend, from Friday evening to Sunday night.",
      guide: "Pakai kata keterangan waktu berurutan: first, then, after that, finally." },

    /* ---------- Deskripsi ---------- */
    { g: "Deskripsi", lv: "A2", sk: "Tempat", min: 70,
      q: "Describe your village or town to someone who has never visited it.",
      guide: "Pola: lokasi -> bangunan atau jalan -> suasana (cuaca, suara) -> aktivitas warga." },
    { g: "Deskripsi", lv: "B1", sk: "Orang", min: 120,
      q: "Describe a person you admire. What does this person look like, and what do they do that inspires you?",
      guide: "Pola: identitas -> fisik (2-3 detail) -> sifat -> bukti yang membuatmu kagum." },
    { g: "Deskripsi", lv: "B1", sk: "Tempat pilihan", min: 120,
      q: "Describe a place where you would love to live. Why do you choose it?",
      guide: "Pola: gambarkan suasana -> fasilitas -> alasan personal." },
    { g: "Deskripsi", lv: "B2", sk: "Lima indra", min: 150,
      q: "Describe your usual morning using as many of the five senses as possible.",
      guide: "Sebutkan penglihatan, pendengaran, penciuman, pengecapan, dan sentuhan." },
    { g: "Deskripsi", lv: "B2", sk: "Teknologi dan masyarakat", min: 150,
      q: "Describe one piece of technology that has changed society. Explain what was different before it existed.",
      guide: "Pola: teknologi -> siapa yang terpengaruh -> perubahannya -> sisi negatif atau positif." },
    { g: "Deskripsi", lv: "B2", sk: "Ruang dan benda", min: 130,
      q: "Describe the room where you are learning English right now. What objects are there, and what do they tell us about the people who use them?",
      guide: "Pola: gambar umum -> objek-objek -> interpretasi (kebiasaan pemilik)." },

    /* ---------- Proses dan penjelasan ---------- */
    { g: "Proses", lv: "A2", sk: "Langkah-langkah", min: 70,
      q: "Explain how to make your favourite dish, step by step.",
      guide: "Pakai kata urutan: first, then, after that, finally, plus kata kerja konkret (add, stir, boil)." },
    { g: "Proses", lv: "B1", sk: "Instruksi kerja", min: 120,
      q: "Explain to a new employee how to write a professional email at work.",
      guide: "Pola: mengapa penting -> struktur email (subject, greeting, body, closing) -> kesalahan umum." },
    { g: "Proses", lv: "B2", sk: "Penjelasan teknis", min: 150,
      q: "Explain how electricity reaches your house, step by step, in simple English.",
      guide: "Pola: sumber -> jaringan -> transformer -> rumah; analogi sederhana boleh dipakai." },
    { g: "Proses", lv: "B1", sk: "Strategi belajar", min: 120,
      q: "Explain how to prepare for an exam efficiently in the two weeks before the test date.",
      guide: "Pola: rencana mingguan dan harian -> teknik belajar -> latihan -> istirahat." },
    { g: "Proses", lv: "B2", sk: "Penjelasan konseptual", min: 150,
      q: "Explain how an automatic writing assessment tool works, and what its score does and does not mean.",
      guide: "Pola: input -> proses (analisis kata, kalimat, struktur) -> output (skor) -> batasan." },
    { g: "Proses", lv: "C1", sk: "Akurasi versus kelancaran", min: 170,
      q: "Explain the difference between accuracy and fluency in language learning, and why teachers should treat them differently.",
      guide: "Bandingkan dua konsep (definisi, contoh, konsekuensi), lalu hubungkan dengan praktik." },

    /* ---------- Surat dan email formal ---------- */
    { g: "Surat & Email", lv: "A2", sk: "Email santai", min: 70,
      q: "Write an informal email to a friend to arrange meeting at the weekend.",
      guide: "Pola: sapaan -> ajakan dan waktu -> apa yang dibawa -> penutup ramah." },
    { g: "Surat & Email", lv: "A2", sk: "Kesalahan kiriman", min: 70,
      q: "A neighbour received your parcel by mistake. Write a short friendly message to them.",
      guide: "Pola: salam -> jelaskan kesalahan -> tawarkan cara mengembalikannya -> terima kasih." },
    { g: "Surat & Email", lv: "B1", sk: "Permintaan izin", min: 120,
      q: "Write an email to your teacher asking for a day off. Give your reason and propose how you will catch up.",
      guide: "Pola: salam -> permintaan -> alasan -> rencana mengejar -> terima kasih." },
    { g: "Surat & Email", lv: "B1", sk: "Keluhan formal", min: 120,
      q: "Write a letter to a company to complain about a faulty product and ask for a refund or replacement.",
      guide: "Pola: referensi order -> uraikan masalah (fakta) -> tuntutan konkret -> batas waktu -> penutup." },
    { g: "Surat & Email", lv: "B2", sk: "Surat lamaran", min: 150,
      q: "Write a cover letter for a part-time job. Explain who you are, why you want the job and what you can offer.",
      guide: "Pola: apa lowongan ini -> 2 bukti kemampuan -> mengapa perusahaan ini -> ajakan melamar." },
    { g: "Surat & Email", lv: "B2", sk: "Apologi profesional", min: 140,
      q: "Write an email to a client apologising for a late delivery, explaining the cause and offering a solution.",
      guide: "Pola: maaf di kalimat pertama -> fakta ringkas tanpa alasan berlebihan -> solusi -> komitmen." },
    { g: "Surat & Email", lv: "B2", sk: "Surat dinas", min: 150,
      q: "Write a formal letter to your local council to report a broken street light on your road.",
      guide: "Pola: siapa, kapan, di mana -> masalah dan dampaknya -> permintaan tindakan -> cara menghubungi." },
    { g: "Surat & Email", lv: "C1", sk: "Email diplomatis", min: 170,
      q: "A customer has written to complain publicly on social media. Write a public reply that is calm, professional and solves the problem.",
      guide: "Pola: terima kasih -> fakta singkat -> tindakan -> solusi -> penutup resmi." },

    /* ---------- Berita dan laporan ---------- */
    { g: "Berita & Laporan", lv: "B1", sk: "Laporan berita", min: 120,
      q: "Write a short news report about a local event you attended recently.",
      guide: "Pola: judul -> lead (5W+H) -> urutan peristiwa -> angka atau kutipan -> penutup." },
    { g: "Berita & Laporan", lv: "B2", sk: "Laporan isu", min: 150,
      q: "Write a report for your school magazine about the most important change in your neighbourhood.",
      guide: "Pola: ringkasan eksekutif -> data dan fakta -> dampak pada warga -> rekomendasi." },
    { g: "Berita & Laporan", lv: "B1", sk: "Ringkasan", min: 90,
      q: "Summarise a news article you have read in 80-90 words. What is the main point, and why does it matter?",
      guide: "Pola: 1 kalimat inti -> 2 detail penting -> 1 kalimat makna, tanpa mengulang kalimat asli." },
    { g: "Berita & Laporan", lv: "B2", sk: "Analisis masalah", min: 150,
      q: "Write a report on the most common problems students face in your city, and suggest two practical solutions.",
      guide: "Pola: metode singkat -> temuan utama -> solusi 1 -> solusi 2 -> kesimpulan." },
    { g: "Berita & Laporan", lv: "B1", sk: "Judul dan ringkasan singkat", min: 70,
      q: "Write a headline and five bullet points for a news story about an unusual event that happened in your town.",
      guide: "Judul harus spesifik; tiap bullet 5-10 kata berisi fakta inti." },

    /* ---------- Analisis dan ulasan ---------- */
    { g: "Ulasan", lv: "B1", sk: "Review karya", min: 120,
      q: "Review a book, film or game you have watched recently. Say what it is about and who would enjoy it.",
      guide: "Pola: apa ini dan siapa pembuatnya -> isi atau ceritanya -> penilaianmu -> untuk siapa." },
    { g: "Ulasan", lv: "B1", sk: "Review tempat", min: 120,
      q: "Review a restaurant or cafe you visited: the food, the service, the price and the atmosphere.",
      guide: "Pola: perkenalan -> 4 aspek (makanan, layanan, harga, suasana) -> nilai keseluruhan." },
    { g: "Ulasan", lv: "B2", sk: "Analisis sebab", min: 150,
      q: "Analyse why some video channels become popular while others disappear. What factors really matter?",
      guide: "Pola: fenomena -> faktor 1-3 dengan contoh -> faktor yang sering diabaikan -> simpulan." },
    { g: "Ulasan", lv: "B2", sk: "Efek media", min: 150,
      q: "Analyse the effects of short videos on teenagers. Is the effect mainly positive, negative, or mixed?",
      guide: "Pola: deskripsi fenomena -> dampak positif -> dampak negatif -> penilaian yang seimbang." },
    { g: "Ulasan", lv: "B1", sk: "Perbandingan produk", min: 120,
      q: "Compare two apps you use every day. Which one is better, and for which type of user?",
      guide: "Pola: perkenalan 2 aplikasi -> perbandingan kriteria (fitur, harga, kegunaan) -> verdict per tipe user." },
    { g: "Ulasan", lv: "C1", sk: "Kritik media", min: 170,
      q: "Critique an advertisement you saw today. Does it persuade you, and is its claim honest? Explain.",
      guide: "Pola: deskripsi singkat -> teknik persuasi -> menilai kejujuran klaim -> kesimpulan." },

    /* ---------- Situasi (gaya Write & Improve) ---------- */
    { g: "Situasi", lv: "B1", sk: "Sopan santun", min: 110,
      q: "You have just received a gift you did not like. Write a polite message to the giver thanking them for it.",
      guide: "Pola: terima kasih tulus -> alasan singkat tanpa menyinggung -> kalimat penuh hormat." },
    { g: "Situasi", lv: "B1", sk: "Konflik tetangga", min: 120,
      q: "Your neighbour's dog barks all night. Write a friendly letter asking for their help.",
      guide: "Pola: sapaan -> fakta ringkas -> dampak padamu -> ajakan bekerja sama -> tawaran solusi." },
    { g: "Situasi", lv: "B1", sk: "Apologi kerja", min: 110,
      q: "You missed an important meeting with your team. Write an email apologising and explaining what happened.",
      guide: "Pola: maaf yang jelas -> alasan faktual -> konsekuensi dan solusi -> langkah pencegahan." },
    { g: "Situasi", lv: "B2", sk: "Menasihati", min: 140,
      q: "Your friend wants to leave school to start a small business. Write to advise them carefully.",
      guide: "Pola: acknowledge pilihan -> 2 risiko serius -> 2 alternatif -> dukunganmu." },
    { g: "Situasi", lv: "B1", sk: "Berita dari peristiwa", min: 120,
      q: "You found a wallet full of money on the street. Write the story as a short news report.",
      guide: "Pola: judul -> lead (siapa, kapan, di mana) -> urutan kejadian -> penyelesaian -> nilai yang bisa diambil." },
    { g: "Situasi", lv: "B2", sk: "Negosiasi", min: 140,
      q: "Your company asks you to work on weekends. Write an email arguing for a better schedule.",
      guide: "Pola: appreciation -> data (keseimbangan hidup) -> 2 tawaran alternatif -> hasil yang diharapkan." },
    { g: "Situasi", lv: "B2", sk: "Ulasan untuk majalah", min: 140,
      q: "You are asked to review a book for a magazine. Write the review as if you were writing it for real readers.",
      guide: "Pola: judul dan penulis -> ringkasan -> penilaian yang kuat -> saran ke pembaca." },
    { g: "Situasi", lv: "A2", sk: "Percakapan", min: 70,
      q: "A tourist asks you for directions and help. Write the short conversation you would have with them.",
      guide: "Format percakapan: A: ... B: ... dengan kalimat pendek dan ekspresi harian." },
    { g: "Situasi", lv: "B2", sk: "Pidato singkat", min: 150,
      q: "You must introduce yourself at an international conference. Write your two-minute speech.",
      guide: "Pola: sapaan -> siapa kamu dan bidangmu -> 1 pengalaman relevan -> tujuan talk -> penutup." },
    { g: "Situasi", lv: "B1", sk: "Menolak dengan halus", min: 110,
      q: "Write a polite email to cancel your subscription, but keep the relationship with the company.",
      guide: "Pola: terima kasih atas hubungan -> keputusan (fakta, tanpa alasan berlebihan) -> tawaran alternatif." }
  ];

  /* ==========================================================
     2) MESIN PENILAIAN 0-100
     ========================================================== */
  var STOP = ("a an the and or but if of to in on at for with from by as is are was were be been being " +
    "it its this that these those they them their he she his her we us our you your i me my not no do does " +
    "did have has had will would can could should may might must there here what which who whom whose when " +
    "where why how all any both each few more most other some such only own same so than too very can will " +
    "just don should now s t re ve ll m d").split(" ");
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });



  var CONNECTORS = ("first second third fourth finally lastly moreover furthermore however therefore thus " +
    "consequently besides meanwhile nevertheless nonetheless otherwise instead additionally additionally " +
    "example instance result contrast hand addition furthermore further overall conclusion sum conclusion " +
    "fact indeed although though whereas while because since order able better worse best worst instead " +
    "meanwhile nevertheless nonetheless regardless similarly likewise addition example contrast addition").split(" ");

  var CONNECTOR_PHRASES = ["in addition", "for example", "for instance", "as a result", "in contrast",
    "on the other hand", "in conclusion", "to conclude", "to sum up", "in summary", "such as", "so that",
    "because of", "due to", "even though", "even so", "at the same time", "as well as", "above all",
    "in particular", "by contrast", "to begin with", "to start with", "in fact", "first of all"];

  // kata instruksi yang muncul di SEMUA prompt -> tidak dipakai untuk mengukur relevansi
  var PROMPT_STOP = ("people think some give write explain describe discuss opinion view tell make take use " +
    "need want your their them they have been what which when where why how would could should must will " +
    "please briefly paragraph sentences words word recently someone thing things lot many every always " +
    "never first second finally explain again answer question question").split(" ");
  var PROMPT_STOPSET = {};
  PROMPT_STOP.forEach(function (w) { PROMPT_STOPSET[w] = 1; });

  var TOPIC_MARKERS = ("first second third finally moreover however therefore in addition for example " +
    "in conclusion overall besides another result meanwhile contrast furthermore nevertheless importantly " +
    "notably fact firstly secondly lastly begin sum conclusion first additionally").split(" ");

  var WEAK = ("very really quite good bad thing things lot lots nice great just get got big small happy sad " +
    "nice okay really pretty many much").split(" ");

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function words(text) {
    return String(text || "").toLowerCase().match(/[a-z][a-z'-]*/g) || [];
  }

  function splitSentences(text) {
    var t = String(text || "").replace(/(\d)\.(\d)/g, "$1\uF02E$2").replace(/\n+/g, " ");
    var out = t.match(/[^.!?]+[.!?]+["”')\]]?/g);
    if (!out) {
      out = t.trim() ? [t.trim()] : [];
    }
    return out.map(function (s) { return s.replace(/\uF02E/g, ".").trim(); }).filter(function (s) { return s.length > 1; });
  }

  function contentWords(text) {
    var seen = {}, out = [];
    words(text).forEach(function (w) {
      if (w.length > 3 && !STOPSET[w] && !PROMPT_STOPSET[w] && !seen[w]) { seen[w] = 1; out.push(w); }
    });
    return out;
  }

  /* akar kata akademik: cukup sama untuk menangkap bentuk turunan (conclusion, conclusions, ...) */
  var ACA_STEMS = ("achiev acquir adequa adjust advoc affect alternativ analys apparen appropr assess assist assum " +
    "attribut author availab benefi capaci circumst communicat communit compar comple comprehen compris " +
    "conce conclude conduct consequen consider constitu consum contempor contradict contrast contribut " +
    "convent convert convey cooperat crucial declin demonstr deriv determin develop devic differenti diminish " +
    "discour distinct divers dominant durati dynam econom effici elaborat elimin emerge emphas enhanc ensure " +
    "enterpris environ equat establish evaluat evid exceed exhib expand explicit exploit expos extern facilita " +
    "factor featur financ flexibl formula framework fundament generat genuin global govern guarante identif " +
    "illustrat implement implicat impos incentiv incidenc indicat individual industri inevitab influenc initiat " +
    "innovat insight inspir integrat intens interact interpret interven intrins investigat involv isolat " +
    "legitim maintain mandat manifest matur maximi mechanis media mental migrat minimal minimi modif monitor " +
    "moment moral motiv mutual negativ network neutral notable notion objective obtain occur operat opportun " +
    "optimi outcome overal parallel parameter participat particular percept perform permanent persist " +
    "perspectiv phenomen philosoph physic potential practition precis predict predomin premis prescrib " +
    "previous princip priorit proceed process profession project promot proportion prospect publish purchas " +
    "pursu qualif quantif radical reasonab recall recogni reduce refer reflect regime reinforc reject relate " +
    "release relevant reliab reluctan remarkab render represent reputat request require researc resolv " +
    "respond restor restrict retain reveal revenu revis rigid satisfy scale scenario scheme scope secur " +
    "segment senior sensitiv separ sequenc series severe signific similar situat specif stabil strateg " +
    "stress strict structur submit substitut subtle sufficien sustain switch symbol synthes tackle technical " +
    "technique tend tension theme theor thereby thorough tight trace tradition transfer transform transmit " +
    "trigger undergo unify unique urban utilis valid variab vary venture version virtue visual volume " +
    "vulnerab whereas improv freedom meaningful thoughtful responsib essential opportunit importance " +
    "accurac clarity efficien disciplin equal safety stabil flexibl curios creat manag productiv " +
    "success benefit indicat consequ signific consider purpos").split(" ");
  function academicHits(wordList) {
    var hits = [], seen = {};
    wordList.forEach(function (x) {
      if (seen[x]) return;
      for (var i = 0; i < ACA_STEMS.length; i++) {
        if (x.length >= 5 && x.indexOf(ACA_STEMS[i]) === 0) { seen[x] = 1; hits.push(x); return; }
      }
    });
    return hits;
  }

  function countPhrase(low, phrase) {
    var c = 0, idx = 0;
    while ((idx = low.indexOf(phrase, idx)) > -1) { c++; idx += phrase.length; }
    return c;
  }

  /* ----------------------- fungsi utama ----------------------- */
  function score(raw, opts) {
    opts = opts || {};
    var text = String(raw || "");
    var low = text.toLowerCase();
    var w = words(text);
    var n = w.length;
    var sents = splitSentences(text);
    var paras = text.split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    var target = opts.target || 120;
    var dims = [], tips = [];

    /* ---- teks kosong -> skor 0 ---- */
    if (n === 0) {
      return {
        total: 0, cefr: "A2", band: "Belum ada tulisan",
        dims: [
          { key: "isi", label: "Isi & relevansi", max: 20, score: 0, note: "0 kata" },
          { key: "struktur", label: "Struktur & koherensi", max: 20, score: 0, note: "0 paragraf" },
          { key: "kosakata", label: "Kosakata & variasi", max: 20, score: 0, note: "0 kata unik" },
          { key: "grammar", label: "Grammar & ketepatan", max: 20, score: 0, note: "belum ada teks" },
          { key: "gaya", label: "Variasi kalimat & gaya", max: 10, score: 0, note: "0 kalimat" },
          { key: "mekanik", label: "Mekanik penulisan", max: 10, score: 0, note: "0 kalimat" }
        ],
        tips: ["Belum ada teks yang dinilai. Tulis minimal 30 kata lalu tekan tombol nilai lagi."],
        stats: { words: 0, paras: 0, sentences: 0, unique: 0, academic: 0 }
      };
    }

    /* ---- 1. Isi & relevansi (20) ---- */
    var lenScore;
    if (n < 30) lenScore = n / 30 * 4;
    else if (n < target * 0.8) lenScore = 4 + (n - 30) / Math.max(1, target * 0.8 - 30) * 4;
    else lenScore = 8;
    lenScore = clamp(lenScore, 0, 8);

    var ideaScore = paras.length >= 3 ? 4 : paras.length === 2 ? 3 : paras.length === 1 ? 1.5 : 0;

    var relScore = 8, relHit = [], relMiss = [];
    if (opts.prompt) {
      var keys = contentWords(opts.prompt).slice(0, 12);
      if (keys.length) {
        relHit = keys.filter(function (k) { return low.indexOf(k) > -1; });
        relMiss = keys.filter(function (k) { return low.indexOf(k) === -1; });
        relScore = Math.min(8, Math.round(relHit.length / keys.length * 12));
      }
    }
    dims.push({
      key: "isi", label: "Isi & relevansi", max: 20,
      score: Math.round(clamp(lenScore + ideaScore + relScore, 0, 20)),
      note: n + " kata • " + paras.length + " paragraf" + (opts.prompt ? " • " + relHit.length + "/" + (relHit.length + relMiss.length) + " kata kunci dipakai" : "")
    });
    if (n === 0) tips.push("Belum ada teks yang dinilai — tulis dulu minimal 30 kata.");
    else {
      if (lenScore < 6) tips.push("Teks masih pendek (" + n + " kata). Target ±" + target + " kata — kembangkan contoh dan alasan.");
      if (opts.prompt && relScore < 5) tips.push("Topik belum dibahas: coba masukkan kata kunci seperti “" + relMiss.slice(0, 3).join(", ") + "”.");
      if (ideaScore < 3) tips.push("Tambahkan paragraf kedua — satu paragraf belum cukup untuk mengembangkan ide.");
    }

    /* ---- 2. Struktur & koherensi (20) ---- */
    var paraScore = paras.length >= 2 ? 6 : paras.length === 1 ? 3 : 0;
    var connFound = 0, connTypes = [];
    CONNECTORS.forEach(function (c) {
      if (new RegExp("\\b" + c + "\\b").test(low)) { connTypes.push(c); connFound++; }
    });
    CONNECTOR_PHRASES.forEach(function (c) {
      if (countPhrase(low, c)) { connTypes.push(c); connFound++; }
    });
    var connScore = clamp(connTypes.length * 1.3, 0, 8);

    var topicCount = 0;
    paras.forEach(function (p) {
      var first = splitSentences(p)[0] || "";
      var fl = first.toLowerCase();
      var hit = TOPIC_MARKERS.some(function (m) { return new RegExp("\\b" + m + "\\b").test(fl); });
      if (!hit) hit = CONNECTOR_PHRASES.some(function (c) { return fl.indexOf(c) > -1; });
      if (hit) topicCount++;
    });
    var topicScore = clamp(topicCount * 1.5, 0, 6);

    dims.push({
      key: "struktur", label: "Struktur & koherensi", max: 20,
      score: Math.round(clamp(paraScore + connScore + topicScore, 0, 20)),
      note: paras.length + " paragraf • " + connTypes.length + " kata penghubung"
    });
    if (paras.length < 2 && n > 20) tips.push("Bagi tulisanmu jadi 2–4 paragraf agar alurnya jelas.");
    if (connTypes.length < 5) tips.push("Hubungkan ide dengan kata penghubung: Moreover, However, As a result, For example, In conclusion.");
    if (topicCount < Math.max(1, paras.length - 1)) tips.push("Akhiri tiap paragraf dengan kalimat topic sentence yang menyatukan isinya.");

    /* ---- 3. Kosakata (20) ---- */
    var types = {}, typeCount = 0;
    w.forEach(function (x) { if (!types[x]) { types[x] = 1; typeCount++; } });
    var u = n ? typeCount / n : 0;
    var divScore = clamp((u - 0.35) / 0.20 * 8, 0, 8);

    var acaHit = academicHits(w);
    var acaScore = clamp(acaHit.length * 0.7, 0, 6);

    var cnt = {}, maxCount = 0, maxWord = "";
    w.forEach(function (x) {
      if (STOPSET[x] || x.length < 4) return;
      cnt[x] = (cnt[x] || 0) + 1;
      if (cnt[x] > maxCount) { maxCount = cnt[x]; maxWord = x; }
    });
    var repScore = clamp(6 - Math.max(0, maxCount - 3) * 1.5, 0, 6);

    dims.push({
      key: "kosakata", label: "Kosakata & variasi", max: 20,
      score: Math.round(clamp(divScore + acaScore + repScore, 0, 20)),
      note: typeCount + " kata unik • " + acaHit.length + " kata akademik"
    });
    if (n > 40) {
      if (divScore < 5) tips.push("Kosakata masih sering berulang — ganti kata umum dengan sinonim yang lebih spesifik.");
      if (acaHit.length < 4) tips.push("Tambahkan kata akademik, misalnya: significant, moreover, consequently, benefit, impact.");
      if (maxCount >= 5) tips.push("Kata “" + maxWord + "” muncul " + maxCount + " kali — variasikan dengan sinonim atau bentuk lain.");
    }

    /* ---- 4. Grammar & ketepatan (20) ---- */
    var issues = opts.issues;
    var issuesKnown = Array.isArray(issues);
    if (!issuesKnown) issues = [];
    var pen = 0;
    issues.forEach(function (is) {
      var cat = (is.cat || "").toUpperCase();
      var p = 0.8;
      if (cat.indexOf("TYPO") > -1 || cat.indexOf("MORPH") > -1 || cat.indexOf("SPELL") > -1) p = 0.5;
      else if (cat.indexOf("GRAMMAR") > -1 || cat.indexOf("MISC") > -1) p = 1.1;
      else if (cat.indexOf("CASING") > -1) p = 0.7;
      else if (cat.indexOf("PUNCT") > -1) p = 0.7;
      else if (cat.indexOf("STYLE") > -1 || cat.indexOf("REDUND") > -1) p = 0.5;
      pen += p;
    });
    pen = pen * (100 / Math.max(90, n));
    var gramScore = issuesKnown ? clamp(20 - pen, 0, 20) : 15;   // belum dicek -> nilai tengah, bukan nilai sempurna
    dims.push({
      key: "grammar", label: "Grammar & ketepatan", max: 20,
      score: Math.round(gramScore),
      note: issuesKnown
        ? issues.length + " masalah terdeteksi" + (opts.issuesSource === "lt" ? " (LanguageTool)" : " (aturan offline)")
        : "belum dijalankan pemeriksa grammar"
    });
    if (issuesKnown && issues.length) tips.push("Masih ada " + issues.length + " saran kesalahan tata bahasa — perbaiki lewat daftar di bawah, lalu nilai ulang.");

    /* ---- 5. Variasi & gaya (10) ---- */
    var lens = sents.map(function (s) { return words(s).length; });
    var avg = lens.length ? lens.reduce(function (a, b) { return a + b; }, 0) / lens.length : 0;
    var variance = 0;
    lens.forEach(function (l) { variance += (l - avg) * (l - avg); });
    var sd = lens.length ? Math.sqrt(variance / lens.length) : 0;
    var sdScore = clamp(sd / 5 * 4, 0, 4);

    var complexHits = 0;
    sents.forEach(function (s) {
      if (/\b(because|although|though|which|who|whom|whose|while|whereas|despite|unless|if|when|since|until|before|after|even though|even if|so that|in order to|whether|than|as long as)\b/i.test(s)) complexHits++;
    });
    var cxRatio = sents.length ? complexHits / sents.length : 0;
    var cxScore = clamp(cxRatio * 7, 0, 3);

    var weakCount = 0;
    WEAK.forEach(function (x) {
      var m = low.match(new RegExp("\\b" + x + "\\b", "g"));
      if (m) weakCount += m.length;
    });
    var weakScore = clamp(3 - weakCount * 0.3, 0, 3);

    dims.push({
      key: "gaya", label: "Variasi kalimat & gaya", max: 10,
      score: Math.round(clamp(sdScore + cxScore + weakScore, 0, 10)),
      note: "rata-rata " + (avg ? avg.toFixed(0) : 0) + " kata/kalimat • " + weakCount + " kata lemah"
    });
    if (n > 40) {
      if (sd < 2.5) tips.push("Panjang kalimatmu monoton — campur kalimat pendek dan kalimat panjang.");
      if (cxRatio < 0.2) tips.push("Gabungkan kalimat sederhana dengan because, although, atau which agar kalimatmu lebih kompleks.");
      if (weakCount > 4) tips.push("Kurangi kata lemah seperti very, good, thing, a lot — ganti dengan kata yang lebih tepat.");
    }

    /* ---- 6. Mekanik (10) ---- */
    var noCap = 0, noEnd = 0;
    sents.forEach(function (s) {
      if (!/^[A-Z"'(]/.test(s)) noCap++;
      if (!/[.!?]["')\]]?$/.test(s)) noEnd++;
    });
    var capScore = clamp(4 - noCap * 0.8, 0, 4);
    var endScore = clamp(3 - noEnd * 0.6, 0, 3);
    var spaceBad = 0;
    if (/ {2,}/.test(text)) spaceBad++;
    if (/\s+[,.!?;:]/.test(text)) spaceBad++;
    if (/,[A-Za-z]/.test(text)) spaceBad++;
    var spScore = clamp(3 - spaceBad * 1, 0, 3);

    dims.push({
      key: "mekanik", label: "Mekanik penulisan", max: 10,
      score: Math.round(clamp(capScore + endScore + spScore, 0, 10)),
      note: (noCap + noEnd) + " kalimat perlu kapital/tanda baca"
    });
    if (noCap) tips.push("Ada " + noCap + " kalimat yang tidak diawali huruf besar.");
    if (noEnd) tips.push("Ada " + noEnd + " kalimat yang belum diakhiri tanda baca.");

    /* ---- total & level ---- */
    var total = 0;
    dims.forEach(function (d) { total += d.score; });
    total = clamp(Math.round(total), 0, 100);

    var cefr = total >= 88 ? "C1" : total >= 78 ? "B2" : total >= 68 ? "B1" : total >= 56 ? "B1\u2212" : "A2";
    var band = total >= 90 ? "Sangat baik" : total >= 80 ? "Baik" : total >= 70 ? "Cukup baik" :
      total >= 60 ? "Perlu latihan" : "Perlu diperbaiki";

    if (!tips.length) tips.push("Bagus sekali — tidak ada masalah besar yang terdeteksi. Coba naikkan level atau tulis lebih panjang.");

    return {
      total: total,
      cefr: cefr,
      band: band,
      dims: dims,
      tips: tips.slice(0, 6),
      stats: { words: n, paras: paras.length, sentences: sents.length, unique: typeCount, academic: acaHit.length }
    };
  }

  window.EWTWriting = {
    prompts: PROMPTS,
    score: score,
    contentWords: contentWords,
    splitSentences: splitSentences
  };
})();
