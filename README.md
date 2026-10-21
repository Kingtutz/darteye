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

## More cameras, more accuracy

Each camera sees a dart as a line. Mapped onto the board, that line runs through the tip, so lines from cameras at different angles cross at the tip. DartEye combines every camera's view of each dart. When cameras disagree, for example one picked the wrong end of the dart or saw a shadow, a vote throws out the odd one.

In simulator tests on 30 darts, a single camera scored 26–27 correctly, with occasional big misses. Three cameras together scored 29/30, with a median error of 1.2 mm and a worst of 2.4 mm.

- **On a PC or Mac:** plug in 2–3 USB webcams, then on the camera screen tap **+ Add camera** for each.
- **On an iPad:** Safari can run only one camera at a time. Add more angles with phones: tap **📱 Phone camera**, scan the QR code with a phone, stand the phone up, and tap **✨ Auto-align** on it. The phone does its own detection and sends only the dart's position, not video. Both devices must be on the same Wi-Fi.
- Spread cameras around the board, ideally 90° or more apart. Cameras close together see the dart along nearly the same line, which helps much less.

Phone pairing loads [PeerJS](https://peerjs.com) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) only when you open it. PeerJS's free server introduces the two devices; after that they talk directly.

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
| `js/simulator.js` | Fake cameras (three angles) for testing without a board |
| `js/camera.js` | Cameras: adding/removing, digital zoom, calibration, board photo |
| `js/autoalign.js` | Finds the board in the picture and calibrates |
| `js/detection.js` | Spots new darts in each camera and finds the tip and the dart's line |
| `js/fusion.js` | Combines every camera's view of a dart into one position |
| `js/checkout.js` | Checkout suggestions |
| `js/games.js` | Every game mode: rules, scoreboard text, targets |
| `js/sprites.js` | Drawn darts, zombies, asteroids, badges, trees |
| `js/turns.js` | Turn flow shared by all games: darts, corrections, undo, wins |
| `js/voice.js` | Caller voice |
| `js/render.js` | Drawing the scoreboard, board and camera preview |
| `js/calibration-ui.js` | Camera screen: calibration points, pinch zoom, settings |
| `js/app.js` | Buttons, new-game picker, main loop, start-up |
| `js/helper.js` | Phones as helper cameras: QR pairing and sending darts to the main screen |

To add a game, add an entry to `MODES` in `js/games.js`. It shows up in the picker automatically.

## Running it locally

To serve it on your home network with HTTPS (Safari needs HTTPS for the camera):

```bash
pip install cryptography
python serve_https.py 8443
```

It prints the address to open and creates a certificate for your PC. To trust it, install it on the iPad from `https://<pc-ip>:8443/darteye.crt`. Then turn it on under *Settings → General → About → Certificate Trust Settings*.

## Testing without a board

Pick **Simulator view** in the camera list and tap **+ Add camera**. Add it up to three times to get three angles. It renders a board and throws virtual darts, so you can try detection, auto-align, zoom and multi-camera with no hardware.
