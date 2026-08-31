export interface Device {
  id: string;
  type: string;
  /**
   * The device's kind — "pc", "switch", "router" — independent of model.
   * Written into the saved topology so challenge rules can ask for "a switch"
   * without knowing the canvas calls it `switch-2960`.
   */
  family: string;
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
