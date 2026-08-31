import { Monitor, Server, Laptop, Smartphone, Printer } from "lucide-react";

export const DEVICE_CATEGORIES = {
  endDevices: {
    name: "End Devices",
    color: "blue",
    items: [
      { type: "pc", family: "pc", label: "PC", icon: Monitor },
      { type: "laptop", family: "laptop", label: "Laptop", icon: Laptop },
      { type: "server", family: "server", label: "Server", icon: Server },
      { type: "printer", family: "printer", label: "Printer", icon: Printer },
      { type: "smartphone", family: "smartphone", label: "Smartphone", icon: Smartphone },
    ],
  },

  networkDevices: {
    name: "Network Devices",
    color: "orange",

    subcategories: {
      switches: {
        name: "Switches",
        family: "switch",
        models: [
          {
            type: "switch-2960",
            label: "2960 Switch",
            model: "2960",
          },
          {
            type: "switch-3560",
            label: "3560 Switch",
            model: "3560",
          },
          {
            type: "switch-generic",
            label: "Generic Switch",
            model: "Generic",
          },
        ],
      },

      routers: {
        name: "Routers",
        family: "router",
        models: [
          {
            type: "router-1941",
            label: "1941 Router",
            model: "1941",
          },
          {
            type: "router-2911",
            label: "2911 Router",
            model: "2911",
          },
          {
            type: "router-generic",
            label: "Generic Router",
            model: "Generic",
          },
        ],
      },

      hubs: {
        name: "Hubs",
        family: "hub",
        models: [
          {
            type: "hub-generic",
            label: "Generic Hub",
            model: "Generic",
          },
        ],
      },
    },
  },
};
