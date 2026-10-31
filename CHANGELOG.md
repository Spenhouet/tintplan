# Changelog

## Unreleased

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
