import fs from 'fs';

async function list() {
  const res = await fetch('https://api.github.com/repos/photonstorm/phaser3-examples/contents/public/assets/audio');
  const data = await res.json();
  console.log(data.filter(d => d.name.endsWith('.mp3')).map(d => d.name));
}
list();
