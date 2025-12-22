import React from 'react';
import { Composition } from 'remotion';
import { CaptionedVideo } from './CaptionedVideo.js';

export const RemotionRoot = () => {
  return (
    <Composition
      id="CaptionedVideo"
      component={CaptionedVideo}
      durationInFrames={30 * 60}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        videoUrl: '',
        captions: [],
      }}
    />
  );
};