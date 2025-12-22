import s3Client from '../clients/s3Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
export async function uploadToS3(buffer, filename, bucketName) {
    const key = `uploads/${filename}`;
    
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
    }));
}