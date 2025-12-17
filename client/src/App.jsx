import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [processingProgress, setProcessingProgress] = useState(0)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (status === 'processing') {
      setProcessingProgress(0)
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval)
            return prev
          }
          return prev + Math.random() * 3
        })
      }, 500)
      return () => clearInterval(interval)
    }
  }, [status])

  useEffect(() => {
    if (status === 'complete') {
      setProcessingProgress(100)
    }
  }, [status])

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setStatus('idle')
      setResult(null)
      setError(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile)
      setPreview(URL.createObjectURL(droppedFile))
      setStatus('idle')
      setResult(null)
      setError(null)
    }
  }

  const handleProcess = async () => {
    if (!file) return

    setStatus('uploading')
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('video', file)

    try {
      const response = await axios.post('/api/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const percent = Math.round((e.loaded * 100) / e.total)
          setProgress(percent)
          if (percent === 100) setStatus('processing')
        }
      })

      setResult(response.data)
      setStatus('complete')
    } catch (err) {
      setError(err.response?.data?.details || err.message)
      setStatus('error')
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setStatus('idle')
    setResult(null)
    setError(null)
    setProcessingProgress(0)
  }

  const currentProgress = status === 'uploading' ? progress : processingProgress

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50 relative overflow-hidden">
      {/* Side decorations */}
      <div className="hidden md:block absolute left-8 top-1/4 space-y-4">
        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
        <div className="w-2 h-2 rounded-full bg-blue-300"></div>
        <div className="w-4 h-4 rounded-full bg-blue-100"></div>
      </div>
      <div className="hidden md:block absolute right-8 top-1/3 space-y-4">
        <div className="w-4 h-4 rounded-full bg-blue-100"></div>
        <div className="w-2 h-2 rounded-full bg-blue-300"></div>
        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
      </div>
      <div className="hidden md:block absolute left-12 bottom-1/4 space-y-3">
        <div className="w-2 h-2 rounded-full bg-gray-200"></div>
        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
      </div>
      <div className="hidden md:block absolute right-12 bottom-1/3 space-y-3">
        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
        <div className="w-2 h-2 rounded-full bg-gray-200"></div>
      </div>

      {/* Header */}
      <header className="text-center pt-11 pb-8">
        <h1 className="text-7xl font-black tracking-tight text-blue-600">📹 CapSnap</h1>
        <p className="text-lg text-gray-400 mt-3">Add captions to your videos instantly. Instant TikTok-style captions.</p>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-6">
        
        {/* Dropzone */}
        {status === 'idle' && !file && (
          <div
            className="w-full max-w-md aspect-[9/16] border-2 border-dashed border-gray-400 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 hover:bg-gray-50/50 transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <span className="text-6xl mb-4">🎬</span>
            <p className="text-xl font-semibold text-gray-800">Drop your video here</p>
            <p className="text-gray-400 mt-2">or click to browse</p>
          </div>
        )}

        {/* Preview */}
        {status === 'idle' && file && (
          <div className="flex flex-col items-center gap-5 w-full max-w-md">
            <video 
              src={preview} 
              controls 
              className="w-full rounded-2xl bg-black shadow-lg"
            />
            <div className="flex gap-3 w-full">
              <button
                onClick={handleReset}
                className="flex-1 py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all"
              >
                Change
              </button>
              <button
                onClick={handleProcess}
                className="flex-1 py-4 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition-all"
              >
                Add Captions →
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {(status === 'uploading' || status === 'processing') && (
          <div className="flex flex-col items-center gap-8 w-full max-w-md py-12">
            <div className="w-16 h-16 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-2xl font-bold text-black">
                {status === 'uploading' ? 'Uploading...' : 'Adding captions...'}
              </p>
              <p className="text-gray-400 mt-2">
                {status === 'processing' && 'This takes about 30-60 seconds'}
              </p>
            </div>
            
            {/* Progress bar */}
            <div className="w-full">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-black rounded-full transition-all duration-300"
                  style={{ width: `${currentProgress}%` }}
                />
              </div>
              <p className="text-gray-400 text-center mt-3 font-medium">{Math.round(currentProgress)}%</p>
            </div>
          </div>
        )}

        {/* Complete */}
        {status === 'complete' && result && (
          <div className="flex flex-col items-center gap-5 w-full max-w-md">
            <div className="text-green-500 font-semibold text-lg">✓ Done!</div>
            <video 
              src={result.videoUrl} 
              controls 
              className="w-full rounded-2xl bg-black shadow-lg"
              autoPlay
              muted
            />
            <div className="flex gap-3 w-full">
              <button
                onClick={handleReset}
                className="flex-1 py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all"
              >
                New Video
              </button>
              <a
                href={result.videoUrl}
                download
                className="flex-1 py-4 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition-all text-center"
              >
                Download ↓
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-5 w-full max-w-md text-center py-12">
            <span className="text-5xl">😕</span>
            <p className="text-xl font-bold text-black">Something went wrong</p>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={handleReset}
              className="py-4 px-8 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8">
        <p className="text-gray-700 font-bold">Built by Dheeraj Naraharisetti. A product of Stan</p>
        <p className="text-gray-700 font-bold">Check out Stan Store</p>
        <a href="https://www.stan.store/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
        https://www.stan.store/
        </a>
      </footer>
    </div>
  )
}
