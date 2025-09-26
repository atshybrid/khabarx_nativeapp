import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type ChevronDirection = 'right' | 'down' | 'none';

export interface SettingsRowProps {
	icon?: React.ReactNode;
	title: string;
	subtitle?: string;
	right?: React.ReactNode;
	onPress?: () => void;
	chevronDirection?: ChevronDirection;
	disabled?: boolean;
}

export default function SettingsRow({
	icon,
	title,
	subtitle,
	right,
	onPress,
	chevronDirection = 'right',
	disabled,
}: SettingsRowProps) {
	const showChevron = chevronDirection !== 'none';
	const ChevronIcon = (
		<Feather
			name={chevronDirection === 'down' ? 'chevron-down' : 'chevron-right'}
			size={20}
			color="#9ca3af"
		/>
	);

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && { opacity: 0.6 }]}
		>
			{icon ? <View style={styles.icon}>{icon}</View> : null}
			<View style={styles.center}>
				<Text style={styles.title} numberOfLines={1}>{title}</Text>
				{subtitle ? (
					<Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
				) : null}
			</View>
			{right ? <View style={styles.right}>{right}</View> : null}
			{showChevron ? <View style={styles.chevron}>{ChevronIcon}</View> : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 14,
		backgroundColor: '#fff',
		borderRadius: 12,
	},
	pressed: { backgroundColor: '#f9fafb' },
	icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
	center: { flex: 1 },
	title: { fontSize: 16, fontWeight: '700', color: '#111827' },
	subtitle: { marginTop: 2, color: '#6b7280' },
	right: { marginLeft: 8 },
	chevron: { marginLeft: 6 },
});

