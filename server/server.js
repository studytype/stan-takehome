import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { AssemblyAI } from 'assemblyai';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// AssemblyAI client
const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY
});

// Lambda config
const REGION = 'us-east-1';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;
const SERVE_URL = process.env.REMOTION_SERVE_URL;

// Temp directory
const tempDir = path.join(__dirname, 'temp');
fs.mkdirSync(tempDir, { recursive: true });

// Transcribe video with AssemblyAI
async function transcribe(filePath) {
  console.log('Transcribing...');
  const transcript = await assemblyai.transcripts.transcribe({ audio: filePath });
  
  if (transcript.status === 'error') {
    throw new Error(transcript.error);
  }
  
  return transcript.words.map(w => ({
    text: w.text,
    startMs: w.start,
    endMs: w.end
  }));
}

// Render video on Lambda
async function renderOnLambda(videoUrl, captions) {
  console.log('Starting Lambda render...');
  
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SERVE_URL,
    composition: 'CaptionedVideo',
    inputProps: { videoUrl, captions },
    codec: 'h264',
    maxRetries: 1,
  });

  console.log(`Render started: ${renderId}`);

  // Poll for completion
  while (true) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      region: REGION,
      functionName: FUNCTION_NAME,
    });

    if (progress.done) {
      console.log('Render complete!');
      return progress.outputFile;
    }

    if (progress.fatalErrorEncountered) {
      throw new Error(progress.errors[0]?.message || 'Render failed');
    }

    const percent = Math.round((progress.overallProgress || 0) * 100);
    console.log(`Progress: ${percent}%`);
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Main endpoint
app.post('/api/process', upload.single('video'), async (req, res) => {
  const jobId = uuidv4();
  const tempVideoPath = path.join(tempDir, `${jobId}.mp4`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    // Save video temporarily
    fs.writeFileSync(tempVideoPath, req.file.buffer);
    console.log(`[${jobId}] Video saved`);

    // Step 1: Transcribe
    const captions = await transcribe(tempVideoPath);
    console.log(`[${jobId}] Got ${captions.length} words`);

    // Step 2: Upload video to S3 for Lambda to access
    // For now, you need to upload to a public URL
    // In production, upload to S3 first
    const videoUrl = `file://${tempVideoPath}`; // This won't work with Lambda - see note below

    // Step 3: Render on Lambda
    const outputUrl = await renderOnLambda(videoUrl, captions);
    console.log(`[${jobId}] Done!`);

    // Clean up
    fs.unlinkSync(tempVideoPath);

    res.json({
      success: true,
      videoUrl: outputUrl,
      transcription: captions.map(c => c.text).join(' ')
    });

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});