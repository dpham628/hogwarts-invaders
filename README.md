# Hogwarts Invaders

A Harry Potter-themed Space Invaders game in plain HTML, CSS and JavaScript — no build step, no dependencies.

Open `index.html` in a browser (or serve the folder, e.g. `python3 -m http.server`) to play.

## How to play
- **Move:** Left/Right arrows or A/D
- **Cast a spell:** Space (short cooldown between shots). Every 10th spell is a bigger red **Stupefy** that also stuns enemies next to the one it hits.
- **Dragon:** every 20th spell summons a huge dark dragon (with a fanged, red-eyed face on its head) that flies back and forth and slowly sinks toward the castle. Its body shrugs off spells; hit its head 3 times (or once with Stupefy) before it lands, or you lose a life.
- **Spiders:** every 30th spell drops 3 spiders on webs at random spots. One spell kills a spider; if one reaches the ground you lose a life.
- **Golden Snitch:** hitting it also makes jagged rocks rain from the sky, crushing 1 or 2 enemies.
- Bats flutter in the background (scenery only), and an original upbeat waltz plays during a game (follows the Sound toggle).
- **Pick your wizard:** Hermione or Harry on the start screen (keys 1 / 2), or with the Wizard button in the header
- **Pause:** P or Esc · **Sound:** M
- Touch devices get on-screen Left / Cast / Right buttons.

Dementors and Death Eaters march across the sky as one formation, dropping a row each time they hit an edge and speeding up as their numbers thin. They cast spells back at you. Four Protego shields soak up hits from both sides until they crumble. You have 3 lives; the game ends when they run out or the formation reaches the castle. Clear the sky to advance to a faster, more aggressive level. Hit the rare Golden Snitch that zips across the top for bonus points, or shoot an incoming spell to cancel it.

| Enemy | Points |
| --- | --- |
| Death Eater captain | 40 |
| Death Eater | 20 |
| Dementor | 10 |
| Golden Snitch | 150+ (more on higher levels) |
| Dragon | 500+ (more on higher levels) |

Apart from the two character face photos in `img/`, all sprites are drawn on the canvas, and the sound effects are generated with the Web Audio API, so there are no image or audio assets. Your best score is saved in `localStorage`.

## Files
- `index.html`: page, HUD buttons, start, pause and game-over screens
- `style.css`: Gryffindor gold and red theme
- `js/space-invaders.js`: game loop, entities, collisions, sprites and sound
