import React from 'react';
import { Composition, getInputProps } from 'remotion';
import { CaptionedVideo } from './CaptionedVideo.js';

export const RemotionRoot = () => {
  const { videoUrl, captions } = getInputProps();
  
  return (
    <>
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        durationInFrames={30 * 60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: videoUrl || '',
          captions: captions || [],
        }}
      />
    </>
  );
};
