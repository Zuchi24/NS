export interface Device {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  model?: string;
  config?: {
    ipAddress?: string;
    subnetMask?: string;
    gateway?: string;
  };
}

export interface Port {
  id: string;
  deviceId: string;
  x: number;
  y: number;
  label: string;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  cableType:
    | "copper-straight"
    | "copper-crossover"
    | "fiber"
    | "console";
}
