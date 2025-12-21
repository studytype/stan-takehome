import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { AssemblyAI } from 'assemblyai';
import { renderMediaOnLambda, getRenderProgress, getOrCreateBucket } from '@remotion/lambda/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

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

// AWS config
const REGION = process.env.REMOTION_AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;
const SERVE_URL = process.env.REMOTION_SERVE_URL;

// S3 client
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY,
  }
});

// Temp directory
const tempDir = path.join(__dirname, 'temp');
fs.mkdirSync(tempDir, { recursive: true });

// Upload video to S3
async function uploadToS3(buffer, filename, bucketName) {
  console.log('Uploading to S3...');
  
  const key = `uploads/${filename}`;
  
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
  }));
  
  const url = `https://${bucketName}.s3.${REGION}.amazonaws.com/${key}`;
  console.log('Uploaded:', url);
  return url;
}

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

    console.log(`[${jobId}] Starting...`);

    // Save video temporarily (for AssemblyAI)
    fs.writeFileSync(tempVideoPath, req.file.buffer);

    // Step 1: Transcribe with AssemblyAI
    const captions = await transcribe(tempVideoPath);
    console.log(`[${jobId}] Got ${captions.length} words`);

    // Step 2: Get Remotion's S3 bucket
    const { bucketName } = await getOrCreateBucket({ region: REGION });

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