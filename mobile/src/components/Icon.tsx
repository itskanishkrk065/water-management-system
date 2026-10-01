import React from 'react';
import * as LucideIcons from 'lucide-react-native';

export type IconName =
  | 'home'
  | 'users'
  | 'user-plus'
  | 'user-check'
  | 'user'
  | 'droplet'
  | 'droplets'
  | 'credit-card'
  | 'activity'
  | 'git-pull-request'
  | 'bar-chart-2'
  | 'pie-chart'
  | 'refresh-cw'
  | 'rotate-cw'
  | 'rotate-ccw'
  | 'clock'
  | 'calendar'
  | 'check'
  | 'check-circle'
  | 'alert-circle'
  | 'alert-triangle'
  | 'minus-circle'
  | 'info'
  | 'help-circle'
  | 'file-text'
  | 'file'
  | 'file-check'
  | 'folder'
  | 'map-pin'
  | 'compass'
  | 'layers'
  | 'lock'
  | 'trash-2'
  | 'search'
  | 'filter'
  | 'sliders'
  | 'grid'
  | 'terminal'
  | 'shield'
  | 'mail'
  | 'phone'
  | 'phone-call'
  | 'more-vertical'
  | 'more-horizontal'
  | 'arrow-left'
  | 'arrow-right'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'x'
  | 'x-circle'
  | 'plus'
  | 'log-out'
  | 'repeat'
  | 'zap'
  | 'download'
  | 'upload'
  | 'smartphone'
  | 'wifi'
  | 'wifi-off'
  | 'cpu'
  | 'eye'
  | 'eye-off';

export interface IconProps {
  name: IconName | string;
  size?: number;
  color?: any;
  strokeWidth?: number;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#0F172A',
  strokeWidth = 2,
  style,
}) => {
  switch (name) {
    case 'home':
      return <LucideIcons.Home size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'users':
      return <LucideIcons.Users size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'user-plus':
      return <LucideIcons.UserPlus size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'user-check':
      return <LucideIcons.UserCheck size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'user':
      return <LucideIcons.User size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'droplet':
    case 'droplets':
      return <LucideIcons.Droplets size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'credit-card':
      return <LucideIcons.CreditCard size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'activity':
      return <LucideIcons.Activity size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'git-pull-request':
      return <LucideIcons.GitPullRequest size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'bar-chart-2':
      return <LucideIcons.BarChart2 size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'pie-chart':
      return <LucideIcons.PieChart size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'refresh-cw':
      return <LucideIcons.RefreshCw size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'rotate-cw':
      return <LucideIcons.RotateCw size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'rotate-ccw':
      return <LucideIcons.RotateCcw size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'clock':
      return <LucideIcons.Clock size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'calendar':
      return <LucideIcons.Calendar size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'check':
      return <LucideIcons.Check size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'check-circle':
      return <LucideIcons.CheckCircle2 size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'alert-circle':
      return <LucideIcons.AlertCircle size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'alert-triangle':
      return <LucideIcons.AlertTriangle size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'minus-circle':
      return <LucideIcons.MinusCircle size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'info':
      return <LucideIcons.Info size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'help-circle':
      return <LucideIcons.HelpCircle size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'file-text':
      return <LucideIcons.FileText size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'file':
    case 'file-check':
      return <LucideIcons.FileCheck size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'folder':
      return <LucideIcons.Folder size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'map-pin':
      return <LucideIcons.MapPin size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'compass':
      return <LucideIcons.Compass size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'layers':
      return <LucideIcons.Layers size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'lock':
      return <LucideIcons.Lock size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'trash-2':
      return <LucideIcons.Trash2 size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'search':
      return <LucideIcons.Search size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'filter':
      return <LucideIcons.Filter size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'sliders':
      return <LucideIcons.Sliders size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'grid':
      return <LucideIcons.Grid size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'terminal':
      return <LucideIcons.Terminal size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'shield':
      return <LucideIcons.Shield size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'mail':
      return <LucideIcons.Mail size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'phone':
      return <LucideIcons.Phone size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'phone-call':
      return <LucideIcons.PhoneCall size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'more-vertical':
      return <LucideIcons.MoreVertical size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'more-horizontal':
      return <LucideIcons.MoreHorizontal size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'arrow-left':
      return <LucideIcons.ArrowLeft size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'arrow-right':
      return <LucideIcons.ArrowRight size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'chevron-right':
      return <LucideIcons.ChevronRight size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'chevron-down':
      return <LucideIcons.ChevronDown size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'chevron-up':
      return <LucideIcons.ChevronUp size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'chevron-left':
      return <LucideIcons.ChevronLeft size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'x':
      return <LucideIcons.X size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'x-circle':
      return <LucideIcons.XCircle size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'plus':
      return <LucideIcons.Plus size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'log-out':
      return <LucideIcons.LogOut size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'repeat':
      return <LucideIcons.Repeat size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'zap':
      return <LucideIcons.Zap size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'download':
      return <LucideIcons.Download size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'upload':
      return <LucideIcons.Upload size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'smartphone':
      return <LucideIcons.Smartphone size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'wifi':
      return <LucideIcons.Wifi size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'wifi-off':
      return <LucideIcons.WifiOff size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'cpu':
      return <LucideIcons.Cpu size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'eye':
      return <LucideIcons.Eye size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    case 'eye-off':
      return <LucideIcons.EyeOff size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    default:
      return <LucideIcons.Circle size={size} color={color} strokeWidth={strokeWidth} style={style} />;
  }
};

export const Feather = Icon;
