import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
let VideoView: any;
// Lazy import to avoid undefined component during fast refresh if native module not ready
import('expo-video')
	.then((mod) => {
		VideoView = (mod as any).VideoView;
	})
	.catch(() => {
		VideoView = undefined as any;
	});

type VideoWrapperProps = {
	player: any;
	style?: StyleProp<ViewStyle>;
	contentFit?: 'cover' | 'contain' | 'fill' | 'none' | string;
	nativeControls?: boolean;
};

export const VideoWrapper: React.FC<VideoWrapperProps> = ({ player, style, contentFit = 'cover', nativeControls = true }) => {
	// If native view or player isn't ready, render a harmless placeholder to avoid invalid element crash
	if (!VideoView || !player) {
		return <View style={style} />;
	}
	return (
		<VideoView
			player={player}
			style={style}
			contentFit={contentFit as any}
			nativeControls={nativeControls}
		/>
	);
};

export default VideoWrapper;

