import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { transcribeVideoWithAssemblyAI } from './utils/transcribeVideoWithAssemblyAI.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// AWS config
const REGION = process.env.REMOTION_AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;
const SERVER_URL = process.env.REMOTION_SERVER_URL;


// Temp directory
const tempDir = path.join(__dirname, 'temp');
fs.mkdirSync(tempDir, { recursive: true });


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

    console.log(`[${jobId}] Starting...`);

    // Save video temporarily (for AssemblyAI)
    fs.writeFileSync(tempVideoPath, req.file.buffer);

    // Step 1: Transcribe with AssemblyAI
    const captions = await transcribeVideoWithAssemblyAI(tempVideoPath);
    console.log(`[${jobId}] Got ${captions.length} words`);

    // Step 3: Upload video to S3
    const videoUrl = await uploadToS3(req.file.buffer, `${jobId}.mp4`, bucketName);

    // Step 4: Render on Lambda
    const outputUrl = await renderOnLambda(videoUrl, captions);
    console.log(`[${jobId}] Done!`);

    // Clean up temp file
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