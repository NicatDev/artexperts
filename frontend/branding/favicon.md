# Art Experts favicons

The favicon uses a square, text-free version of the gold brand monogram.
It was prepared with the built-in `image_gen` tool using
`public/art-expert-logo.png` as the reference. The project master is
`public/favicon-512x512.png`.

## Exported assets

- `public/favicon-96x96.png`: Google Search and browser icon.
- `public/favicon-192x192.png`: larger browser icon.
- `public/favicon-512x512.png`: reusable square master.
- `src/app/apple-icon.png`: 180 × 180 Apple touch icon.
- `src/app/favicon.ico`: 16, 32, 48, 64, 96, 192 and 256 px frames.

The locale layout declares the PNG and Apple icons explicitly. Keep the public
URLs stable. Google must recrawl the deployed homepage before its search icon can
update; publishing these files does not itself request indexing.

## Generation prompt

Create a favicon source from the supplied existing Art Experts brand image. This is a faithful asset extraction edit, not a redesign: isolate only the original interlocking gold A/E monogram, circular open gold arc and diagonal paintbrush above the ART EXPERT lettering. Preserve the distinctive shapes, arrangement, gold metallic finish and relative positions of every part of that exact existing emblem. Exclude the ART EXPERT wordmark entirely; no text whatsoever. Center the complete emblem on a plain very light ivory-white square background, enlarge so it fills about 84 percent of the square in width and height with balanced safe margins; no clipped brush tip or letter feet. A clean readable square app/favicon master with the original brand appearance, no extra ornaments, no added shadows or badges. High resolution.
