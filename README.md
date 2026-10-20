# DartEye

Auto-scoring for a steel-tip dartboard with **one camera**, an **iPad** and a **TV**. Runs in Safari: no app install, no server, no account.

**▶ Play: https://kingtutz.github.io/darteye/**

## What it does

- **Automatic scoring** from a single webcam (or the iPad's own camera). It spots each new dart, finds the tip, and works out the score.
- **Auto-align**: finds the board in the camera picture and calibrates itself to about 1 mm.
- **Digital zoom** (pinch, two-finger pan, *Frame board*) without losing the calibration.
- **Your own board on the TV**: a straightened photo of your board from the camera, or a realistic drawn board.
- **Quick corrections**: tap a dart, then tap where it really landed. Undo works across turns.
- **Caller voice**, checkout suggestions with the target highlighted on the board, and averages / marks-per-round stats.
- Works without a camera too: tap the board to score.

## Games

| Classic | Practice | Arcade |
|---|---|---|
| X01 (301/501/701, double in/out) | Bob's 27 | Zombie Shooter |
| Cricket (standard, random, hidden) | 121 | Asteroid (co-op) |
| Around the Clock | Checkout Streak | Lumberjack |
| Shanghai | Power Scoring | |
| Killer | | |

1–8 players.

## Setup

1. Open the link above in Safari on the iPad. Mirror the screen to the TV with AirPlay, or a USB-C → HDMI adapter.
2. Connect a USB-C webcam (iPadOS 17+), or use the iPad's own camera. Mount it 30–60 cm from the board, off to the side or below, looking across at 30–45°.
3. Tap **📷 Camera**, then **Start**. Auto-align runs on its own. Then tap **🎯 Frame board** to zoom in.
4. Pull all darts and tap **Board is empty ✓**. Then throw.

Tip: in Safari, use *Share → Add to Home Screen* to run it full-screen.

## Code layout

No build step and no dependencies: plain HTML, CSS and JavaScript. The scripts are loaded in order by `index.html` and share one global scope, so keep that order when adding files.

| File | What's in it |
|---|---|
| `index.html` | Page layout: scoreboard, board, camera screen, dialogs |
| `css/style.css` | All styling |
| `js/util.js` | DOM helpers, saved settings |
| `js/board.js` | Board geometry and scoring, the drawn board, calibration maths |
| `js/simulator.js` | Fake camera for testing without a board |
| `js/camera.js` | Camera source, digital zoom, board photo |
| `js/autoalign.js` | Finds the board in the picture and calibrates |
| `js/detection.js` | Spots new darts and finds the tip |
| `js/checkout.js` | Checkout suggestions |
| `js/games.js` | Every game mode: rules, scoreboard text, targets |
| `js/sprites.js` | Drawn darts, zombies, asteroids, badges, trees |
| `js/turns.js` | Turn flow shared by all games: darts, corrections, undo, wins |
| `js/voice.js` | Caller voice |
| `js/render.js` | Drawing the scoreboard, board and camera preview |
| `js/calibration-ui.js` | Camera screen: calibration points, pinch zoom, settings |
| `js/app.js` | Buttons, new-game picker, main loop, start-up |

To add a game, add an entry to `MODES` in `js/games.js`. It shows up in the picker automatically.

## Running it locally

To serve it on your home network with HTTPS (Safari needs HTTPS for the camera):

```bash
pip install cryptography
python serve_https.py 8443
```

It prints the address to open and creates a certificate for your PC. To trust it, install it on the iPad from `https://<pc-ip>:8443/darteye.crt`. Then turn it on under *Settings → General → About → Certificate Trust Settings*.

## Testing without a board

Pick **Simulator** in the camera list. It renders a board at an angle and throws virtual darts, so you can try detection, auto-align and zoom with no camera.
