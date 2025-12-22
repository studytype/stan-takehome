import Creatomate from 'creatomate';
import dotenv from 'dotenv';

dotenv.config();
const client = new Creatomate.Client(process.env.CREATOMATE_API_KEY);

export async function renderWithCreatomate(videoUrl) {
  console.log('Starting Creatomate render...');

  const renders = await client.render({
    source: new Creatomate.Source({
      outputFormat: 'mp4',
      width: 1080,
      height: 1920,
      elements: [
        // Video element
        new Creatomate.Video({
          id: 'video-1',
          source: videoUrl,
        }),
        // Auto-generated subtitles
        new Creatomate.Text({
          transcriptSource: 'video-1',      // Links to video above
          transcriptEffect: 'highlight',     // Word-by-word highlight
          transcriptMaximumLength: 3,        // 3 words at a time
          y: '80%',
          width: '90%',
          height: '25%',
          xAlignment: '50%',
          yAlignment: '50%',
          fillColor: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: '1.5 vmin',
          fontFamily: 'Montserrat',
          fontWeight: '800',
          fontSize: '8 vmin',
        }),
      ],
    }),
  });

  // Wait for render to complete
  const render = renders[0];
  console.log(`Render complete: ${render.url}`);
  return render.url;
}