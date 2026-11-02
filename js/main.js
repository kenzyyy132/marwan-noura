/* Engagement invitation — behaviour.  All event data lives in js/config.js. */
(function () {
  "use strict";

  var config = window.INVITATION_CONFIG;
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!config) {
    console.error("Invitation: js/config.js did not load — showing the static page.");
    return;
  }
  window.__invitationReady = true;

  var coupleNames = config.couple.first + " & " + config.couple.second;
  var guestName = readGuestName();
  var event = parseEvent(config.event);

  fillContent();
  setupCountdown();
  setupReveal();
  setupStage();
  setupVenue();
  setupCalendar();
  setupRsvp();
  setupShare();
  var music = setupMusic();
  setupGate();

  /* ── Content ─────────────────────────────────────────────── */

  function fillContent() {
    $("hero-title").textContent = coupleNames + " — " + config.event.title;
    $("message-arabic").textContent = config.message.arabic || "";
    $("message-arabic").hidden = !config.message.arabic;
    $("message-english").textContent = config.message.english || "";
    $("closing-title").textContent = config.message.closing || "";
    $("closing-names").textContent = coupleNames;
    $("stage-name-1").textContent = config.couple.first;
    $("stage-name-2").textContent = config.couple.second;
    $("stage-event").textContent = config.event.title;
    if (config.couple.arabic) {
      $("stage-arabic").textContent = config.couple.arabic;
      document.querySelectorAll(".gate__names, .closing__arabic").forEach(function (el) { el.textContent = config.couple.arabic; });
    }

    if (event) {
      $("date-text").textContent = event.dateLabel;
      var p = event.parts;
      var wall = new Date(Date.UTC(p.y, p.mo - 1, p.d));
      $("date-weekday").textContent = wall.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
      $("date-month").textContent = wall.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
      $("date-day").textContent = String(p.d).padStart(2, "0");
      $("date-year").textContent = String(p.y);
      $("time-text").textContent = "Starts at " + event.timeLabel;
      if (event.localNote) {
        $("tz-note").textContent = event.localNote;
        $("tz-note").hidden = false;
      }
    }
  }

  /** Optional personal greeting: ?to=Name (plain text only, never HTML). */
  function readGuestName() {
    var params = new URLSearchParams(window.location.search);
    var raw = params.get("to") || params.get("guest") || "";
    var clean = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
    return clean;
  }

  /* ── Event time & time zone ──────────────────────────────── */

  function parseEvent(ev) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(ev.start || "");
    if (!m) {
      console.warn("Invitation: event.start must look like 2026-11-05T19:00 — countdown disabled.");
      return null;
    }
    var p = { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
    var tz = ev.timeZone && isValidZone(ev.timeZone) ? ev.timeZone : "";
    if (ev.timeZone && !tz) console.warn("Invitation: unknown time zone \"" + ev.timeZone + "\" — using the guest's local time.");

    var start = tz ? zonedToDate(p, tz) : new Date(p.y, p.mo - 1, p.d, p.h, p.mi);
    if (isNaN(start)) return null;
    var hours = Number(ev.durationHours) > 0 ? Number(ev.durationHours) : 4;
    var end = new Date(start.getTime() + hours * 3600e3);

    // Labels describe the venue's wall-clock time, exactly as printed on the card.
    var wall = new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi));
    var dateLabel = wall.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    var timeLabel = wall.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

    var localNote = "";
    if (tz) {
      var guestZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      var guestTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (guestZone !== tz && guestTime !== timeLabel) {
        localNote = "That's " + guestTime + " on " +
          start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + " in your time zone.";
      }
    }
    return { parts: p, tz: tz, start: start, end: end, hours: hours, dateLabel: dateLabel, timeLabel: timeLabel, localNote: localNote };
  }

  function isValidZone(tz) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (e) { return false; }
  }

  /** Wall-clock time in an IANA zone → absolute Date (handles DST). */
  function zonedToDate(p, tz) {
    var guess = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    var t = guess - zoneOffset(guess, tz);
    return new Date(guess - zoneOffset(t, tz));
  }
  function zoneOffset(ms, tz) {
    var f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    var v = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { v[x.type] = +x.value; });
    return Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second) - Math.floor(ms / 1000) * 1000;
  }

  /* ── Countdown ───────────────────────────────────────────── */

  function setupCountdown() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-countdown]"));
    if (!event) { boxes.forEach(function (b) { b.hidden = true; }); return; }

    var clocks = boxes.map(function (box) {
      var values = {};
      box.querySelectorAll("[data-unit]").forEach(function (el) { values[el.dataset.unit] = el; });
      return {
        clock: box.querySelector(".countdown__clock"),
        summary: box.querySelector(".countdown__summary"),
        done: box.querySelector(".countdown__done"),
        values: values,
      };
    });
    var first = true;
    var timer;

    function tick() {
      var now = Date.now();
      var ms = event.start.getTime() - now;

      if (ms <= 0) {
        var message = now < event.end.getTime() ? "The celebration has begun" : "Thank you for celebrating with us";
        clocks.forEach(function (c) {
          c.clock.hidden = true;
          c.summary.textContent = "";
          c.done.hidden = false;
          c.done.textContent = message;
        });
        // still celebrating: check back when it ends, to say thank you
        if (now < event.end.getTime()) timer = setTimeout(tick, Math.min(event.end.getTime() - now + 50, 3600e3));
        return;
      }

      var s = Math.floor(ms / 1000);
      var parts = {
        days: Math.floor(s / 86400),
        hours: Math.floor((s % 86400) / 3600),
        minutes: Math.floor((s % 3600) / 60),
        seconds: s % 60,
      };
      var summary = parts.days + " days, " + parts.hours + " hours and " + parts.minutes + " minutes until the celebration";
      clocks.forEach(function (c) {
        Object.keys(parts).forEach(function (unit) {
          setDigits(c.values[unit], String(parts[unit]).padStart(2, "0"), first || reducedMotion.matches);
        });
        c.summary.textContent = summary;
      });
      first = false;

      // re-align to the next whole second so the display never drifts
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") { clearTimeout(timer); first = true; tick(); }
      else clearTimeout(timer);
    });
    tick();
  }

  /** Render a number as rolling digits; only changed digits animate. */
  function setDigits(el, str, instant) {
    while (el.children.length < str.length) {
      var d = document.createElement("span");
      d.className = "digit";
      d.appendChild(document.createElement("span"));
      el.insertBefore(d, el.firstChild);
    }
    while (el.children.length > str.length) el.removeChild(el.firstChild);

    for (var i = 0; i < str.length; i++) {
      var digit = el.children[i];
      var current = digit.lastElementChild;
      if (current.textContent === str[i]) continue;
      if (instant) {
        digit.textContent = "";
        var only = document.createElement("span");
        only.textContent = str[i];
        digit.appendChild(only);
        continue;
      }
      // drop anything still animating from the previous tick
      while (digit.children.length > 1) digit.removeChild(digit.firstChild);
      var next = document.createElement("span");
      next.textContent = str[i];
      next.className = "is-in";
      current.className = "is-out";
      digit.appendChild(next);
      (function (old) { setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 600); })(current);
    }
  }

  /* ── Scroll reveals ──────────────────────────────────────── */

  function setupReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target); // reveal once — revisiting never re-hides content
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ── Venue ───────────────────────────────────────────────── */

  function setupVenue() {
    var v = config.venue;
    $("venue-name").textContent = v.name || "Venue details to follow";
    if (/[\u0600-\u06ff]/.test(v.name || "")) { $("venue-name").lang = "ar"; $("venue-name").dir = "rtl"; }
    if (v.mapsUrl) $("venue-name").href = v.mapsUrl; else $("venue-name").removeAttribute("target");
    $("venue-address").textContent = v.address || "";
    $("venue-address").hidden = !v.address;

    if (v.photo) {
      var fig = $("venue-photo");
      var img = fig.querySelector("img");
      img.src = v.photo;
      img.alt = v.name ? "The venue: " + v.name : "The venue";
      img.addEventListener("error", function () { fig.hidden = true; });
      fig.hidden = false;
    }

    var query = v.coordinates || v.directionsQuery || (v.mapsUrl ? "" : [v.name, v.address].filter(Boolean).join(", "));
    if (!query && !v.mapsUrl) return; // nothing real to link to — keep buttons hidden

    $("map-link").href = v.mapsUrl || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
    if (query) {
      $("directions-link").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(query);
    } else {
      $("directions-link").hidden = true; // a share link alone can't seed directions
    }
    $("venue-actions").hidden = false;
  }

  /* ── Add to calendar ─────────────────────────────────────── */

  function setupCalendar() {
    if (!event) {
      $("cal-menu").parentElement.hidden = true;
      return;
    }
    var v = config.venue;
    var title = coupleNames + " — " + config.event.title;
    var location = [v.name, v.address].filter(Boolean).join(", ");
    var details = "You're invited to " + coupleNames + "'s " + config.event.title.toLowerCase() + "!" +
      "\nInvitation: " + window.location.origin + window.location.pathname +
      (v.mapsUrl ? "\nLocation: " + v.mapsUrl : "");
    var p = event.parts;
    var endWall = new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) + event.hours * 3600e3);
    var startStr = stamp(new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi)));
    var endStr = stamp(endWall);

    $("gcal-link").href = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(title) +
      "&dates=" + startStr + "/" + endStr +
      "&details=" + encodeURIComponent(details) +
      (location ? "&location=" + encodeURIComponent(location) : "") +
      (event.tz ? "&ctz=" + encodeURIComponent(event.tz) : "");

    $("outlook-link").href = "https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent" +
      "&subject=" + encodeURIComponent(title) +
      "&startdt=" + encodeURIComponent(event.start.toISOString()) +
      "&enddt=" + encodeURIComponent(event.end.toISOString()) +
      "&body=" + encodeURIComponent(details) +
      (location ? "&location=" + encodeURIComponent(location) : "");

    function downloadIcs() {
      // With a known zone we write UTC times; otherwise "floating" local times.
      var dtStart = event.tz ? stamp(event.start) + "Z" : startStr;
      var dtEnd = event.tz ? stamp(event.end) + "Z" : endStr;
      var ics = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Engagement Invitation//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:" + startStr + "-" + config.couple.first.toLowerCase() + "-" + config.couple.second.toLowerCase() + "@invitation",
        "DTSTAMP:" + stamp(new Date()) + "Z",
        "DTSTART:" + dtStart, "DTEND:" + dtEnd,
        "SUMMARY:" + icsEscape(title),
        location ? "LOCATION:" + icsEscape(location) : "",
        "DESCRIPTION:" + icsEscape(details),
        v.mapsUrl ? "URL:" + v.mapsUrl : "",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape(title), "TRIGGER:-P1D", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR",
      ].filter(Boolean).map(foldIcs).join("\r\n");
      var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = config.couple.first + "-and-" + config.couple.second + "-engagement.ics";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    // "Add to calendar" opens a small menu of calendars
    var menu = $("cal-menu");
    var button = $("cal-button");
    var options = $("cal-options");
    function setOpen(open) {
      options.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
    }
    button.addEventListener("click", function () { setOpen(options.hidden); });
    options.querySelectorAll("[data-ics]").forEach(function (b) { b.addEventListener("click", downloadIcs); });
    options.querySelectorAll(".cal-menu__item").forEach(function (item) {
      item.addEventListener("click", function () { setTimeout(function () { setOpen(false); }, 150); });
    });
    document.addEventListener("click", function (e) { if (!menu.contains(e.target)) setOpen(false); });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !options.hidden) { setOpen(false); button.focus(); }
    });
  }

  /** YYYYMMDDTHHMMSS from a Date's UTC fields. */
  function stamp(d) {
    var z = function (n) { return String(n).padStart(2, "0"); };
    return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + "T" + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds());
  }
  function icsEscape(s) { return String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
  /** RFC 5545: lines longer than 75 octets continue on the next line after a space. */
  function foldIcs(line) {
    var out = "";
    while (line.length > 74) { out += line.slice(0, 74) + "\r\n "; line = line.slice(74); }
    return out + line;
  }

  /* ── RSVP ────────────────────────────────────────────────── */

  function setupRsvp() {
    var r = config.rsvp;
    var btn = $("rsvp-button");
    var number = (r.whatsapp || "").replace(/\D/g, "");
    if (number) {
      var text = "Hello! " + (guestName ? "This is " + guestName + ". " : "") +
        "I'd love to confirm my attendance at " + coupleNames + "'s " + config.event.title.toLowerCase() +
        (event ? " on " + event.dateLabel : "") + ".";
      btn.href = "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
    } else if (r.url) {
      btn.href = r.url;
    } else {
      return; // no RSVP destination configured
    }
    btn.hidden = false;
    if (r.deadline) {
      $("rsvp-deadline").textContent = "Kindly reply by " + r.deadline;
      $("rsvp-deadline").hidden = false;
    }
  }

  /* ── Share ───────────────────────────────────────────────── */

  function setupShare() {
    $("share-button").addEventListener("click", function () {
      // never forward someone's personal ?to= greeting
      var url = window.location.origin + window.location.pathname;
      var data = { title: config.share.title, text: config.share.text, url: url };
      if (navigator.share) {
        navigator.share(data).catch(function () { /* dismissed */ });
        return;
      }
      copyText(url).then(
        function () { toast("Invitation link copied"); },
        function () { toast(url); }
      );
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { /* unsupported */ }
      ta.remove();
      ok ? resolve() : reject();
    });
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-shown"); }, 2600);
  }

  /* ── Music & the stage performance ───────────────────────── */
  /*
   * The stage scene "performs" (html.is-performing) exactly while the song is
   * playing, so picture and sound always start, pause and stop together.
   * Triggers: "Tap to Listen" on the stage, and the floating music button.
   */
  function setupMusic() {
    var m = config.music || {};
    var src = m.src;
    var audio = $("audio");
    var button = $("music-button");
    var listen = $("listen-button");
    var stage = $("stage");
    // Only these elements use the loudness; writing it on them alone avoids restyling whole sections every frame.
    var levelTargets = Array.prototype.slice.call(document.querySelectorAll(".stage__glow, .lantern"));
    var setLevel = function (v) { levelTargets.forEach(function (el) { el.style.setProperty("--level", v); }); };
    var startAt = Math.max(0, Number(m.startAt) || 0);
    var loop = m.loop !== false;
    // ?preview-scene lets you watch the performance before the song is added (silent)
    var preview = !src && /[?&]preview-scene\b/.test(window.location.search);

    if (Number(m.bpm) > 0) stage.style.setProperty("--beat", (60 / Number(m.bpm)).toFixed(3) + "s");

    function setPerforming(on) {
      root.classList.toggle("is-performing", on);
      [button, listen].forEach(function (b) {
        b.setAttribute("aria-pressed", String(on));
      });
      button.setAttribute("aria-label", on ? "Pause music" : "Play music");
      $("listen-label").textContent = on ? "Pause the music" : "Play the music";
      if (!on) setLevel("0");
    }

    if (preview) {
      listen.hidden = false;
      root.classList.add("no-analyser");
      listen.addEventListener("click", function () { setPerforming(!root.classList.contains("is-performing")); });
      return { start: function () {} };
    }
    if (!src) return { start: function () {} };

    listen.hidden = false;
    button.hidden = false;
    if (m.startOnOpen) $("gate-sound").hidden = false;

    var wantsPlay = false;
    var meter = null;

    function seekToStart() {
      if (!startAt) return;
      var seek = function () { try { audio.currentTime = startAt; } catch (e) { /* not seekable yet */ } };
      if (audio.readyState >= 1) seek(); else audio.addEventListener("loadedmetadata", seek, { once: true });
    }
    function play() {
      wantsPlay = true;
      if (!audio.src) { audio.src = src; seekToStart(); }
      if (!meter) meter = createMeter(); // inside the tap, so the AudioContext may start
      if (meter && meter.ctx.state === "suspended") meter.ctx.resume();
      var p = audio.play();
      if (p && p.catch) p.catch(function () { setPerforming(false); });
    }
    function toggle() {
      if (audio.paused) play(); else { wantsPlay = false; audio.pause(); }
    }

    audio.loop = false; // looping is handled below so it returns to `startAt`
    audio.addEventListener("playing", function () { setPerforming(true); if (meter) meter.run(); });
    audio.addEventListener("pause", function () { setPerforming(false); });
    audio.addEventListener("ended", function () {
      if (loop && wantsPlay) { audio.currentTime = startAt; audio.play().catch(function () {}); }
      else { wantsPlay = false; setPerforming(false); }
    });
    audio.addEventListener("error", function () {
      console.warn("Invitation: music file could not be loaded: " + src);
      wantsPlay = false;
      setPerforming(false);
      button.hidden = true;
      listen.hidden = true;
      $("gate-sound").hidden = true;
    });
    button.addEventListener("click", toggle);
    listen.addEventListener("click", toggle);

    // be polite: pause when the guest switches away, resume when they return
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { if (!audio.paused) audio.pause(); }
      else if (wantsPlay) audio.play().catch(function () {});
    });

    /*
     * Live loudness → --level on the stage (drives the halo's breathing).
     * Only over http(s): routing a file:// audio element through Web Audio can
     * silence it, so in that case the halo pulses at `bpm` instead.
     */
    function createMeter() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !/^https?:$/.test(window.location.protocol) || reducedMotion.matches) {
        root.classList.add("no-analyser");
        return null;
      }
      try {
        var ctx = new AC();
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        ctx.createMediaElementSource(audio).connect(analyser);
        analyser.connect(ctx.destination);
        var bins = new Uint8Array(analyser.frequencyBinCount);
        var level = 0;
        var frame = 0;
        var onScreen = true;
        if ("IntersectionObserver" in window) {
          new IntersectionObserver(function (e) {
            onScreen = e[0].isIntersecting;
            if (onScreen) run();
          }).observe(stage);
        }
        function step() {
          frame = 0;
          if (audio.paused || !onScreen) return; // sleep while silent or scrolled away
          analyser.getByteFrequencyData(bins);
          var sum = 0;
          for (var i = 2; i < 40; i++) sum += bins[i];
          var target = Math.min(1, sum / (38 * 255) * 1.6);
          level += (target - level) * 0.3;
          setLevel(level.toFixed(3));
          frame = requestAnimationFrame(step);
        }
        function run() { if (!frame) frame = requestAnimationFrame(step); }
        return { ctx: ctx, run: run };
      } catch (e) {
        console.warn("Invitation: live audio analysis unavailable — using a steady pulse.", e);
        root.classList.add("no-analyser");
        return null;
      }
    }

    /*
     * Autoplay on load. Most browsers refuse sound before the guest's first tap; then
     * "Tap to open" starts it instead. No analyser yet: an AudioContext made without a
     * tap would stay suspended and silence the song. play() adds it on the first tap.
     */
    if (m.autoplay) {
      wantsPlay = true;
      audio.src = src;
      seekToStart();
      var attempt = audio.play();
      if (attempt && attempt.catch) attempt.catch(function () { /* blocked until the first tap */ });
    }

    return {
      start: function () { if (m.startOnOpen || m.autoplay) play(); },
    };
  }

  /* ── Scene entrances ─────────────────────────────────────── */

  /** The opening scene plays as the white page dissolves; the card reassembles when scrolled to. */
  function playStageIntro() {
    $("stage").classList.add("is-intro");
    $("stage-scene").classList.add("is-visible");
    if (window.InvitationWorld) window.InvitationWorld.start();
  }

  function setupStage() {
    var hero = $("invitation");
    if (!("IntersectionObserver" in window)) { hero.classList.add("is-open"); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || !root.classList.contains("is-opened")) return;
      hero.classList.add("is-open");
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(hero.querySelector(".card"));
    // the observer may have fired before the doors opened; check again afterwards
    setupStage.recheck = function () { io.disconnect(); io.observe(hero.querySelector(".card")); };
  }

  /* ── Opening ─────────────────────────────────────────────── */

  function setupGate() {
    var gate = $("gate");
    var main = $("main");
    var hero = $("invitation");
    var opened = false;

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    if (guestName) {
      $("gate-greeting").textContent = "Dear " + guestName + ",";
      $("gate-greeting").hidden = false;
    }

    gate.removeAttribute("aria-hidden");
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-label", "Invitation from " + coupleNames);
    main.inert = true;
    root.classList.add("is-locked");

    /*
     * The opening, choreographed in CSS (.gate.is-open): the words step back, the
     * portrait lifts gently, and the white page dissolves into the stage, which
     * starts its own intro underneath.
     */
    function open() {
      if (opened) return;
      opened = true;
      var quick = reducedMotion.matches;
      gate.classList.add("is-open");
      main.inert = false;
      root.classList.remove("is-locked");
      music.start(); // music.startOnOpen / autoplay — inside the tap, so browsers allow audio

      root.classList.add("is-opened");
      setTimeout(playStageIntro, quick ? 0 : 450);
      if (setupStage.recheck) setupStage.recheck();
      setTimeout(function () {
        gate.classList.add("is-gone");
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }, quick ? 0 : 1600);
    }

    gate.addEventListener("click", open);
    gate.addEventListener("keydown", function (e) {
      if (e.key === "Escape") open();
    });
    try { $("gate-button").focus({ preventScroll: true }); } catch (e) { /* older browsers */ }
  }
})();
