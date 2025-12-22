import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { renderWithCreatomate } from './utils/renderWithCreatomate.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// S3 setup (to upload video so Creatomate can access it)
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';

async function uploadToS3(buffer, key) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
  }));
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

const PORT = process.env.PORT || 3001;

app.post('/api/process', upload.single('video'), async (req, res) => {
  const jobId = uuidv4();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    console.log(`[${jobId}] Starting...`);

    // Step 1: Upload video to S3 (so Creatomate can access it)
    console.log(`[${jobId}] Uploading to S3...`);
    const videoUrl = await uploadToS3(req.file.buffer, `inputs/${jobId}.mp4`);

    // Step 2: Render with Creatomate (transcribes + adds captions automatically)
    console.log(`[${jobId}] Rendering...`);
    const outputUrl = await renderWithCreatomate(videoUrl);

    console.log(`[${jobId}] Done!`);
    res.json({
      success: true,
      videoUrl: outputUrl,
    });

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
