import sharp from 'sharp'

const gauge =
  '<path d="M2 20A10 10 0 0 1 22 20" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
  '<line x1="12" y1="20" x2="7" y2="9" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round"/>' +
  '<circle cx="12" cy="20" r="2" stroke="#4a9eff" stroke-width="3.5" fill="none"/>'

for (const size of [16, 48, 128]) {
  const rx = ((Math.round(size * 0.22)) / size) * 32
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="${rx}" fill="#0a0a0c"/>` +
    `<g transform="translate(2 1)">${gauge}</g></svg>`
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/icon${size}.png`)
}

console.log('icons generated')
