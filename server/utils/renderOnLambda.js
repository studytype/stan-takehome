import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';

export async function renderOnLambda(videoUrl, captions) {
    console.log('Starting Lambda render...');
    
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SERVER_URL,
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