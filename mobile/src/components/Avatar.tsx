import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, typography } from '../constants/theme';

interface AvatarProps {
  name: string;
  size?: number;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 42, style }) => {
  const getInitials = (text: string) => {
    if (!text) return 'WG';
    const parts = text.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.substring(0, 2).toUpperCase();
  };

  const getBackgroundColor = (text: string) => {
    const palette = [
      colors.primaryLight,
      colors.secondaryLight,
      colors.infoLight,
      colors.successLight,
      colors.warningLight,
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  };

  const getTextColor = (text: string) => {
    const palette = [
      colors.primary,
      colors.secondary,
      colors.info,
      colors.success,
      colors.warning,
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  };

  const initials = getInitials(name);
  const bg = getBackgroundColor(name);
  const textCol = getTextColor(name);
  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: borderRadius.full,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize,
            color: textCol,
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
});
