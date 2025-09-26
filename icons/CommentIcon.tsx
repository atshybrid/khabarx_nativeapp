import Svg, { Circle, Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function CommentIcon({ size = 24, color = '#9BA1A6' }: Props) {
  const tone = color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* duotone bubble */}
      <Path d="M5 5h14a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H10l-4.8 3.6V7a2 2 0 0 1 2-2Z" fill={tone} opacity={0.08} />
      <Path d="M5 5h14a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H10l-4.8 3.6V7a2 2 0 0 1 2-2Z" stroke={tone} strokeWidth={1.8} strokeLinejoin="round" />
      {/* dots */}
      <Circle cx={9} cy={11.5} r={1} fill={tone} />
      <Circle cx={12} cy={11.5} r={1} fill={tone} />
      <Circle cx={15} cy={11.5} r={1} fill={tone} />
    </Svg>
  );
}
