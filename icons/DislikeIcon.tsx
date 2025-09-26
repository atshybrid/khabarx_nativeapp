import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string; active?: boolean; activeColor?: string };

export default function DislikeIcon({ size = 24, color = '#9BA1A6', active = false, activeColor = '#fa7c05' }: Props) {
  const stroke = active ? activeColor : color;
  const tone = active ? activeColor : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* duotone background heart */}
      <Path
        d="M12 21s-6.5-4.6-9-8.5C1 9 2.5 5.5 6 5.5c1.9 0 3.5 1.2 4 2.1.5-.9 2.1-2.1 4-2.1 3.5 0 5 3.5 3 7-2.5 3.9-9 8.5-9 8.5Z"
        fill={tone}
        opacity={active ? 0.22 : 0.08}
      />
      {/* outline */}
      <Path
        d="M12 21s-6.5-4.6-9-8.5C1 9 2.5 5.5 6 5.5c1.9 0 3.5 1.2 4 2.1.5-.9 2.1-2.1 4-2.1 3.5 0 5 3.5 3 7-2.5 3.9-9 8.5-9 8.5Z"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* crack */}
      <Path d="M12 8.8l-1.6 2.2 2 1.2-1.6 2.4" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
