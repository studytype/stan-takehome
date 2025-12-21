export async function transcribeVideoWithAssemblyAI(filePath) {
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
  