import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

interface FieldRowProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChangeText?: (t: string) => void;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  inputProps?: TextInputProps;
}

export const FieldRow: React.FC<FieldRowProps> = ({ label, value, placeholder, multiline, onChangeText, disabled, containerStyle, inputProps }) => {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        {...inputProps}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  multiline: { height: 100, textAlignVertical: 'top' },
});

export default FieldRow;
