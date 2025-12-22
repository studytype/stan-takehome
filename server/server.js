import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { transcribeVideoWithAssemblyAI } from './utils/transcribeVideoWithAssemblyAI.js';
import { renderVideo } from './utils/renderVideo.js';
import s3Client from './clients/s3Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const BUCKET = process.env.S3_BUCKET;
const REGION = 'us-east-2';

// Upload to S3
async function uploadToS3(buffer, key, contentType) {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

// Temp/output directories
const tempDir = path.join(__dirname, 'temp');
const outputsDir = path.join(__dirname, 'outputs');
fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(outputsDir, { recursive: true });

const PORT = process.env.PORT || 3001;

app.post('/api/process', upload.single('video'), async (req, res) => {
  const jobId = uuidv4();
  const tempVideoPath = path.join(tempDir, `${jobId}.mp4`);
  const outputPath = path.join(outputsDir, `${jobId}_captioned.mp4`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    console.log(`[${jobId}] Starting...`);

    // Save locally for AssemblyAI
    fs.writeFileSync(tempVideoPath, req.file.buffer);

    // Step 1: Transcribe
    const captions = await transcribeVideoWithAssemblyAI(tempVideoPath);
    console.log(`[${jobId}] Got ${captions.length} words`);

    // Step 2: Upload input video to S3
    console.log(`[${jobId}] Uploading to S3...`);
    const videoUrl = await uploadToS3(req.file.buffer, `inputs/${jobId}.mp4`, 'video/mp4');

    // Step 3: Render
    await renderVideo(videoUrl, captions, outputPath);
    console.log(`[${jobId}] Rendered!`);

    // Step 4: Upload output to S3
    const outputBuffer = fs.readFileSync(outputPath);
    const outputUrl = await uploadToS3(outputBuffer, `outputs/${jobId}.mp4`, 'video/mp4');
    console.log(`[${jobId}] Done!`);

    // Cleanup local files
    fs.unlinkSync(tempVideoPath);
    fs.unlinkSync(outputPath);

    res.json({
      success: true,
      videoUrl: outputUrl,
      transcription: captions.map(c => c.text).join(' ')
    });

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
