import React from 'react';
// Temporary: still using expo-av until expo-video is installed.
// After adding expo-video, switch import to: import { Video, ResizeMode, VideoProps } from 'expo-video';
import { ResizeMode, Video, VideoProps } from 'expo-av';
// Reference to keep linter from flagging unused re-export until migration
void ResizeMode;

export const VideoWrapper: React.FC<VideoProps> = (props) => <Video {...props} />;

export { ResizeMode } from 'expo-av';
