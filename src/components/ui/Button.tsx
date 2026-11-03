import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';
import { Typography } from './Typography';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = true,
  disabled,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const getContainerStyles = () => {
    let base = 'flex-row items-center justify-center rounded-full ';
    
    if (fullWidth) base += 'w-full ';

    if (disabled || isLoading) {
      base += 'opacity-60 ';
    }

    switch (size) {
      case 'sm':
        base += 'py-2 px-4 ';
        break;
      case 'md':
        base += 'py-4 px-6 ';
        break;
      case 'lg':
        base += 'py-5 px-8 ';
        break;
    }

    switch (variant) {
      case 'primary':
        return base + 'bg-primary';
      case 'secondary':
        return base + 'bg-secondary';
      case 'outline':
        return base + 'bg-transparent border-2 border-primary';
      case 'ghost':
        return base + 'bg-transparent';
      case 'danger':
        return base + 'bg-red-500';
      case 'white':
        return base + 'bg-white border border-gray-200 shadow-sm';
      default:
        return base + 'bg-primary';
    }
  };

  const getTextColor = (): 'white' | 'primary' | 'error' | 'text' => {
    if (variant === 'outline' || variant === 'ghost' || variant === 'white') return 'primary';
    return 'white';
  };

  const getTextVariant = () => {
    switch (size) {
      case 'sm': return 'subtitle2';
      case 'md': return 'subtitle1';
      case 'lg': return 'h4';
      default: return 'subtitle1';
    }
  };

  return (
    <TouchableOpacity
      className={`${getContainerStyles()} ${className}`}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#FF5722' : '#FFFFFF'} size="small" />
      ) : (
        <View className="flex-row items-center justify-center px-2">
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Typography variant={getTextVariant()} color={getTextColor()} weight="semibold">
            {title}
          </Typography>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};
