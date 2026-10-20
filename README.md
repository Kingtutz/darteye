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

## Running it locally

The whole app is one file, `index.html`. To serve it on your home network with HTTPS (Safari needs HTTPS for the camera):

```bash
pip install cryptography
python serve_https.py 8443
```

It prints the address to open and creates a certificate for your PC. To trust it, install it on the iPad from `https://<pc-ip>:8443/darteye.crt`. Then turn it on under *Settings → General → About → Certificate Trust Settings*.

## Testing without a board

Pick **Simulator** in the camera list. It renders a board at an angle and throws virtual darts, so you can try detection, auto-align and zoom with no camera.
