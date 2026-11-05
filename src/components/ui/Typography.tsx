import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'overline';
export type TypographyColor = 'primary' | 'secondary' | 'text' | 'muted' | 'light' | 'white' | 'error';
export type TypographyAlign = 'auto' | 'left' | 'right' | 'center' | 'justify';

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  align?: TypographyAlign;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  className?: string;
  children: React.ReactNode;
}

const sanitizeTypographyChildren = (child: React.ReactNode): React.ReactNode => {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return child;
  }
  if (typeof child === 'string' || typeof child === 'number') {
    return child;
  }
  if (React.isValidElement(child)) {
    return child;
  }
  if (Array.isArray(child)) {
    return React.Children.map(child, sanitizeTypographyChildren);
  }
  if (typeof child === 'object') {
    const obj: any = child;
    if (obj.city || obj.street || obj.addressLine1 || obj.address) {
      const parts = [
        obj.addressLine1 || obj.street || (typeof obj.address === 'string' ? obj.address : null),
        obj.city,
        obj.state,
        obj.postalCode || obj.zipCode,
      ].filter(Boolean);
      return parts.join(', ') || obj.city || '';
    }
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.message === 'string') return obj.message;
    return '';
  }
  return String(child);
};

const getVariantClasses = (variant: TypographyVariant) => {
  switch (variant) {
    case 'h1': return 'text-4xl font-bold'; // 36px
    case 'h2': return 'text-3xl font-bold'; // 30px
    case 'h3': return 'text-2xl font-semibold'; // 24px
    case 'h4': return 'text-xl font-semibold'; // 20px
    case 'subtitle1': return 'text-lg font-medium'; // 18px
    case 'subtitle2': return 'text-base font-medium'; // 16px
    case 'body1': return 'text-base'; // 16px
    case 'body2': return 'text-sm'; // 14px
    case 'caption': return 'text-xs'; // 12px
    case 'overline': return 'text-[10px] uppercase tracking-wider font-semibold'; // 10px
    default: return 'text-base';
  }
};

const getColorClasses = (color: TypographyColor) => {
  switch (color) {
    case 'primary': return 'text-primary';
    case 'secondary': return 'text-secondary';
    case 'text': return 'text-text';
    case 'muted': return 'text-text-muted';
    case 'light': return 'text-text-light';
    case 'white': return 'text-white';
    case 'error': return 'text-red-500';
    default: return 'text-text';
  }
};

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body1',
  color = 'text',
  align = 'auto',
  weight,
  className = '',
  children,
  ...props
}) => {
  const variantClass = getVariantClasses(variant);
  const colorClass = getColorClasses(color);
  
  let weightClass = 'font-outfit';
  if (weight === 'normal') weightClass = 'font-outfit';
  else if (weight === 'medium') weightClass = 'font-outfit-medium';
  else if (weight === 'semibold') weightClass = 'font-outfit-semibold';
  else if (weight === 'bold') weightClass = 'font-outfit-bold';
  else {
    if (variantClass.includes('font-bold')) weightClass = 'font-outfit-bold';
    else if (variantClass.includes('font-semibold')) weightClass = 'font-outfit-semibold';
    else if (variantClass.includes('font-medium')) weightClass = 'font-outfit-medium';
  }

  const alignClass = `text-${align}`;
  const safeChildren = sanitizeTypographyChildren(children);

  return (
    <Text
      className={`${variantClass} ${colorClass} ${weightClass} ${alignClass} ${className}`}
      style={[{ includeFontPadding: false, paddingRight: 4 }, props.style]}
      {...props}
    >
      {safeChildren}
    </Text>
  );
};
