import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function ShareIcon({ size = 24, color = '#9BA1A6' }: Props) {
  const tone = color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* box */}
      <Path d="M5.5 9.5h7a0 0 0 0 1 0 0v8a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" fill={tone} opacity={0.08} />
      <Path d="M5.5 9.5h7v8a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" stroke={tone} strokeWidth={1.8} strokeLinejoin="round" />
      {/* arrow up-right */}
      <Path d="M13 5h6m0 0v6m0-6L12 12" stroke={tone} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
