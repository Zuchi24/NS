import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Map,
  ArrowLeft,
  CheckCircle2,
  Lock,
  FileText,
  LogOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { toast } from "sonner";

interface Material {
  id: string;
  type: "pdf" | "video" | "link";
  title: string;
  url: string;
}

interface RoadmapNode {
  id: number;
  title: string;
  description: string;
  category: string;
  position: "center" | "left" | "right";
  materials: Material[];
  completed: boolean;
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const [isAdmin] = useState(() => localStorage.getItem("userRole") === "admin");

  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([
    // Start / Fundamentals
    {
      id: 1,
      title: "Introduction to Networking",
      description: "Learn the basics of computer networks, their purpose, and real-world applications.",
      category: "Start / Fundamentals",
      position: "center",
      materials: [],
      completed: true,
    },
    {
      id: 2,
      title: "Types of Networks",
      description: "Understand LAN, WAN, MAN, and their differences.",
      category: "Start / Fundamentals",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 3,
      title: "Network Topologies",
      description: "Explore star, bus, ring, mesh, and hybrid topologies.",
      category: "Start / Fundamentals",
      position: "right",
      materials: [],
      completed: false,
    },
    {
      id: 4,
      title: "OSI Model",
      description: "Master the 7 layers of the OSI networking model.",
      category: "Start / Fundamentals",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 5,
      title: "TCP/IP Model",
      description: "Understand the TCP/IP protocol suite and layers.",
      category: "Start / Fundamentals",
      position: "center",
      materials: [],
      completed: false,
    },

    // Basic Networking Concepts
    {
      id: 6,
      title: "IP Addressing",
      description: "Learn IPv4 and IPv6 addressing schemes.",
      category: "Basic Networking Concepts",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 7,
      title: "Subnetting",
      description: "Master subnet masks and network segmentation.",
      category: "Basic Networking Concepts",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 8,
      title: "MAC Address",
      description: "Understand physical addressing in networks.",
      category: "Basic Networking Concepts",
      position: "right",
      materials: [],
      completed: false,
    },
    {
      id: 9,
      title: "DNS",
      description: "Learn how Domain Name System works.",
      category: "Basic Networking Concepts",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 10,
      title: "DHCP",
      description: "Understand Dynamic Host Configuration Protocol.",
      category: "Basic Networking Concepts",
      position: "center",
      materials: [],
      completed: false,
    },

    // Network Devices
    {
      id: 11,
      title: "Router",
      description: "Learn how routers direct network traffic.",
      category: "Network Devices",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 12,
      title: "Switch",
      description: "Understand layer 2 and layer 3 switches.",
      category: "Network Devices",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 13,
      title: "Hub & Access Point",
      description: "Learn about basic connectivity devices.",
      category: "Network Devices",
      position: "right",
      materials: [],
      completed: false,
    },
    {
      id: 14,
      title: "Firewall",
      description: "Understand network security devices.",
      category: "Network Devices",
      position: "center",
      materials: [],
      completed: false,
    },

    // Cabling and Connections
    {
      id: 15,
      title: "Straight-through Cable",
      description: "Learn T568A/B wiring standards.",
      category: "Cabling and Connections",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 16,
      title: "Crossover Cable",
      description: "Understand when to use crossover cables.",
      category: "Cabling and Connections",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 17,
      title: "Fiber Optics",
      description: "Explore fiber optic cable technology.",
      category: "Cabling and Connections",
      position: "right",
      materials: [],
      completed: false,
    },

    // Network Configuration
    {
      id: 18,
      title: "Assigning IP Address",
      description: "Configure static and dynamic IP addresses.",
      category: "Network Configuration",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 19,
      title: "Connecting Devices",
      description: "Build basic network connections visually.",
      category: "Network Configuration",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 20,
      title: "Basic Troubleshooting",
      description: "Diagnose common network issues.",
      category: "Network Configuration",
      position: "right",
      materials: [],
      completed: false,
    },

    // Protocols
    {
      id: 21,
      title: "HTTP / HTTPS",
      description: "Understand web communication protocols.",
      category: "Protocols",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 22,
      title: "FTP",
      description: "Learn File Transfer Protocol.",
      category: "Protocols",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 23,
      title: "TCP vs UDP",
      description: "Compare connection-oriented vs connectionless protocols.",
      category: "Protocols",
      position: "right",
      materials: [],
      completed: false,
    },
    {
      id: 24,
      title: "ICMP",
      description: "Understand ping and network diagnostics.",
      category: "Protocols",
      position: "center",
      materials: [],
      completed: false,
    },

    // Intermediate Topics
    {
      id: 25,
      title: "VLAN",
      description: "Learn Virtual Local Area Networks.",
      category: "Intermediate Topics",
      position: "left",
      materials: [],
      completed: false,
    },
    {
      id: 26,
      title: "Routing Basics",
      description: "Understand static and dynamic routing.",
      category: "Intermediate Topics",
      position: "center",
      materials: [],
      completed: false,
    },
    {
      id: 27,
      title: "NAT",
      description: "Learn Network Address Translation.",
      category: "Intermediate Topics",
      position: "right",
      materials: [],
      completed: false,
    },
    {
      id: 28,
      title: "Network Security Basics",
      description: "Understand fundamental security concepts.",
      category: "Intermediate Topics",
      position: "center",
      materials: [],
      completed: false,
    },
  ]);

  const isNodeUnlocked = (nodeId: number) => {
    if (nodeId === 1) return true;
    const previousNode = roadmapNodes.find((n) => n.id === nodeId - 1);
    return previousNode?.completed || false;
  };

  const handleNodeClick = (node: RoadmapNode) => {
    if (!isNodeUnlocked(node.id)) {
      toast.error("Complete previous topics to unlock this lesson");
      return;
    }
    navigate(`/topic/${node.id}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const completedCount = roadmapNodes.filter((n) => n.completed).length;
  const totalCount = roadmapNodes.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  const groupedNodes = roadmapNodes.reduce((acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, RoadmapNode[]>);

  const categories = Object.keys(groupedNodes);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Progress Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-bold text-gray-900">Networking Roadmap</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={progressPercentage} className="h-2.5" />
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {completedCount}/{totalCount} Complete
            </span>
            <span className="text-lg font-bold text-blue-600">{progressPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Roadmap Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="relative">
          {/* Vertical Center Line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-gray-200" />

          {/* Categories and Nodes */}
          <div className="space-y-16">
            {categories.map((category) => (
              <div key={category} className="relative">
                {/* Category Header */}
                <div className="flex justify-center mb-8">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg z-10 relative">
                    <h2 className="text-sm font-bold uppercase tracking-wide">{category}</h2>
                  </div>
                </div>

                {/* Nodes */}
                <div className="space-y-6">
                  {groupedNodes[category].map((node) => {
                    const isUnlocked = isNodeUnlocked(node.id);
                    const isCompleted = node.completed;

                    return (
                      <div
                        key={node.id}
                        className={`relative flex ${
                          node.position === "center"
                            ? "justify-center"
                            : node.position === "left"
                            ? "justify-start pr-[55%]"
                            : "justify-end pl-[55%]"
                        }`}
                      >
                        {/* Connecting Line to Center */}
                        {node.position !== "center" && (
                          <svg
                            className="absolute top-1/2 transform -translate-y-1/2"
                            style={{
                              left: node.position === "left" ? "calc(100% - 8%)" : "47%",
                              width: node.position === "left" ? "calc(50% - 42%)" : "calc(53% - 47%)",
                              height: "2px",
                            }}
                          >
                            <line
                              x1="0"
                              y1="1"
                              x2="100%"
                              y2="1"
                              stroke={isCompleted ? "#22c55e" : isUnlocked ? "#3b82f6" : "#d1d5db"}
                              strokeWidth="2"
                            />
                          </svg>
                        )}

                        {/* Node Card */}
                        <div
                          onClick={() => handleNodeClick(node)}
                          className={`relative bg-white rounded-xl shadow-md border-2 p-5 w-80 cursor-pointer transition-all ${
                            isCompleted
                              ? "border-green-500 hover:shadow-lg"
                              : isUnlocked
                              ? "border-blue-400 hover:border-blue-500 hover:shadow-lg"
                              : "border-gray-200 opacity-60 cursor-not-allowed"
                          }`}
                        >
                          {/* Status Icon */}
                          <div className="absolute -right-3 -top-3">
                            {isCompleted ? (
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              </div>
                            ) : isUnlocked ? (
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                <div className="w-3 h-3 bg-white rounded-full" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
                                <Lock className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-gray-900 mb-2 pr-6">{node.title}</h3>
                          <p className="text-sm text-gray-600 leading-relaxed">{node.description}</p>

                          {node.materials.length > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{node.materials.length} material(s) available</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
