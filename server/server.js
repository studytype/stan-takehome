import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { AssemblyAI } from 'assemblyai';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function convertToMp4(inputPath, outputPath) {
  console.log('Converting video to MP4...');
  execSync(`ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`, {
    stdio: 'inherit'
  });
  return outputPath;
}

async function transcribeVideo(videoPath) {
  console.log('Transcribing with AssemblyAI...');
  
  const transcript = await assemblyai.transcripts.transcribe({
    audio: videoPath,
  });

  if (transcript.status === 'error') {
    throw new Error(transcript.error);
  }

  const captions = transcript.words.map(word => ({
    text: word.text,
    startMs: word.start,
    endMs: word.end,
  }));

  return { text: transcript.text, captions };
}


app.post('/api/process', upload.single('video'), async (req, res) => {
  const jobId = uuidv4();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    const videoPath = req.file.path;
    const outputPath = path.join(outputsDir, `${jobId}_output.mp4`);

    // Convert video to MP4 for browser compatibility
    const convertedFilename = `${jobId}_converted.mp4`;
    const convertedPath = path.join(uploadsDir, convertedFilename);
    
    console.log(`[${jobId}] Converting video to MP4...`);
    convertToMp4(videoPath, convertedPath);
    
    const videoUrl = `${BASE_URL}/uploads/${convertedFilename}`;

    console.log(`[${jobId}] Transcribing...`);
    const { text, captions } = await transcribeVideo(convertedPath);

    console.log(`[${jobId}] Bundling Remotion...`);
    const bundleLocation = await bundle({
      entryPoint: path.join(__dirname, 'remotion/index.js'),
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'CaptionedVideo',
      inputProps: { videoUrl, captions },
      timeoutInMilliseconds: 60000,
    });

    console.log(`[${jobId}] Rendering video...`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: { videoUrl, captions },
      timeoutInMilliseconds: 120000,
    });

    console.log(`[${jobId}] Done!`);
    res.json({
      success: true,
      videoUrl: `/outputs/${jobId}_output.mp4`,
      transcription: text
    });

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    res.status(500).json({ error: 'Processing failed', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
