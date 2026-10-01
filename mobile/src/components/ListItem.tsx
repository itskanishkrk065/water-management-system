import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { Feather } from './Icon';
import { Avatar } from './Avatar';

interface ListItemProps {
  title: string;
  subtitle?: string;
  meta?: string;
  avatarName?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  showChevron?: boolean;
  borderBottom?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  meta,
  avatarName,
  icon,
  rightElement,
  onPress,
  style,
  showChevron = true,
  borderBottom = true,
}) => {
  const content = (
    <View
      style={[
        styles.container,
        borderBottom && styles.borderBottom,
        style,
      ]}
    >
      {avatarName ? (
        <Avatar name={avatarName} size={42} style={styles.leading} />
      ) : icon ? (
        <View style={styles.iconContainer}>{icon}</View>
      ) : null}

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      {rightElement ? (
        <View style={styles.rightElement}>{rightElement}</View>
      ) : null}

      {showChevron && onPress && (
        <Feather
          name="chevron-right"
          size={18}
          color={colors.textMuted}
          style={styles.chevron}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  touchable: {
    backgroundColor: colors.surface,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  borderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leading: {
    marginRight: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.medium,
  },
  subtitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  meta: {
    fontSize: typography.fontSize.tiny,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  rightElement: {
    marginLeft: spacing.sm,
    alignItems: 'flex-end',
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
