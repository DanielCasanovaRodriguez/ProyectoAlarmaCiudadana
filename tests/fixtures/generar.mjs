// Genera imágenes SINTÉTICAS (datos ficticios) del reverso de cédulas para pruebas.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const bwipjs = require('bwip-js');
const campo = (v, n) => (v + '\0'.repeat(n)).slice(0, n);
let s = campo('03012345678', 48) + campo('1012345678', 10) + campo('GONZALEZ', 23) + campo('MARIN', 23)
      + campo('MARIA', 23) + campo('GABRIELA', 23) + '0F19900128110010O+';
s = campo(s, 531);
const png = await bwipjs.toBuffer({ bcid: 'pdf417', text: s, binarytext: true, scale: 4, eclevel: 5,
  paddingwidth: 60, paddingheight: 120, backgroundcolor: 'F4F0E0' });
writeFileSync(new URL('./cedula-amarilla-reverso-sintetica.png', import.meta.url), png);
console.log('PNG', png.length, 'bytes');
