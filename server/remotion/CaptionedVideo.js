import React from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';

function groupCaptionsIntoPages(captions, maxWordsPerPage = 3) {
  const pages = [];
  let currentPage = [];
  
  for (const caption of captions) {
    currentPage.push(caption);
    
    const endsWithPunctuation = /[.!?,]$/.test(caption.text);
    if (currentPage.length >= maxWordsPerPage || endsWithPunctuation) {
      pages.push({
        words: [...currentPage],
        startMs: currentPage[0].startMs,
        endMs: currentPage[currentPage.length - 1].endMs,
      });
      currentPage = [];
    }
  }
  
  if (currentPage.length > 0) {
    pages.push({
      words: currentPage,
      startMs: currentPage[0].startMs,
      endMs: currentPage[currentPage.length - 1].endMs,
    });
  }
  
  return pages;
}

const AnimatedWord = ({ word, isActive, index, pageStartFrame }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const entrance = spring({
    fps,
    frame: frame - pageStartFrame - index * 3,
    config: { damping: 10, stiffness: 180 },
    durationInFrames: 20,
  });
  
  const scale = Math.min(entrance, 1) * (isActive ? 1.2 : 1);
  const color = isActive ? '#FFFF00' : '#FFFFFF';
  
  return (
    <span
      style={{
        display: 'inline-block',
        marginRight: '18px',
        marginBottom: '8px',
        transform: `scale(${scale})`,
        color: color,
        textShadow: `
          4px 4px 0 #000,
          -4px -4px 0 #000,
          4px -4px 0 #000,
          -4px 4px 0 #000,
          4px 0 0 #000,
          -4px 0 0 #000,
          0 4px 0 #000,
          0 -4px 0 #000,
          0 0 20px rgba(0,0,0,0.8)
        `,
      }}
    >
      {word.text.toUpperCase()}
    </span>
  );
};

const CaptionPage = ({ page, currentTimeMs }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const pageStartFrame = Math.floor((page.startMs / 1000) * fps);
  
  const pageEntrance = spring({
    fps,
    frame: frame - pageStartFrame,
    config: { damping: 12, stiffness: 200 },
  });
  
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: '90%',
        transform: `scale(${Math.min(pageEntrance, 1)})`,
        opacity: Math.min(pageEntrance, 1),
      }}
    >
      {page.words.map((word, index) => {
        const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
        return (
          <AnimatedWord
            key={index}
            word={word}
            isActive={isActive}
            index={index}
            pageStartFrame={pageStartFrame}
          />
        );
      })}
    </div>
  );
};

export const CaptionedVideo = ({ videoUrl, captions }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;
  
  const pages = groupCaptionsIntoPages(captions, 3);
  
  const currentPage = pages.find(
    (page) => currentTimeMs >= page.startMs && currentTimeMs < page.endMs + 300
  );
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video
        src={videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: '12%',
        }}
      >
        <div
          style={{
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '72px',
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          {currentPage && (
            <CaptionPage page={currentPage} currentTimeMs={currentTimeMs} />
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
