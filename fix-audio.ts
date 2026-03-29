import fs from 'fs';
import path from 'path';

const urls = [
  { url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', name: 'track1.mp3' },
  { url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_80f8361b7e.mp3', name: 'track2.mp3' },
  { url: 'https://cdn.pixabay.com/audio/2021/11/24/audio_91b3cb0036.mp3', name: 'track3.mp3' }
];

async function download() {
  const dir = path.join(process.cwd(), 'src', 'assets', 'audio');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const item of urls) {
    console.log(`Downloading ${item.name}...`);
    try {
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://pixabay.com/'
        }
      });
      if (!res.ok) {
        console.error(`Failed to download ${item.name}: ${res.status} ${res.statusText}`);
        continue;
      }
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(path.join(dir, item.name), Buffer.from(arrayBuffer));
      console.log(`Saved ${item.name} (${arrayBuffer.byteLength} bytes)`);
    } catch (err) {
      console.error(`Error downloading ${item.name}:`, err);
    }
  }
}

download();
