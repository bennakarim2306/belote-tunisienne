# Anime Duel Redesign — Asset Brief, Stage 2 (game table)

Based on the real game screen (`frontend/app/game/[id].tsx`, `src/components/game/*`,
`src/components/PlayingCard.tsx`) and reference sheet 03 (table variant B).

## What the game screen really contains

| Element in the app | Today | Plan |
|---|---|---|
| Background + table | green gradient + faint pattern photo | **painted background + painted table top** |
| 4 seats (top, left, right, me bottom-left): avatar, turn ring, name, card count, dealer "D", bot / away badges, timer, bid / contract / chat bubbles | DiceBear avatar in a plain ring, text pills | **painted portrait frame + name plate**; badges, timer, bubbles stay code |
| Avatars (12 fixed characters in `src/avatars.ts`) | DiceBear cartoon heads | **12 anime portraits**, same 12 identities and names |
| Opponent cards | text "🂠 8" | small fan of **painted card backs**, count from real data |
| Deal animation | code card backs | same **card back** |
| Card faces (32 cards, hand, trick, last trick) | vector, drawn in code | **stay in code**: exact ranks/suits, sharp at every size |
| Score header (Nous · Eux, donne, target) and contract chip | text pills | **painted HUD panel** behind live text |
| Quit / pause / mute, chat, last trick | round code buttons | **painted square icon button** (emerald + red) |
| Bidding panel (4 suits, values, Passe, Capot, Contre, Annoncer), Surcontre panel, Capot dock, Capot button | code buttons | **3 painted button frames** (green, red, dark gold) |
| Hand-end result, match end, last trick, score history, pause, player card, chat sheet, quit dialog | dark cards | reuse the **two home panels** already delivered (no new asset) |
| Turn ring, "À toi" pill, banners, coach bubble, points fly | code | stay code |

No effects (fire, particles): out of scope for this workstream.

## Rules for every asset (same as home)

- One asset per image, centred, front view. Real transparent background unless marked opaque.
- No text, letters, numbers or icons inside frames and buttons: the app draws live text.
- No card faces, no scores, no player names painted anywhere.
- Same style as the home assets (emerald, antique gold, Tunisian arabesque).
- Save into `frontend/assets/anime/game/` or attach in the thread.

## Asset list

| # | File | What | Min. size | Transparent |
|---|---|---|---|---|
| 1 | `bg_game.png` | Arena background for the table screen, no table in it | wide ~20:9, as large as possible | no |
| 2 | `table_top.png` | The card table surface alone | 1800 × 900 | yes |
| 3 | `seat_frame.png` | Round portrait frame with empty centre | 600 × 600 | yes (incl. centre) |
| 4 | `nameplate.png` | Small empty name plaque | 700 × 200 | yes |
| 5 | `hud_panel.png` | Small empty score/contract panel | 900 × 450 | yes |
| 6 | `btn_green.png` | Empty wide button, emerald | 900 × 300 | yes |
| 7 | `btn_red.png` | Same button, red | 900 × 300 | yes |
| 8 | `btn_dark.png` | Same button, dark with gold rim | 900 × 300 | yes |
| 9 | `btn_icon_green.png` | Empty rounded-square icon button, emerald | 300 × 300 | yes |
| 10 | `btn_icon_red.png` | Same, red | 300 × 300 | yes |
| 11 | `card_back.png` | Back of a playing card | 600 × 870 | yes (outside the rounded corners) |
| 12–23 | `avatar_av1.png` … `avatar_av12.png` | 12 character portraits | 1024 × 1024 | no |

## Prompts

Send the setup message once, then one prompt per image, all in the ChatGPT conversation that
produced the home assets.

### Setup

```
Next set for my game "Belote Tunisienne": assets for the card table screen, in exactly the same anime emerald-and-gold Tunisian style as the home assets you made. Rules for every image:
- One single asset per image, centered, front view, filling most of the canvas.
- Real transparent background (PNG with alpha) unless I say "opaque". No backdrop, no shadow plate, no caption.
- No text, letters, numbers, card faces or icons unless I explicitly ask.
- Any glow must be soft and fade smoothly into transparency.
Confirm and wait for my first request.
```

### 1 — bg_game

```
Asset: game background, opaque, wide 20:9, highest resolution. A Tunisian palace courtyard at dusk seen straight on, darker and calmer than the home background: deep emerald walls with faint geometric mosaic, gilded horseshoe arches with columns, hanging lit lanterns and palm leaves only at the far left and far right edges, a glimpse of a white-and-blue medina through the arches. The whole central 70% of the image is empty, dark and calm (plain emerald wall above, dark tiled floor below) because a card table and cards will be drawn on top. No table, no cards, no people, no text.
```

### 2 — table_top

```
Asset: card table top, transparent background, wide 2:1 (1800 × 900 or larger). A luxurious card table seen from above with a slight tilt, stadium/oval shape. Emerald green felt surface with a very subtle darker arabesque medallion in the exact center and a faint concentric ring. Thick polished antique-gold rim with fine carved Tunisian ornament, thin inner gold line. Soft inner shadow near the rim. The felt must be clean and empty: no cards, no chips, no text, no symbols.
```

### 3 — seat_frame

```
Asset: round portrait frame, transparent background, square (600 × 600 or larger). An ornate antique-gold circular frame with small arabesque leaves and a tiny emerald gem at the top and bottom, like a medallion border for a character portrait. The inside of the circle is completely empty and transparent (a hole), and the outside is transparent too. Only the ring itself is painted. No face, no text.
```

### 4 — nameplate

```
Asset: name plaque, transparent background, wide 7:2 (700 × 200 or larger). A small horizontal plaque: dark emerald interior, polished gold rim, pointed ornamental ends left and right with a tiny gold star on each end. Completely empty inside, no text.
```

### 5 — hud_panel

```
Asset: small HUD panel, transparent background, 2:1 (900 × 450 or larger). A rectangular panel with rounded corners: very dark emerald interior, polished gold rim, small arabesque ornament in each corner kept close to the corners, a small gold crest centered on the top edge. Completely empty inside: no text, no numbers, no dividers.
```

### 6 — btn_green

```
Asset: game button, transparent background, wide 3:1 (900 × 300 or larger). A wide button with rounded pointed ends: glossy emerald green interior with a soft top highlight, thick polished gold rim, small gold ornament at the left and right ends. Completely empty inside, no text.
```

### 7 — btn_red

```
Asset: same button as the previous one, identical shape, size, rim and ornaments, but the interior is deep Tunisian red (#B01E28) with a soft top highlight. Empty, no text. Transparent background.
```

### 8 — btn_dark

```
Asset: same button again, identical shape, size, rim and ornaments, but the interior is near-black warm brown (#17130E). Empty, no text. Transparent background.
```

### 9 — btn_icon_green

```
Asset: icon button, transparent background, square (300 × 300 or larger). A rounded-square button: dark emerald interior with a soft highlight, polished gold rim. Completely empty inside, no icon, no text.
```

### 10 — btn_icon_red

```
Asset: same icon button, identical shape, size and rim, but the interior is deep red (#B01E28). Empty, no icon, no text. Transparent background.
```

### 11 — card_back

```
Asset: back of a playing card, portrait format ratio 100:145 (600 × 870 or larger), rounded corners, transparent outside the corners. Original design: deep red field with a fine gold Tunisian geometric lattice, a gold eight-pointed star medallion in the center, thin ivory border and thin gold inner frame. Symmetric top to bottom. No text, no letters, no suit symbols, no logo.
```

### 12–23 — character portraits

Send this once:

```
Now 12 character portraits for the players' avatars. Rules for all 12:
- Original anime-style characters (not from any existing anime, manga or game), all in one consistent art style: same line weight, same soft cel shading, light from the upper left.
- Square 1024 × 1024, opaque. Head and shoulders, face centered and large, looking slightly toward the viewer, clear expression readable at very small size.
- Background: plain dark emerald with a soft radial glow, identical for all 12.
- Tunisian-inspired clothing and accessories. No text, no frame, no border.
I will describe one character per message.
```

Then one message each:

```
Portrait 1, "Si Brahim": jovial older man, about 65, grey moustache, red chechia hat, white jebba, warm knowing smile.
```
```
Portrait 2, "Tata Zakia": cheerful aunt, about 55, colourful headscarf, gold earrings, round glasses, teasing smile.
```
```
Portrait 3, "Chef Slim": sturdy cook, about 40, white chef jacket, short beard, confident grin, one raised eyebrow.
```
```
Portrait 4, "Docteur Hichem": slim man, about 45, glasses, neat side-parted hair, white coat over a shirt, calm analytical look.
```
```
Portrait 5, "Fatma la Rusée": clever young woman, about 28, long dark wavy hair, red scarf on her shoulders, sly half-smile, sharp eyes.
```
```
Portrait 6, "Si Mongi": dignified man, about 60, short white beard, dark burnous cloak, serious poker face.
```
```
Portrait 7, "Baya Baklawa": sweet young woman, about 24, hair in a bun with a jasmine flower, pastel green traditional vest, bright happy smile.
```
```
Portrait 8, "Hamma Turbo": energetic young man, about 22, spiky dark hair, sporty jacket in red and white, excited competitive grin.
```
```
Portrait 9, "Lella Zohra": elegant grandmother, about 70, white safsari veil, silver jewellery, gentle wise smile.
```
```
Portrait 10, "Farhat Fantasia": proud horseman, about 35, blue turban, trimmed black beard, embroidered vest, bold heroic look.
```
```
Portrait 11, "Aziza Harissa": fiery woman, about 30, curly dark hair with a red headband, gold hoop earrings, daring smirk.
```
```
Portrait 12, "Mokhtar le Malin": lean trickster, about 38, messy hair, thin moustache, striped shirt and vest, mischievous wink.
```

## Notes

- The character descriptions are proposals built on the 12 existing avatar names; change any of
  them freely. Replacing the production avatars happens only after the set is approved.
- If a "same as previous" result changes shape, say: `Keep the exact same shape and size as the previous button, only change the interior colour.`
- If a background comes back painted in: `Same image, but with a real transparent background.`
