import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function renderVideo(videoUrl, captions, outputPath) {
  console.log('Bundling Remotion...');
  
  const bundleLocation = await bundle({
    entryPoint: path.join(__dirname, '../remotion/index.js'),
  });

  console.log('Selecting composition...');
  
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'CaptionedVideo',
    inputProps: { videoUrl, captions },
    timeoutInMilliseconds: 120000, // 2 min timeout for video download
  });

  console.log('Rendering video...');
  
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { videoUrl, captions },
    timeoutInMilliseconds: 120000, // 2 min timeout per frame
  });

  console.log('Render complete!');
  return outputPath;
}