import s3Client from './s3Client.js';

export async function uploadToS3(buffer, filename, bucketName) {
    const key = `uploads/${filename}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'video/mp4',
    }));
    
    const url = `https://${bucketName}.s3.${REGION}.amazonaws.com/${key}`;
    console.log('Uploaded:', url);
    return url;
  }
  ``