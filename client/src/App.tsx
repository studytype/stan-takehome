import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ videoUrl: string; transcription: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number | null>(null);

  // Timer effect for tracking elapsed time during processing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (status === 'uploading' || status === 'processing') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 100);
    } else if (status === 'complete') {
      if (startTimeRef.current) {
        setFinalTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        startTimeRef.current = null;
      }
    } else {
      startTimeRef.current = null;
      setElapsedTime(0);
    }

    return () => clearInterval(interval);
  }, [status]);

  //@ts-ignore
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const onFile = (f: File | null) => {
    if (f?.type.startsWith('video/')) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setStatus('idle');
      setResult(null);
      setError(null);
    }
  };

  const process = async () => {
    if (!file) return;
    setStatus('uploading');
    setProgress(0);

    const form = new FormData();
    form.append('video', file);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        const pct = Math.round((e.loaded * 100) / e.total);
        setProgress(pct);
        if (pct === 100) setStatus('processing');
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setResult(data);
          setStatus('complete');
        } else {
          const data = JSON.parse(xhr.responseText);
          setError(data.error || 'Something went wrong');
          setStatus('error');
        }
      };

      xhr.onerror = () => {
        setError('Network error');
        setStatus('error');
      };

      xhr.open('POST', 'https://stan-takehome.onrender.com/api/process');
      xhr.send(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const downloadVideo = async () => {
    if (!result?.videoUrl) return;
    
    try {
      const response = await fetch(result.videoUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `captioned-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = result.videoUrl;
      link.download = `captioned-video-${Date.now()}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white relative overflow-hidden">
      {/* Decorative dots */}
      <div className="absolute left-4 top-1/4 space-y-2 z-10">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
      </div>
      <div className="absolute right-4 top-1/3 space-y-2 z-10">
        <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
      </div>
      <div className="absolute left-8 bottom-1/4 space-y-2 z-10">
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
      </div>
      <div className="absolute right-8 bottom-1/3 space-y-2 z-10">
        <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-6xl">🎬</span>
            <h1 className="text-6xl font-black text-blue-500">CapSnap</h1>
          </div>
          <p className="text-lg text-gray-500">Add captions to your videos instantly. Instant TikTok-style captions.</p>
        </header>

        {/* Main content */}
        <main>
          {/* Upload state */}
          {status === 'idle' && !file && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-2xl p-32 text-center cursor-pointer hover:border-blue-400 transition-colors bg-white min-h-[70vh] flex flex-col items-center justify-center"
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="text-8xl mb-6">🎬</div>
              <p className="text-2xl font-medium text-gray-700 mb-2">Drop your video here</p>
              <p className="text-xl text-gray-400">or click to browse</p>
            </div>
          )}
            {/* Preview state */}
            {status === 'idle' && file && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <video src={preview!} controls className="w-full rounded-xl mb-4 max-h-[500px] bg-black" />
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={reset}
                    className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={process}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    ✨ Add Captions
                  </button>
                </div>
              </div>
            )}

            {/* Processing state */}
            {(status === 'uploading' || status === 'processing') && (
              <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-xl font-semibold mb-2">
                  {status === 'uploading' ? 'Uploading...' : 'Adding captions...'}
                </h2>
                {status === 'uploading' && (
                  <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto mb-4">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                )}
                <p className="text-gray-400">This takes about 15-30 seconds</p>
                <p className="text-lg text-gray-600 mt-4 font-medium">Elapsed time: {formatTime(elapsedTime)}</p>
              </div>
            )}

            {/* Complete state */}
            {status === 'complete' && result && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="text-center mb-4">
                  <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full font-medium">
                    ✅ Done in {formatTime(finalTime)}!
                  </span>
                </div>
                <video src={result.videoUrl} controls className="w-full rounded-xl mb-4 max-h-[500px] bg-black" />
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={reset}
                    className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    New Video
                  </button>
                  <button
                    onClick={downloadVideo}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
                <div className="text-5xl mb-4">❌</div>
                <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
                <p className="text-red-500 bg-red-50 px-4 py-2 rounded-lg mb-4">{error}</p>
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="text-center mt-12 text-gray-500">
            <p>Built by Dheeraj Naraharisetti. A product of Stan</p>
            <p>
              Check out Stan Store{' '}
              <a href="https://www.stan.store/" className="text-blue-500 hover:underline">
                https://www.stan.store/
              </a>
            </p>
          </footer>
      </div>
    </div>
  );
}
