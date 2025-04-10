export enum NetworkType {
  WIFI = "wifi",
  ETHERNET = "ethernet",
}

export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  AUTHENTICATING = "authenticating",
  CONNECTED = "connected",
  ERROR = "error",
}

export enum SecurityType {
  OPEN = "Open",
  WEP = "WEP",
  WPA = "WPA",
  WPA2 = "WPA2",
  WPA2_ENTERPRISE = "WPA2-Enterprise",
  WPA3 = "WPA3",
}

export interface NetworkSettings {
  autoConnect: boolean;
  redirectUrl: string | null;
  hidden: boolean;
  priority: number;
  redirectTimeout: number;
}

export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  signalStrength: number;
  security: string;
  type: NetworkType;
  saved?: boolean;
  settings?: NetworkSettings;
}
