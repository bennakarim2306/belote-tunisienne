# Remaining views: inventory, groups and image prompts

Requested by Karim on 2026-11-25. Home, game table, their windows and the side menu are done. This plan covers everything
else: 10 screens and 6 windows, photographed in 45 states (`docs/anime/screenshots/remaining-views/overview-*.png`, made with
`scripts/anime/shoot-views.js` and made-up data).

## How each group runs

1. Karim makes the images of ONE group with the prompts below and sends them.
2. I look at every image (transparency, cut-off parts, text, gaps), cut them, and say at once if one must be redone.
3. I build the screens of that group, only for the new design; original, texts, buttons and server calls stay the same.
4. Tests in the new design, in the old one by build flag and in the old one by the profile toggle; screenshots.
5. Karim tests on the phone. Only then the next group.

## Overview

| Group | Screens and windows | New images |
|---|---|---|
| 1 Find players and private room | matchmaking, private room, join by link, share, seat choice, invite friends | 4 |
| 2 Learn to play | lesson list, lesson page | 4 |
| 3 Ranking and friends | ranking, friends, invite to game | 2 |
| 4 Profile | profile, avatar choice, statistics, settings, feedback, delete account | 3 |
| 5 Sign in and start | loading at start, sign in, register | 1 |
| 6 Last details | no images, see the end | 0 |

Already painted and reused everywhere: window frame, title ribbon, buttons (green, red, dark, square), small panel, pill,
row plaque, portraits, seat frame, card back, logo, 24 icons, 16 emblems.

## Not changed on purpose

- WhatsApp, Facebook, Instagram, Google logos and the Apple sign-in button (their owners prescribe the look).
- Ads container, system dialogs (notification permission), server texts, all texts of the app.
- App icon and the native splash picture: separate decision, they need a new store build.

## Rules inside every prompt

Transparent background (except backgrounds), no text, letters or numbers, original work. Elements on a sheet are one
connected object each, with a wide empty gap. The app writes all texts and numbers itself.

---

# Group 1: find players and private room

| Where | Part | How |
|---|---|---|
| matchmaking | background (flat green today) | **1.1 bg_duel** |
| matchmaking | three wobbling cards | card back, turning steadily like the design switch |
| matchmaking | title, player count, time, hint | ivory / gold text on a small panel |
| matchmaking | my place, partner, found players | portraits in the painted seat frame, name plaque |
| matchmaking | empty places (dashed circle) | **1.4 empty_player** in the seat frame |
| matchmaking | partner badge pending / joined | **1.3 hourglass** / existing duo icon |
| matchmaking | "match found" moment | **1.4 match_found** |
| matchmaking | accept button, waiting for others, warning | green button, panel |
| matchmaking | ELO range, duo only | pill, existing elo and duo icons |
| matchmaking | declined / cancelled / expired | **1.4 declined** |
| matchmaking | invite friends, cancel search | existing add-friend icon, buttons |
| room, join | background | **1.2 bg_salon** |
| room | back arrow | **1.3 back** on the square button |
| room | code card, share code | window frame, **1.3 share** |
| room | match type, time limit | pill, existing quick / normal icons |
| room | invite, start, waiting for host | existing buttons and icon |
| room | 4 seats, free seat, host, team | panel, seat frame, **1.3 sit_here**, **1.3 host_star**, small red / green plaque |
| room | room closed (also after a link) | **1.4 room_closed** |
| join | code, spinner | logo, turning card |
| share window | frame, copy link, more options | window frame, **1.3 link**, **1.3 more** |
| seat choice, invite friends | windows, rows, buttons | window frame, row plaque, buttons |

Seen while photographing: on small phones the matchmaking screen is too full (cards cut off at the top, the hint hidden behind
"cancel"). The new layout will fit; the original is not touched.

## Prompt 1.1 bg_duel (background, opaque)

```
Create ONE background image for a mobile card game screen. Very wide landscape, 20:9 (for example 2000 x 900). Opaque, no transparency.
Style: the same emerald-and-gold Tunisian anime style as my previous images: painted, high detail, cinematic light. Palette: deep emerald #063F32, emerald #095442, antique gold #D6AC56, light gold #F4D68C, ivory #FFF5DF, near-black brown #17130E, red accent #D92932.
Scene: a monumental Tunisian courtyard at night just before a duel, seen from the front, perfectly symmetric in composition. On the far left a horseshoe arch lit by warm gold lantern light, on the far right a matching arch lit by red-gold light. Thin streams of glowing dust drift from both sides towards the middle. Starry deep emerald sky at the top, polished zellige floor with soft reflections at the bottom.
Very important: the middle 60 percent of the width is calm, dark and almost empty, because the app writes text and shows players there. All decoration stays in the outer 20 percent on the left and on the right. Nothing important in the top 12 percent or the bottom 12 percent.
No people, no animals, no cards, no table, no weapons, no text, no letters, no numbers, no logo, no flags, no religious symbols, no frame, no buttons. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 1.2 bg_salon (background, opaque)

```
Create ONE background image for a mobile card game screen. Very wide landscape, 20:9 (for example 2000 x 900). Opaque, no transparency.
Style: exactly the same emerald-and-gold Tunisian anime style as the previous background, painted, high detail. Same palette.
Scene: a private Tunisian salon in the evening, seen from the front, symmetric and cozy. Far left and far right: carved wooden mashrabiya windows with warm lantern light, emerald cushions on a low bench, a small brass tray with tea glasses. Back wall: dark emerald with a very faint arabesque pattern. Floor: dark carpet with a thin gold border.
Very important: the middle 70 percent of the width is calm, dark and even, because the app puts panels there. All decoration stays in the outer 15 percent on the left and on the right. Nothing important in the top 12 percent or the bottom 12 percent.
No people, no animals, no cards, no card table, no smoking, no alcohol, no text, no letters, no numbers, no logo, no flags, no religious symbols, no frame, no buttons. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 1.3 icons (sheet, 4 x 2)

```
Create ONE image: a sheet of 8 separate game icons in 4 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as my previous icon sheets: polished antique gold with emerald green enamel, fine Tunisian ornament, manga-style highlights, clean dark outline. Palette: gold #D6AC56, light gold #F4D68C, emerald #095442, deep emerald #063F32.
Each icon is ONE connected object, front view, centered in its cell, all about the same size, with at least 60 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes, readable when only 24 pixels tall. No loose particles.
Row 1, left to right:
1. a thick golden arrow pointing LEFT, with an emerald gem in the middle
2. three golden spheres joined by two thick golden bars (share symbol), emerald centers
3. two interlocked golden chain links, emerald inlay
4. three golden spheres in one horizontal row on one short emerald bar (more options)
Row 2, left to right:
5. a five-pointed golden star with a round emerald in the center
6. a golden hand, palm down, index finger pointing down at an emerald cushion it touches
7. a golden hourglass with emerald sand
8. a round golden medallion with an emerald ring and, inside, one round golden dot above one short vertical golden bar (information symbol)
Absolutely no text, no letters, no numbers, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols, no brand logos. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 1.4 emblems (sheet, 2 x 2)

```
Create ONE image: a sheet of 4 separate large emblems in 2 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as my previous emblem sheets: emerald-and-gold Tunisian anime style, painted, high detail, polished gold, emerald enamel, manga-style highlights, clean dark outline.
Each emblem is ONE connected object, front view, centered in its cell, all about the same size, with at least 80 pixels of empty transparent space around it, also towards the edges of the image. No loose particles, no rays that leave the object.
Row 1, left to right:
1. MATCH FOUND: two golden gauntlets bumping fists in front of a round emerald shield with a golden laurel rim, energetic and friendly
2. ROOM CLOSED: a closed Tunisian double door in a horseshoe arch, emerald wood with golden studs, held shut by one golden padlock
Row 2, left to right:
3. INVITATION DECLINED: an emerald envelope with a golden rim, torn in the middle but both halves still joined by its red wax seal
4. EMPTY PLAYER: a completely round medallion, dark emerald inside, with the plain golden outline silhouette of one person's head and shoulders wearing a small fez, no face, no ornament outside the circle
Absolutely no text, no letters, no numbers, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols, no brand logos. Original work, not resembling any existing game, film, anime or brand.
```

Check before sending: 1.1 and 1.2 calm and dark in the middle; 1.3 exactly 8 and 1.4 exactly 4 objects, none touching another or the image edge, checkerboard background really transparent, no letters.

---

# Group 2: learn to play

| Where | Part | How |
|---|---|---|
| both | background | **2.1 bg_hall** (also ranking, friends, profile) |
| both | back arrow, title, lesson number | back (1.3), ribbon |
| list | progress bar | **2.2 progress_track**, gold fill from the app |
| list | 14 lesson rows: open, current, locked, done | row plaque / panel, **2.4 lock**, **2.4 done** |
| list, page | 14 lesson pictures | **2.3** and **2.4**; existing: learn (1), contre (6), capot (7), belote (11) |
| list | final game | existing victory emblem, resume icon |
| page | paragraphs, tip | panel, **2.4 tip** |
| page | listen / stop | **2.4 speaker**, **2.4 stop** |
| page | OK button | green button |

## Prompt 2.1 bg_hall (background, opaque)

```
Create ONE background image for a mobile card game screen. Very wide landscape, 20:9 (for example 2000 x 900). Opaque, no transparency.
Style: exactly the same emerald-and-gold Tunisian anime style as my previous backgrounds, painted, high detail. Palette: deep emerald #063F32, emerald #095442, antique gold #D6AC56, near-black brown #17130E.
Scene: a quiet palace hall at night, seen from the front, symmetric. Far left and far right: one slim carved column with a hanging lantern. Back wall: very dark emerald with an extremely faint, even geometric zellige pattern.
Very important: this is a background for long lists. The middle 80 percent of the width is dark, even and calm from top to bottom. All decoration stays in the outer 10 percent on the left and on the right.
No people, no animals, no cards, no table, no text, no letters, no numbers, no logo, no flags, no religious symbols, no frame, no buttons. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 2.2 progress_track (single, sliced)

```
Create ONE single image: an empty horizontal progress bar frame, very wide 16:1, on a 1536 x 1024 canvas with real transparent background (PNG with alpha), centered, 1400 pixels wide.
Style: the same emerald-and-gold Tunisian anime style: thin polished gold rim, very dark emerald empty inside, one small gold diamond ornament at each rounded end.
The long middle part must be completely plain and uniform, because the app stretches it. Nothing inside, no fill, no ticks. No text, no letters, no numbers, no shadow, no background panel. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 2.3 lessons (sheet, 4 x 2)

```
Create ONE image: a sheet of 8 separate game icons in 4 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as my previous icon sheets: polished antique gold with emerald green enamel, fine Tunisian ornament, manga-style highlights, clean dark outline.
Each icon is ONE connected object, centered in its cell, all about the same size, with at least 60 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes, readable when only 32 pixels tall. No loose particles. Playing cards are blank or show only their back.
Row 1, left to right:
1. a blank golden playing card wearing a crown (trump)
2. a stack of three blank golden cards rising like stairs (values)
3. two golden hands holding one fan of card backs (the deal)
4. a golden megaphone with an emerald ring (the bidding)
Row 2, left to right:
5. a blank card with a thick golden arrow pointing up growing out of it (follow and go higher)
6. golden scissors cutting into a blank card (cut)
7. two blank cards joined by two curved golden arrows pointing in opposite directions (wrong card, swap)
8. a golden abacus with emerald beads (scoring)
Absolutely no text, no letters, no numbers, no card suits, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 2.4 lesson states (sheet, 4 x 2)

```
Create ONE image: a sheet of 8 separate game icons in 4 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as the sheet before: polished antique gold with emerald green enamel, fine Tunisian ornament, manga-style highlights, clean dark outline.
Each icon is ONE connected object, front view, centered in its cell, all about the same size, with at least 60 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes, readable when only 24 pixels tall. No loose particles.
Row 1, left to right:
1. a golden magnifying eye: one stylized eye with an emerald iris in a golden frame (reading the bids)
2. a golden fez with a glowing emerald gear attached to its front (playing cleverly)
3. a golden lantern with a bright light inside, shaped like a light bulb (tip)
4. a closed golden padlock with an emerald body (locked)
Row 2, left to right:
5. a round emerald seal with a golden rim and a large golden check mark (done)
6. a golden speaker with two sound waves joined to it by a thin bar (listen)
7. a golden square with rounded corners and an emerald center in a golden ring (stop)
8. a thick golden chevron pointing DOWN with an emerald gem (open section)
Absolutely no text, no letters, no numbers, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols, no brand logos. Original work, not resembling any existing game, film, anime or brand.
```

---

# Group 3: ranking and friends

| Where | Part | How |
|---|---|---|
| both | background | bg_hall (2.1) |
| both | menu button, title | square button + menu icon, ribbon |
| ranking | solo / duo switch | green / dark buttons, existing icons |
| ranking | my rank card | panel, seat frame, existing ranking icon |
| ranking | rows, my row, places 1 to 3, others | row plaque, **3.1 medals** (numbers written by the app) |
| ranking | scroll mark | gold line from the app |
| ranking | empty | **3.2 empty_ranking** |
| friends | online filter, presence dots | button, **3.1 gems** |
| friends | invite, search, clear | existing icons, pill, share (1.3) |
| friends | requests: accept / decline | **3.1 accept**, existing close icon |
| friends | rows: invite to game, offline heart, add, sent, friend | buttons, **3.1 heart**, existing add-friend, done (2.4) |
| friends | empty | **3.2 empty_friends** |
| friends | message box after a request | panel (today: white box, its text cannot be read) |
| invite to game | window, match type, two ways | window frame, buttons, existing online / solo icons |

## Prompt 3.1 medals and marks (sheet, 4 x 2)

```
Create ONE image: a sheet of 8 separate game icons in 4 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as my previous icon sheets: emerald-and-gold Tunisian anime style, polished metal, enamel, fine ornament, manga-style highlights, clean dark outline.
Each icon is ONE connected object, front view, centered in its cell, with at least 60 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes, readable when only 28 pixels tall. No loose particles.
Row 1, left to right, four round medals of exactly the same size and shape, each with a thin ornate rim and a PLAIN EMPTY flat center, because the app writes the number there:
1. gold medal
2. silver medal
3. bronze medal
4. dark emerald medal with a thin gold rim
Row 2, left to right:
5. a small round bright green glowing gem in a thin gold ring (online)
6. the same gem in dull grey in the same gold ring (offline)
7. a thick golden check mark with an emerald gem in its corner (accept)
8. a golden heart with an emerald center (friend)
Absolutely no text, no letters, no numbers, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 3.2 empty states (sheet, 2 x 1)

```
Create ONE image: a sheet of 2 separate large emblems side by side (2 columns, 1 row). Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as my previous emblem sheets: emerald-and-gold Tunisian anime style, painted, high detail, clean dark outline.
Each emblem is ONE connected object, front view, centered in its half, about the same size, with at least 100 pixels of empty transparent space around it, also towards the edges of the image. No loose particles.
Left: NO FRIENDS YET: a small round low Tunisian table with two tea glasses and two empty emerald cushions, all joined together, warm and inviting.
Right: NO RANKING YET: an empty golden podium with three steps and an emerald curtain behind it, all joined together.
Absolutely no text, no letters, no numbers, no people, no background panels, no shadows on the ground, no religious symbols. Original work, not resembling any existing game, film, anime or brand.
```

---

# Group 4: profile

| Where | Part | How |
|---|---|---|
| profile | background, menu, title | bg_hall, as group 3 |
| profile | head card: portrait, name, mail, 3 values | panel, seat frame, existing elo / duo, **4.3 podium** |
| profile | section rows: avatar, statistics, sound, design, language, feedback, rate, privacy | panel, **4.1**; star (1.3); chevron (2.4) |
| profile | 12 avatars, chosen one | portraits in the seat frame, gold ring |
| profile | 9 statistics | panel, **4.2**; existing victory, defeat, made, belote, capot |
| profile | ELO chart | gold bars from the app |
| profile | switches | **4.3 switch** on / off |
| profile | language buttons | green / dark buttons |
| profile | log out, delete, external link, version | buttons, **4.2** |
| feedback window | 3 moods, text field, buttons, thanks | window frame, **4.3 moods**, done (2.4) |
| delete window | warning, two buttons | window frame, **4.2 warning**, red / dark buttons |

## Prompt 4.1 settings (sheet, 4 x 2)

```
Create ONE image: a sheet of 8 separate game icons in 4 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as my previous icon sheets: polished antique gold with emerald green enamel, fine Tunisian ornament, manga-style highlights, clean dark outline.
Each icon is ONE connected object, front view, centered in its cell, all about the same size, with at least 60 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes, readable when only 24 pixels tall. No loose particles.
Row 1, left to right:
1. a golden hand mirror with an emerald glass (choose avatar)
2. three golden bars of rising height on one emerald base (statistics)
3. a golden speaker with two sound waves joined to it by a thin bar (sound on)
4. the same golden speaker crossed by one thick diagonal bar (sound off)
Row 2, left to right:
5. a golden paint brush lying on an emerald palette (design)
6. a golden globe carrying an emerald speech bubble without content (language)
7. an emerald speech bubble with a golden rim and three golden dots (feedback)
8. an emerald shield with a golden rim and a golden keyhole (privacy)
Absolutely no text, no letters, no numbers, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols, no brand logos. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 4.2 actions and statistics (sheet, 4 x 2)

```
Create ONE image: a sheet of 8 separate game icons in 4 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as the sheet before.
Each icon is ONE connected object, front view, centered in its cell, all about the same size, with at least 60 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes, readable when only 24 pixels tall. No loose particles.
Row 1, left to right:
1. an open golden door with a thick golden arrow going out to the right, joined to the door (log out)
2. a golden bin with a red enamel lid (delete)
3. a golden square frame with a thick golden arrow leaving through its top right corner (open outside)
4. a golden triangle with rounded corners, red enamel inside, with one short vertical golden bar above one golden dot (warning)
Row 2, left to right:
5. a small stack of card backs tied with an emerald ribbon (games played)
6. a round golden target with an emerald center and one golden arrow in it (win rate)
7. a golden scroll sealed with an emerald seal (contracts taken)
8. a golden flame with an emerald heart inside on a rising golden step (best streak)
Absolutely no text, no letters, no numbers, no card suits, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols, no brand logos. Original work, not resembling any existing game, film, anime or brand.
```

## Prompt 4.3 moods, switches, podium (sheet, 3 x 2)

```
Create ONE image: a sheet of 6 separate game icons in 3 columns and 2 rows. Landscape 1536 x 1024, real transparent background (PNG with alpha).
Style: exactly the same as the sheets before.
Each icon is ONE connected object, front view, centered in its cell, with at least 70 pixels of empty transparent space around it, also towards the edges of the image. Bold simple shapes. No loose particles.
Row 1, left to right, three round golden faces of exactly the same size, each wearing the same small emerald fez:
1. sad face
2. neutral face
3. delighted face with two emerald hearts as eyes
Row 2, left to right:
4. a horizontal pill-shaped switch in the OFF position: dark emerald track with a thin gold rim, golden knob on the LEFT
5. the same switch, exactly the same size, in the ON position: bright emerald track, golden knob on the RIGHT
6. a golden podium with three steps and an emerald front
Absolutely no text, no letters, no numbers, no grid lines, no cell borders, no background panels, no shadows on the ground, no religious symbols. Original work, not resembling any existing game, film, anime or brand.
```

---

# Group 5: sign in and start

| Where | Part | How |
|---|---|---|
| start | name, spinner | **5.1 bg_entry**, logo, turning card |
| sign in | background, name, suits, slogan | **5.1 bg_entry**, logo, text |
| sign in | language chips, sign in / register tabs | green / dark buttons |
| sign in | 3 fields, error, main button | window frame, pill fields, green button |
| sign in | Google, Apple | unchanged logos; Google on the dark button |

## Prompt 5.1 bg_entry (background, opaque)

```
Create ONE background image for the start screen of a mobile card game. Very wide landscape, 20:9 (for example 2000 x 900). Opaque, no transparency.
Style: exactly the same emerald-and-gold Tunisian anime style as my previous backgrounds, painted, high detail, cinematic.
Scene: the entrance of a white-and-blue Tunisian hillside village at blue hour above the sea, lanterns lighting up, bougainvillea, one large emerald studded door in a horseshoe arch on the far left, the sea and the stars on the far right.
Very important: the middle and right part (from 15 to 90 percent of the width) is calm and rather dark, because the app puts the logo and the sign-in window there. Nothing important in the top 12 percent or the bottom 12 percent.
No people, no animals, no text, no letters, no numbers, no logo, no flags, no religious buildings or symbols, no frame, no buttons. Original work, not resembling any existing place photo, game, film, anime or brand.
```

---

# Group 6: last details without new images

In-game player card (friend status, close), the line icons on the square buttons of the table, the profile toggle, portrait
gate (browser only), colours still written in code, image compression (about 26 MB), licence check of all generated images.
