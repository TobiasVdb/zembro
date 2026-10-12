# Silver Shield corner illustration

Built locally in Blender through Blender MCP. `build_scene.py` creates a separate scene and saves `silver-shield-corner-revised.blend`; render the active scene to regenerate `silver-shield-corner.png`. Requires Cycles with a CUDA-capable GPU (or change `scene.cycles.device` to `CPU`). No original artwork is modified.

The exterior is an illustrative reconstruction, not manufacturer CAD or an installation drawing. Reference features: opaque rounded cap, fine cap seam, tapered rear shell, compact corner saddle, round reset button, micro-USB recess and unlit indicator. The neutral white room uses a broad soft light and gentle fill; there is no coloured glow or simulated visible radar beam.

Visual references:

- Supplied `Y:/Zembro/Silver Shield Intro Deck.pdf`, page 3, mounted sensor and neutral lighting.
- Pontosense manufacturer product render: https://static.wixstatic.com/media/d20baf_ac619939d7ea4eac84269171952a2bc1~mv2.png
- Manufacturer installation guide (Pontosense Workshop): https://fccid.io/m/10c722d640d70e5d073683c019bc506dbf0c8eeb27ffb10a2b32491415f3e923.pdf

The guide describes powered corner installation, room calibration, and mmWave sensing without a camera or microphone. The illustration is editorial artwork; consult the actual installation instructions for mounting and coverage.

Web conversion uses the existing Sharp dependency:

```sh
node --input-type=module -e "import sharp from 'sharp'; await sharp('artwork/silver-shield/silver-shield-corner.png').webp({quality:88}).toFile('public/assets/silver-shield-corner-v2.webp')"
```

The CMS migration replaces only the original default sensor image and its default translated descriptions. Editor-selected media and custom descriptions are preserved.

## Dark mode

`build_dark_scene.py` copies the light scene, preserving geometry and camera, and changes only room materials, world illumination and light intensity/colour. It saves `silver-shield-corner-dark-revised.blend` and renders to `silver-shield-corner-dark.png`. Convert that PNG to `public/assets/silver-shield-corner-dark-v2.webp` with the same Sharp command above, substituting the filenames.

The `ambient.imageDark` CMS field holds the dark render independently of `ambient.image`. Both layers use identical placement and crossfade with the existing 450 ms theme transition. The inactive layer is hidden from assistive technology and keyboard focus; reduced-motion preferences disable the transition.

## Revised geometry

The mounted reference supplied on 12 October 2026 takes priority over the floating product view. The reconstruction now has a longer, almost parallel-sided barrel, rear seam and controls, and a lofted convex corner enclosure with narrow wall-contact wings and a rounded lower end. A perspective camera shows the taller oval front and the length of the barrel from the side. Power is concealed behind the enclosure in this composition. Both themes share this geometry and camera.

The v2 WebP assets preserve the previous renders. The `seed-v7-sensor-geometry` migration upgrades only references matching the old default media bytes, preserving custom selections and descriptions.

## Approved reverse view

The approved close-up from the room exploration faces right toward the homepage copy. `build_room_preview.py` creates the separate room review scene and detail camera; `build_reverse_scene.py` copies that composition into `silver-shield-reverse.blend` and `silver-shield-reverse-dark.blend`. The dark version retains the same geometry and camera, with teal walls and a broad cool key light keeping the white casing readable.

The approved light PNG is `silver-shield-reverse-detail-preview.png`; its matching dark render is `silver-shield-reverse-dark.png`. The homepage uses optimized `silver-shield-reverse.webp` and `silver-shield-reverse-dark.webp` copies. `seed-v8-reverse-view` replaces only references matching the previous default v2 artwork in either theme, preserving custom media, translated descriptions and intentionally empty selections. Earlier artwork and the wider room preview remain available for reference.
