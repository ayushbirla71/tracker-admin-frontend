import { BatteryLow, Bell, LogIn, LogOut, RotateCcw, MapPinOff, ShieldAlert, WifiOff, type LucideIcon } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

export const ALERT_TYPES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'offline', label: 'Went offline', icon: WifiOff },
  { value: 'low_battery', label: 'Low battery', icon: BatteryLow },
  { value: 'gps_off', label: 'GPS turned off', icon: MapPinOff },
  { value: 'permission_revoked', label: 'Permission removed', icon: ShieldAlert },
  { value: 'mock_location', label: 'Fake location', icon: ShieldAlert },
  { value: 'tracking_restarted', label: 'Tracking restarted', icon: RotateCcw },
  { value: 'geofence_enter', label: 'Arrived at site', icon: LogIn },
  { value: 'geofence_exit', label: 'Left site', icon: LogOut },
];

export const alertIcon = (type: string): LucideIcon => ALERT_TYPES.find((t) => t.value === type)?.icon ?? Bell;
export const alertLabel = (type: string) => ALERT_TYPES.find((t) => t.value === type)?.label ?? type;

export const relativeTime = (iso: string) => `${formatDistanceToNowStrict(new Date(iso))} ago`;
