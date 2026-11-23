#!/usr/bin/env node
// Regenerates the isometric illustration partials in src/partials/.
// Edit the scene scripts here, never the generated SVGs by hand.
//   equipment.mjs       → equipment-illust.svg        (slide 10)
//   studio.mjs          → studio-overview.svg, studio-inspect.svg (slide 14)
//   warehouse.mjs       → warehouse-route-scene.svg (slide 5), warehouse-cover-scene.svg (slide 1)
import './equipment.mjs';
import './studio.mjs';
import './warehouse.mjs';
