import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';

export interface StepItem {
  title: string;
  subtitle?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onSelectStep?: (stepIndex: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onSelectStep }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {steps.map((step, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <TouchableOpacity
              key={idx}
              disabled={!onSelectStep || stepNumber > currentStep}
              onPress={() => onSelectStep && onSelectStep(stepNumber)}
              style={styles.stepItem}
            >
              <View
                style={[
                  styles.circle,
                  isCompleted ? styles.circleCompleted : null,
                  isCurrent ? styles.circleCurrent : null,
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    isCompleted || isCurrent ? styles.circleTextActive : null,
                  ]}
                >
                  {isCompleted ? '✓' : stepNumber}
                </Text>
              </View>

              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.title,
                    isCurrent ? styles.titleCurrent : isCompleted ? styles.titleCompleted : null,
                  ]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
              </View>

              {idx < steps.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    isCompleted ? styles.connectorCompleted : null,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  circleCurrent: {
    backgroundColor: Colors.primary[600],
  },
  circleCompleted: {
    backgroundColor: Colors.status.successText,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.neutral[600],
  },
  circleTextActive: {
    color: '#FFFFFF',
  },
  textContainer: {
    marginRight: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.neutral[500],
  },
  titleCurrent: {
    color: Colors.primary[700],
    fontWeight: '700',
  },
  titleCompleted: {
    color: Colors.neutral[800],
    fontWeight: '600',
  },
  connector: {
    width: 20,
    height: 2,
    backgroundColor: Colors.neutral[200],
    marginRight: 12,
  },
  connectorCompleted: {
    backgroundColor: Colors.status.successText,
  },
});
