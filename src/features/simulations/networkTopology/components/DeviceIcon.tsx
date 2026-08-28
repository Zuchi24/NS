import { Wifi } from "lucide-react";

export function DeviceIcon({
  type,
  model,
  portStatus = {},
  deviceConnected = false,
}: {
  type: string;
  model?: string;
  portStatus?: Record<string, boolean>;
  deviceConnected?: boolean;
}) {
  const statuses = Object.values(portStatus);

  const statusA = statuses[0] ?? false;
  const statusB = statuses[1] ?? false;
  const statusC = statuses[2] ?? false;
  const statusD = statuses[3] ?? false;
  const statusE = statuses[4] ?? false;
  const statusF = statuses[5] ?? false;

  /*
   * END DEVICES
   *
   * Red = not connected
   * Green = connected
   */

  if (type.includes("pc")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-700 rounded-t border-2 border-gray-800 relative">
          <div
            className={`absolute inset-1 rounded-sm transition-colors ${
                deviceConnected ? "bg-emerald-500" : "bg-gray-300"
              }`}
          />
        </div>

        <div className="w-14 h-1.5 bg-gray-600 rounded-b" />
      </div>
    );
  }

  if (type.includes("laptop")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-600 rounded-t border-2 border-gray-700 relative">
          <div
            className={`absolute inset-1 rounded-sm transition-colors ${
                deviceConnected ? "bg-emerald-500" : "bg-gray-300"
              }`}
          />
        </div>

        <div className="w-14 h-1 bg-gray-500" />
      </div>
    );
  }

  /*
   * SERVER
   */

  if (type.includes("server")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center gap-0.5">
        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className={`w-1.5 h-1.5 rounded-full ${statusA ? "bg-emerald-500" : "bg-gray-300"}`} />
        </div>

        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className={`w-1.5 h-1.5 rounded-full ${statusB ? "bg-emerald-500" : "bg-gray-300"}`} />
        </div>

        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className={`w-1.5 h-1.5 rounded-full ${statusC ? "bg-emerald-500" : "bg-gray-300"}`} />
        </div>
      </div>
    );
  }

  /*
   * SWITCH
   */

  if (type.includes("switch")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-8 bg-gray-800 border-2 border-gray-900 rounded flex items-center justify-around px-1">
          <div className="flex flex-col gap-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusA ? "bg-emerald-500" : "bg-gray-300"}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${statusB ? "bg-emerald-500" : "bg-gray-300"}`} />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusC ? "bg-emerald-500" : "bg-gray-300"}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${statusD ? "bg-emerald-500" : "bg-gray-300"}`} />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusE ? "bg-emerald-500" : "bg-gray-300"}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${statusF ? "bg-emerald-500" : "bg-gray-300"}`} />
          </div>
        </div>

        {model && (
          <div className="text-[8px] text-gray-600 mt-0.5">
            {model}
          </div>
        )}
      </div>
    );
  }

  /*
   * ROUTER
   */

  if (type.includes("router")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-8 bg-blue-900 border-2 border-blue-950 rounded-lg relative flex items-center justify-center">
          <Wifi className="w-6 h-6 text-blue-300" />

          <div
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white ${
              statusA ? "bg-emerald-500" : "bg-gray-300"
            }`}
          />

          <div
            className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full border border-white ${
                statusB ? "bg-emerald-500" : "bg-gray-300"
              }`}
          />

          <div
            className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-white ${
                statusC ? "bg-emerald-500" : "bg-gray-300"
              }`}
          />
        </div>

        {model && (
          <div className="text-[8px] text-gray-600 mt-0.5">
            {model}
          </div>
        )}
      </div>
    );
  }

  /*
   * HUB
   */

  if (type.includes("hub")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-6 bg-gray-700 border-2 border-gray-800 rounded flex items-center justify-around px-1">
          <div className={`w-1.5 h-1.5 rounded-full ${statusA ? "bg-emerald-500" : "bg-gray-300"}`} />

          <div className={`w-1.5 h-1.5 rounded-full ${statusB ? "bg-emerald-500" : "bg-gray-300"}`} />

          <div className={`w-1.5 h-1.5 rounded-full ${statusC ? "bg-emerald-500" : "bg-gray-300"}`} />
        </div>
      </div>
    );
  }

  /*
   * PRINTER
   */

  if (type.includes("printer")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-500 border-2 border-gray-600 rounded relative">
          <div
            className={`absolute top-1 left-2 right-2 h-1 rounded transition-colors ${
              deviceConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>
      </div>
    );
  }

  /*
   * SMARTPHONE
   */

  if (type.includes("smartphone")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-6 h-10 bg-gray-800 border-2 border-gray-900 rounded-lg relative">
          <div
            className={`absolute inset-1 rounded transition-colors ${
              deviceConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>
      </div>
    );
  }

  return <div className="w-16 h-16 bg-gray-400 rounded" />;
}
