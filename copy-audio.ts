import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'src', 'assets', 'audio');
const track1 = path.join(dir, 'track1.mp3');
const track2 = path.join(dir, 'track2.mp3');
const track3 = path.join(dir, 'track3.mp3');

fs.copyFileSync(track1, track2);
fs.copyFileSync(track1, track3);
console.log('Copied track1 to track2 and track3');
