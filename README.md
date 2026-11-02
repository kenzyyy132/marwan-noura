# Marwan & Noura — Wedding Invitation · مروان & نورا

An interactive, single-page invitation built from the couple's invitation artwork.
Plain HTML, CSS and JavaScript: no framework, no build step, no dependencies.
It is the original Om Kalthoum musical-evening invitation, in wine red, champagne and gold.

## The experience

1. **Opening.** A pure white page: the ring-proposal portrait in its gilded frame, «مروان & نورا»
   in nastaʿlīq calligraphy, and **Tap to open**. The portrait lifts gently and the white page
   dissolves into the invitation.
2. **Om Kalthoum (the first scene).** Unchanged from the original: she sings at the top of a grand
   staircase (now with a wine runner) inside a gold frame, with lanterns, garlands and branches.
   **Tap to Listen** plays the zaffa; she performs only while it plays.
3. **The invitation card.** Rebuilt layer by layer when you scroll to it, with a live countdown.
4. **The message arch.** Musicians at its corners, lanterns overhead, the original garlands along its sides.
5. **When & where.** Saturday 28 November 2026, 7:00 PM (Cairo time), a second live countdown,
   **Signorina Microblading and PMU** with *Get directions* / *View on Maps*, and **Add to calendar**.
6. **Closing.** The card as a keepsake, birds flying off in pairs, share and save buttons.

Behind it all runs the **romantic sky** from the reference invitation: gilded birds and
heart-tipped gold arrows crossing the screen, twinkling gold stars and small rising wine hearts.
Wine petals and gold dust drift over the page; gilded birds circle the stage.

Palette: deep wine #722F37, burgundy #800020, dark burgundy #4A1520, champagne #F5E6D3,
warm ivory #FFF9F2, gold #C6A15B. Everything that was pink in the original is now wine red.

Everything decorative pauses when the tab is hidden; under reduced motion nothing flies or drifts.
Add `?to=Name` to the link to greet a guest by name.

## Editing the details

Everything you'd change lives in **`js/config.js`**: names, date/time and time zone, venue name,
Maps link, directions target, RSVP (WhatsApp number or form URL, currently empty so the button is
hidden), music, and the message text.

> The lettering inside the card comes from the artwork itself (it reads «حفل خطوبتنا»).
> If the artwork changes, re-run the asset script below.

## Running it locally

```bash
python -m http.server 8000      # then open http://localhost:8000
```

Double-clicking `index.html` also works (the music then pulses at a steady tempo instead of
following the song's loudness).

## Publishing

Any static host works (Netlify Drop, GitHub Pages, Vercel, Cloudflare Pages). After deploying, set
`og:image` in `index.html` to the full `https://…/assets/og-image.jpg` URL so WhatsApp shows the preview.

The originals in `assets/` (`marwan & noura.png`, `Ornate Frame Children’s Ring Proposal.png`, the mp3)
are only inputs for the asset script; the page never loads them, so you can leave them out of the upload.

## Regenerating the artwork

- `tools/recolor_original.py "D:/WAAD & MUHAMMED"` takes the original invitation's watercolour
  garlands and damask pattern and recolours them (pink blossoms → wine red, sage damask → gold on champagne).
- `assets/art/flyers/` holds the gilded birds and star from the reference invitation.

## Regenerating the card layers

`tools/build_assets.py` derives the card layers in `assets/card/`, the portrait in `assets/gate/`,
the favicon and the social image from the originals in `assets/`. It never modifies them.

```bash
pip install opencv-python-headless numpy
python tools/build_assets.py
```

## Files

```
index.html            page structure (opening screen, stage, card, message, when & where, closing)
css/styles.css        design tokens (colours sampled from the card), layout, motion
js/config.js          ← your event details
js/main.js            opening sequence, countdowns, reveals, maps, calendar, RSVP, music, share
js/world.js           petals & gold dust, gilded birds, the romantic sky, butterfly, vines, parallax, taps
assets/gate/          the ring-proposal portrait, web-sized
assets/card/          layers cut from the card (plate, lettering, portrait) + recoloured original garlands
assets/art/           watercolour and gold artwork (branch, lantern, chandelier, frame, divider, paper)
assets/music/         the song
tools/build_assets.py card layers, portrait, favicon, social image
tools/recolor_original.py  original garlands + damask in the wine palette
```
