import React from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

function groupIntoPages(captions) {
  const pages = [];
  let current = [];
  
  for (const word of captions) {
    current.push(word);
    if (current.length >= 3 || /[.!?,]$/.test(word.text)) {
      pages.push({
        words: [...current],
        startMs: current[0].startMs,
        endMs: current[current.length - 1].endMs,
      });
      current = [];
    }
  }
  
  if (current.length > 0) {
    pages.push({
      words: current,
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
    });
  }
  
  return pages;
}

const Word = ({ word, isActive, index, pageStartFrame }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const pop = spring({
    fps,
    frame: frame - pageStartFrame - index * 2,
    config: { damping: 8, stiffness: 200 },
  });
  
  const scale = Math.min(pop, 1) * (isActive ? 1.15 : 1);
  
  return (
    <span
      style={{
        display: 'inline-block',
        marginRight: 16,
        transform: `scale(${scale})`,
        color: isActive ? '#FFE600' : '#FFFFFF',
        filter: isActive ? 'drop-shadow(0 0 20px rgba(255,230,0,0.7))' : 'none',
        textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000',
      }}
    >
      {word.text.toUpperCase()}
    </span>
  );
};

const Page = ({ page, currentTimeMs }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.floor((page.startMs / 1000) * fps);
  
  const slideIn = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 12, stiffness: 150 },
  });
  
  return (
    <div
      style={{
        transform: `translateY(${interpolate(Math.min(slideIn, 1), [0, 1], [30, 0])}px)`,
        opacity: Math.min(slideIn, 1),
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        padding: '12px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      {page.words.map((word, i) => (
        <Word
          key={i}
          word={word}
          isActive={currentTimeMs >= word.startMs && currentTimeMs < word.endMs}
          index={i}
          pageStartFrame={startFrame}
        />
      ))}
    </div>
  );
};

export const CaptionedVideo = ({ videoUrl, captions }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;
  
  const pages = groupIntoPages(captions);
  const currentPage = pages.find(
    p => currentTimeMs >= p.startMs && currentTimeMs < p.endMs + 200
  );
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)' }} />
      
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '12%' }}>
        <div style={{ fontFamily: 'Arial Black', fontSize: 56, fontWeight: 900, textAlign: 'center' }}>
          {currentPage && <Page page={currentPage} currentTimeMs={currentTimeMs} />}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};