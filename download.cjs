const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
  { url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', name: 'track1.mp3' },
  { url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_80f8361b7e.mp3', name: 'track2.mp3' },
  { url: 'https://cdn.pixabay.com/audio/2021/11/24/audio_91b3cb0036.mp3', name: 'track3.mp3' }
];

const dir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

urls.forEach(item => {
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://pixabay.com/'
    }
  };

  https.get(item.url, options, (res) => {
    if (res.statusCode === 200) {
      const file = fs.createWriteStream(path.join(dir, item.name));
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${item.name}`);
      });
    } else {
      console.log(`Failed to download ${item.name}: ${res.statusCode}`);
    }
  }).on('error', (err) => {
    console.log(`Error downloading ${item.name}: ${err.message}`);
  });
});
