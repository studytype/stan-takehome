import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const REGION = process.env.AWS_REGION || 'us-east-2';

const s3Client = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY,
    }
});

export default s3Client;