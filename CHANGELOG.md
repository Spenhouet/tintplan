# Changelog

## Unreleased

## 0.4.1 - 2026-11-01

### Fixes

- Pen colors are sorted the way pen charts are: grouped into color families (red, orange, yellow, green, turquoise, blue, violet, pink, brown, white and gray), each with a heading, and within a family as a smooth run from light to dark. The previous order jumped between light and dark every few pens.

## 0.4.0 - 2026-11-01

### Features

- My pens moved to Settings: choose whole sets or single pens from any brand and range. Each range shows how many of its pens you own.
- The pen picker in the editor is one list of your pens from all brands, sorted as a color gradient, with search. It no longer has brand, range or set selectors.
- Editor bar: the current pen on the left opens the picker. Next to it are the pens used on this page, most recent first, without the current one. The "+ Pens" button is gone.

## 0.3.0 - 2026-10-31

### Features

- New "Check areas" step after cropping: the detected areas light up with the scan animation and stay tinted, each in its own color. Changing line detection or gap closing finds the areas again right away, with a count of areas. Pinch to zoom in, tap to hide the areas.
- Three ways to show the page: clean lines, gray, or the original photo with its colors. The area detection is the same for all three.
- Much more reliable outline detection, also on pages that are already colored or shaded: colored fills, shading and gradients no longer split areas, faint outlines crossing dark shading are followed, and specks are merged away. Tested on colored and photographed coloring pages.
- My pens: mark the pens you own, one by one or by whole sets, and the pen picker shows only those. Each range shows how many of its pens you own.
- Brand and range are chosen from a list with color previews instead of a plain select.
- Replace a pen everywhere: tap Replace in the pens used list and pick the new pen. Undo from the message.
- Export shows a preview of the image before saving.
- Sheets close by swiping them down.
- New app icon.

### Fixes

- Take photo opens the camera in the Android app (it opened the gallery).
- The top border of the first box in a sheet was cut off.

## 0.2.0 - 2026-10-31

### Features

- Android app: a signed APK on every GitHub release, installable directly or through Obtainium. Exports go to the Android share sheet, the back button closes sheets first, and taps give a light haptic tick.
- Page transitions: screens slide in when going deeper and slide back when going up.
- A ring where a tap fills or erases an area, and a button to fit the page again after zooming.
- Editor toolbar with icon and label for each tool, sized for small phones.
- Photo preparation shows the step (1 / 2), crossfades between steps, keeps the preview visible while working, and has a more compact control panel.
- Area scan animation when a page opens for the first time: a light sweeps down the page and every detected area lights up in its own color with a glowing outline.
- Magnifier while dragging a page corner, with a crosshair for precise placement. Corners now follow the finger's movement instead of jumping under it.

### Fixes

- Layouts fit 360 px wide phones in English and German: empty library buttons, editor tools, photo preparation.
- The page fits the editor correctly when it first opens.
- Pen ranges show their brand in the picker, and pen counts use the right singular and plural.
- Shorter list of pen color sources in Settings.

## 0.1.0 - 2026-10-31

### Features

- Take a photo of a coloring page or pick one from the gallery.
- Crop and straighten the page by dragging its corners; the page is detected automatically on a darker background.
- Line cleanup: removes shadows and uneven light, turns lines black and paper white, removes specks. Adjustable strength, or skip it for clean images.
- Gap closing so color doesn't leak through small breaks in lines.
- Tap an area to fill it with a pen color. The pen code is written where the area has the most room.
- 17 palettes from Copic, Ohuhu, DecoTime, Faber-Castell, Caran d'Ache and Finecolour, with their sets.
- Pen picker with search by code, name or hex, pens on this page and recent pens.
- Erase, pick a pen from an area, undo and redo, replace or remove a pen everywhere.
- Pens used list with how many areas each pen fills.
- PNG export with or without codes and a list of the pens used. The PNG stays editable: importing it again restores the page.
- Pages are stored on the device. Installable as a PWA, works offline. English and German.
