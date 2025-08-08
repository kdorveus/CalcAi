import React from 'react';
import { SvgProps, Svg, Path } from 'react-native-svg';

// Import all SVG icons
import MicrophoneIcon from '../assets/icons/microphone.svg';
import CalculatorIcon from '../assets/icons/calculator.svg';
import SendIcon from '../assets/icons/send.svg';
import CloseIcon from '../assets/icons/close.svg';
import CogIcon from '../assets/icons/cog.svg';
import HistoryIcon from '../assets/icons/history.svg';
import CheckCircleIcon from '../assets/icons/check-circle.svg';
// Crown icon is now defined inline for better performance
import DeleteIcon from '../assets/icons/delete.svg';
import StopIcon from '../assets/icons/stop.svg';
import ArrowLeftIcon from '../assets/icons/arrow-left.svg';
import ChevronUpIcon from '../assets/icons/chevron-up.svg';
import ChevronDownIcon from '../assets/icons/chevron-down.svg';
import PencilIcon from '../assets/icons/pencil.svg';
import AccountCircleIcon from '../assets/icons/account-circle.svg';
import LogoutIcon from '../assets/icons/logout.svg';
import CheckIcon from '../assets/icons/check.svg';
import CheckDecagramIcon from '../assets/icons/check-decagram.svg';
import LanguageIcon from '../assets/icons/language.svg';
// Crown Outline icon updated inline for settings PRO button
const CrownOutlineIcon = (props: SvgProps) => {
  const { width = 24, height = 24, color = 'currentColor', ...rest } = props;
  return (
    <Svg viewBox="0 0 24 24" width={width} height={height} fill={color} {...rest}>
      <Path d="M5 20v-2h14v2H5Zm0-3.5-1.275-8.025q-.05 0-.112.013t-.113.012q-.625 0-1.062-.438Q2 7.625 2 7q0-.625.438-1.062Q2.875 5.5 3.5 5.5q.625 0 1.062.438Q5 6.375 5 7q0 .175-.037.325t-.088.275l3.125 1.4 3.125-4.275q-.275-.2-.45-.525T10.5 3.5q0-.625.438-1.062Q11.375 2 12 2q.625 0 1.062.438Q13.5 2.875 13.5 3.5q0 .375-.175.7t-.45.525l3.125 4.275 3.125-1.4q-.05-.125-.088-.275T19 7q0-.625.438-1.062Q19.875 5.5 20.5 5.5q.625 0 1.062.438Q22 6.375 22 7q0 .625-.438 1.062-.437.438-1.062.438-.063 0-.125-.012t-.125-.013L19 16.5H5Zm1.7-2h10.6l.65-4.175-2.625 1.15-3.325-4.575-3.325 4.575-2.625-1.15.65 4.175Zm5.3 0Z" />
    </Svg>
  );
};

// Custom components for problematic icons
// Define custom SVG components for icons that have issues
// MaterialCommunityIcons 'webhook' SVG path
// MaterialCommunityIcons 'webhook' SVG path
const WebhookIcon = (props: SvgProps) => {
  const { width = 24, height = 24, color = 'currentColor', ...rest } = props;
  return (
    <Svg viewBox="0 0 24 24" width={width} height={height} fill={color} {...rest}>
      <Path d="M7 21q-2.075 0-3.538-1.463Q2 18.075 2 16q0-1.825 1.137-3.188Q4.275 11.45 6 11.075v2.075q-.875.3-1.438 1.075Q4 15 4 16q0 1.25.875 2.125T7 19q1.25 0 2.125-.875T10 16v-1h5.875q.2-.225.488-.363Q16.65 14.5 17 14.5q.625 0 1.063.438Q18.5 15.375 18.5 16q0 .625-.437 1.062Q17.625 17.5 17 17.5q-.35 0-.637-.137-.288-.138-.488-.363H11.9q-.35 1.725-1.713 2.863Q8.825 21 7 21Zm10 0q-1.4 0-2.538-.688-1.137-.687-1.737-1.812h2.675q.35.25.775.375Q16.6 19 17 19q1.25 0 2.125-.875T20 16q0-1.25-.875-2.125T17 13q-.5 0-.925.138-.425.137-.675.362l-3.05-5.075q-.525-.1-.875-.5-.35-.4-.35-.975 0-.625.438-1.063Q11.975 5.5 12.5 5.5q.625 0 1.063.437Q14 6.375 14 7v.212q0 .088-.05.213l2.175 3.65q.2-.05.425-.063Q16.775 11 17 11q2.075 0 3.538 1.462Q22 13.925 22 16q0 2.075-1.463 3.537Q19.075 21 17 21ZM7 17q-.625 0-1.062-.438Q5.5 16.125 5.5 15.5q0-.55.35-.95.35-.4.85-.525l2.35-3.9q-.725-.675-1.138-1.613Q7.5 7.575 7.5 6.5q0-2.075 1.462-3.538Q10.425 1.5 12.5 1.5q2.075 0 3.537 1.462Q17.5 4.425 17.5 6.5h-2q0-1.25-.875-2.125T12.5 3.5q-1.25 0-2.125.875T9.5 6.5q0 1.075.65 1.887Q10.8 9.2 11.65 9.538L8.425 15.55q.05.125.063.225.012.1.012.225 0 .625-.438 1.062Q7.625 17.5 7 17Z" />
    </Svg>
  );
};

// MaterialCommunityIcons 'keyboard-space' SVG path
// MaterialCommunityIcons 'keyboard-space' SVG path, visually scaled to match original
const KeyboardSpaceIcon = (props: SvgProps) => {
  const { width = 24, height = 24, color = 'currentColor', ...rest } = props;
  return (
    <Svg viewBox="0 0 24 24" width={width} height={height} fill={color} {...rest}>
      <Path d="M4 15v-6h2v4h12v-4h2v6H4Z" />
    </Svg>
  );
};

// Crown icon defined inline for better performance
const CrownIcon = (props: SvgProps) => {
  const { width = 24, height = 24, color = 'currentColor', ...rest } = props;
  return (
    <Svg viewBox="0 0 24 24" width={width} height={height} fill={color} {...rest}>
      <Path d="M5 20v-2h14v2H5Zm0-3.5-1.275-8.025q-.05 0-.112.013t-.113.012q-.625 0-1.062-.438Q2 7.625 2 7q0-.625.438-1.062Q2.875 5.5 3.5 5.5q.625 0 1.062.438Q5 6.375 5 7q0 .175-.037.325t-.088.275l3.125 1.4 3.125-4.275q-.275-.2-.45-.525T10.5 3.5q0-.625.438-1.062Q11.375 2 12 2q.625 0 1.062.438Q13.5 2.875 13.5 3.5q0 .375-.175.7t-.45.525l3.125 4.275 3.125-1.4q-.05-.125-.088-.275T19 7q0-.625.438-1.062Q19.875 5.5 20.5 5.5q.625 0 1.062.438Q22 6.375 22 7q0 .625-.438 1.062-.437.438-1.062.438-.063 0-.125-.012t-.125-.013L19 16.5H5Zm1.7-2h10.6l.65-4.175-2.625 1.15-3.325-4.575-3.325 4.575-2.625-1.15.65 4.175Zm5.3 0Z" />
    </Svg>
  );
};

const BackspaceIcon = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" {...props}>
    <Path d="M22,3H7C6.31,3,5.77,3.35,5.41,3.88L0,12l5.41,8.11C5.77,20.64,6.31,21,7,21h15c1.1,0,2-0.9,2-2V5C24,3.9,23.1,3,22,3z M19,15.59L17.59,17L14,13.41L10.41,17L9,15.59L12.59,12L9,8.41L10.41,7L14,10.59L17.59,7L19,8.41L15.41,12L19,15.59z" />
  </Svg>
);

const RefreshIcon = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" {...props}>
    <Path d="M17.65,6.35C16.2,4.9 14.21,4 12,4c-4.42,0-7.99,3.58-7.99,8s3.57,8 7.99,8c3.73,0 6.84-2.55 7.73-6h-2.08c-0.82,2.33-3.04,4-5.65,4-3.31,0-6-2.69-6-6s2.69-6 6-6c1.66,0 3.14,0.69 4.22,1.78L13,11h7V4L17.65,6.35z" />
  </Svg>
);

// Map icon names to their components
const iconMap: Record<string, React.FC<SvgProps>> = {
  'webhook': WebhookIcon,
  'microphone': MicrophoneIcon,
  'calculator': CalculatorIcon,
  'send': SendIcon,
  'close': CloseIcon,
  'cog': CogIcon,
  'history': HistoryIcon,
  'check-circle': CheckCircleIcon,
  'crown': CrownIcon,
  'delete': DeleteIcon,
  'keyboard-space': KeyboardSpaceIcon,
  'stop': StopIcon,
  'arrow-left': ArrowLeftIcon,
  'chevron-up': ChevronUpIcon,
  'chevron-down': ChevronDownIcon,
  'pencil': PencilIcon,
  'account-circle': AccountCircleIcon,
  'logout': LogoutIcon,
  'check': CheckIcon,
  'check-decagram': CheckDecagramIcon,
  'crown-outline': CrownOutlineIcon,
  'backspace': BackspaceIcon,
  'refresh': RefreshIcon,
  'language': LanguageIcon
};

// Define props for our AppIcon component
interface AppIconProps extends SvgProps {
  name: string;
  size?: number;
  color?: string;
}

/**
 * AppIcon - A custom icon component that uses bundled SVG icons
 * This eliminates network requests and makes icons load instantly
 */
const AppIcon: React.FC<AppIconProps> = ({ 
  name, 
  size = 24, 
  color = 'currentColor',
  ...props 
}) => {
  // Get the icon component from our map
  const IconComponent = iconMap[name];
  
  // If icon doesn't exist, return null
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }
  
  // Return the icon with the specified props
  return (
    <IconComponent 
      width={size} 
      height={size} 
      fill={color}
      {...props}
    />
  );
};

export default AppIcon;
