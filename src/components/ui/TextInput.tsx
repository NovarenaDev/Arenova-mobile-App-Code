import React, { useState } from 'react';
import { View, TextInput as RNTextInput, TextInputProps as RNTextInputProps, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Ionicons } from '@expo/vector-icons';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  leftIcon,
  isPassword,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(isPassword);

  return (
    <View className={`w-full mb-4 ${className}`}>
      {label && (
        <Typography variant="body2" weight="medium" className="mb-2 text-text">
          {label}
        </Typography>
      )}
      
      <View
        className={`flex-row w-full px-5 bg-white border-2 rounded-3xl ${
          props.multiline ? 'min-h-[100px] items-start py-4 rounded-2xl' : 'h-14 items-center rounded-full'
        } ${
          error ? 'border-red-500' : isFocused ? 'border-primary' : 'border-gray-200'
        }`}
      >
        {leftIcon && <View className={`mr-3 ${props.multiline ? 'mt-1' : ''}`}>{leftIcon}</View>}
        
        <RNTextInput
          className={`flex-1 text-base text-text font-medium ${props.multiline ? '' : 'h-full'}`}
          placeholderTextColor="#9CA3AF"
          textAlignVertical={props.multiline ? 'top' : 'center'}
          style={[{ includeFontPadding: false }, props.style]}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
          secureTextEntry={isSecure}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsSecure(!isSecure)}
            className="p-2 ml-2"
          >
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Typography variant="caption" color="error" className="mt-1 ml-1">
          {error}
        </Typography>
      )}
    </View>
  );
};
