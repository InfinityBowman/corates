import { Component, JSX } from 'solid-js';

export interface ButtonProps {
  onClick?: () => void;
  children: JSX.Element;
  variant?: 'primary' | 'secondary';
}

export const Button: Component<ButtonProps> = props => {
  const baseClasses = 'px-4 py-2 rounded font-semibold transition-colors';
  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-500 hover:bg-gray-700 text-white',
  };

  return (
    <button
      onClick={props.onClick}
      class={`${baseClasses} ${variantClasses[props.variant || 'primary']}`}
    >
      {props.children}
    </button>
  );
};
