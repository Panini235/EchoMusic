# EchoMusic 沉浸式资料库设计 QA

- Source visual truth: `/Users/admin/.codex/generated_images/019fcbd2-efbc-7242-998d-8a73ceb77352/exec-3965f5ec-cea2-4266-bd56-3f7b89799ea6.png`
- Source pixels: `853 x 1844` (approximately `390 x 844` at 2.187x density)
- Intended implementation viewport: Android portrait, approximately `390 x 844 dp`
- Implementation screenshot: unavailable
- State: dark home screen, configured or locally usable library, optional current/recent music
- Density normalization: not performed because no implementation capture exists

## Findings

- [Blocked] No rendered Android implementation was available for visual comparison.
  - Evidence: the source visual was opened and inspected, but this workspace has no connected Android device, Android virtual device, or iOS simulator from which to capture the React Native screen.
  - Impact: typography, exact spacing, artwork crop, bottom-dock fit, and compact-device overflow cannot be certified from source code alone.
  - Required fix: install the GitHub Actions APK on an Android device, capture the home screen at the same dark-state viewport, and compare it with the source in one combined image.

## Required fidelity surfaces

- Fonts and typography: code uses the existing EchoMusic text scale and weights; rendered wrapping and optical weight remain unverified.
- Spacing and layout rhythm: the selected hierarchy is implemented (search pill, immersive hero, recent playback, playlists, mini-player, bottom dock); exact rendered rhythm remains unverified.
- Colors and visual tokens: near-black surfaces and warm coral/amber accents map to the selected direction; device rendering remains unverified.
- Image quality and asset fidelity: user artwork and the existing EchoMusic raster logo are used; crop and fallback behavior remain unverified on device.
- Copy and content: Simplified Chinese, Traditional Chinese, and English keys have parity and parse successfully.

## Full-view comparison evidence

Blocked: no implementation screenshot is available.

## Focused region comparison evidence

Blocked: no implementation screenshot is available. The key regions to capture are the search/control-center header, continue-listening card, recent-play carousel, bottom player/dock stack, right drawer, and startup transition.

## Comparison history

- Iteration 1: source visual resolved and implementation completed; rendered capture blocked by the absence of a device or emulator.

## Implementation checklist

- Build the Android APK in GitHub Actions.
- Install the APK on a portrait Android device.
- Capture the dark home screen and right control center.
- Compare at matching aspect ratio and fix any P0/P1/P2 visual drift.

final result: blocked
