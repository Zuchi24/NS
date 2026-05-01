import { Link, useNavigate } from "react-router";
import {
  Map,
  ArrowLeft,
  Play,
  CheckCircle2,
  Clock,
  Cpu,
  Network,
  Cable,
  Shield,
  Wrench,
  Cloud,
  Layers,
  Router,
  Lock as LockIcon,
  Server,
  Wifi,
  Globe,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface Lesson {
  id: number;
  title: string;
  description: string;
  duration: string;
  status: "completed" | "in-progress" | "not-started";
  category: string;
  label: "Start Here" | "Recommended" | "Advanced" | "";
  icon: any;
  color: string;
}

export function RoadmapPage() {
  const navigate = useNavigate();

  const lessons: Lesson[] = [
    // Fundamentals of Networking
    {
      id: 1,
      title: "Computer Hardware Components",
      description: "Understand essential computer components including motherboard, CPU, RAM, and storage devices.",
      duration: "50 min",
      status: "completed",
      category: "fundamentals",
      label: "Start Here",
      icon: Cpu,
      color: "blue",
    },
    {
      id: 2,
      title: "Connection Types & Communication",
      description: "Explore various connection types including serial, parallel, USB, and network connections.",
      duration: "35 min",
      status: "completed",
      category: "fundamentals",
      label: "Start Here",
      icon: Cable,
      color: "blue",
    },
    {
      id: 3,
      title: "Basics of Computer Networking",
      description: "Master the fundamentals of computer networks and how they work in real-world applications.",
      duration: "45 min",
      status: "in-progress",
      category: "fundamentals",
      label: "Start Here",
      icon: Network,
      color: "blue",
    },
    {
      id: 4,
      title: "Network Models & Architecture",
      description: "Study OSI Model (7 Layers), TCP/IP Model, and understand data flow processes.",
      duration: "60 min",
      status: "not-started",
      category: "fundamentals",
      label: "Recommended",
      icon: Layers,
      color: "blue",
    },
    {
      id: 5,
      title: "Network Topologies",
      description: "Study star, bus, ring, mesh, and hybrid network topologies and their use cases.",
      duration: "35 min",
      status: "not-started",
      category: "fundamentals",
      label: "",
      icon: Activity,
      color: "blue",
    },

    // Network Devices & Communication
    {
      id: 6,
      title: "Network Communication Technologies",
      description: "Learn about Ethernet standards, fiber optics, wireless standards, and mobile networks.",
      duration: "55 min",
      status: "not-started",
      category: "devices",
      label: "Recommended",
      icon: Wifi,
      color: "purple",
    },
    {
      id: 7,
      title: "Network Devices (Basic)",
      description: "Explore routers, switches, hubs, repeaters, and other essential networking devices.",
      duration: "40 min",
      status: "not-started",
      category: "devices",
      label: "Recommended",
      icon: Router,
      color: "purple",
    },
    {
      id: 8,
      title: "Advanced Network Devices",
      description: "Understand firewalls, access points, modems, load balancers, and IDS/IPS systems.",
      duration: "45 min",
      status: "not-started",
      category: "devices",
      label: "Advanced",
      icon: Server,
      color: "purple",
    },
    {
      id: 9,
      title: "Operating Systems",
      description: "Learn about file systems, user roles, networking in OS, and remote access methods.",
      duration: "50 min",
      status: "not-started",
      category: "devices",
      label: "",
      icon: Cpu,
      color: "purple",
    },

    // IP Addressing & Subnetting
    {
      id: 10,
      title: "IP Addressing Basics",
      description: "Understand IPv4 addressing, address classes, and private vs public IPs.",
      duration: "60 min",
      status: "not-started",
      category: "ip-subnet",
      label: "Recommended",
      icon: Globe,
      color: "orange",
    },
    {
      id: 11,
      title: "Basics of Subnetting",
      description: "Master subnet masks, CIDR notation, and network segmentation fundamentals.",
      duration: "55 min",
      status: "not-started",
      category: "ip-subnet",
      label: "Recommended",
      icon: Network,
      color: "orange",
    },
    {
      id: 12,
      title: "IP Addressing & Routing",
      description: "Learn static vs dynamic IP, routing basics, routing tables, and NAT in detail.",
      duration: "65 min",
      status: "not-started",
      category: "ip-subnet",
      label: "Advanced",
      icon: Router,
      color: "orange",
    },

    // Network Security
    {
      id: 13,
      title: "Network Security Basics",
      description: "Explore firewalls, VPN, encryption, common attacks, and secure network practices.",
      duration: "70 min",
      status: "not-started",
      category: "security",
      label: "Recommended",
      icon: Shield,
      color: "red",
    },

    // Troubleshooting & Practical Skills
    {
      id: 14,
      title: "Network Troubleshooting",
      description: "Master troubleshooting tools and learn to diagnose connectivity issues effectively.",
      duration: "50 min",
      status: "not-started",
      category: "practical",
      label: "Recommended",
      icon: Wrench,
      color: "green",
    },
    {
      id: 15,
      title: "Practical Networking Skills",
      description: "Hands-on practice with LAN setup, router configuration, and cable crimping.",
      duration: "90 min",
      status: "not-started",
      category: "practical",
      label: "Advanced",
      icon: Wrench,
      color: "green",
    },

    // Emerging Technologies
    {
      id: 16,
      title: "Emerging Technologies",
      description: "Introduction to cloud networking, virtualization, SDN, and network automation.",
      duration: "60 min",
      status: "not-started",
      category: "emerging",
      label: "Advanced",
      icon: Cloud,
      color: "teal",
    },
  ];

  const categories = [
    { id: "fundamentals", name: "Fundamentals of Networking", color: "blue" },
    { id: "devices", name: "Network Devices & Communication", color: "purple" },
    { id: "ip-subnet", name: "IP Addressing & Subnetting", color: "orange" },
    { id: "security", name: "Network Security", color: "red" },
    { id: "practical", name: "Troubleshooting & Practical Skills", color: "green" },
    { id: "emerging", name: "Emerging Technologies", color: "teal" },
  ];

  const completedCount = lessons.filter((l) => l.status === "completed").length;
  const totalCount = lessons.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  const getColorClasses = (color: string, type: "bg" | "text" | "border" | "hover") => {
    const colorMap: any = {
      blue: { bg: "bg-blue-500", text: "text-blue-600", border: "border-blue-500", hover: "hover:border-blue-400" },
      purple: { bg: "bg-purple-500", text: "text-purple-600", border: "border-purple-500", hover: "hover:border-purple-400" },
      orange: { bg: "bg-orange-500", text: "text-orange-600", border: "border-orange-500", hover: "hover:border-orange-400" },
      red: { bg: "bg-red-500", text: "text-red-600", border: "border-red-500", hover: "hover:border-red-400" },
      green: { bg: "bg-green-500", text: "text-green-600", border: "border-green-500", hover: "hover:border-green-400" },
      teal: { bg: "bg-teal-500", text: "text-teal-600", border: "border-teal-500", hover: "hover:border-teal-400" },
    };
    return colorMap[color]?.[type] || "";
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case "Start Here":
        return "bg-green-100 text-green-700 border-green-300";
      case "Recommended":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "Advanced":
        return "bg-orange-100 text-orange-700 border-orange-300";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Roboto, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Map className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">
                  Networking Learning Roadmap
                </h1>
              </div>
              <p className="text-gray-600">
                Follow the recommended learning path or explore topics freely
              </p>
            </div>
          </div>

          {/* Progress Summary Bar */}
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Your Progress</h3>
                  <p className="text-sm text-gray-600">
                    {completedCount} of {totalCount} topics completed
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{progressPercentage}%</div>
                </div>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </CardContent>
          </Card>
        </div>

        {/* Categorized Lessons */}
        <div className="space-y-10">
          {categories.map((category) => {
            const categoryLessons = lessons.filter((l) => l.category === category.id);
            if (categoryLessons.length === 0) return null;

            return (
              <div key={category.id}>
                <h2 className={`text-xl font-bold mb-4 ${getColorClasses(category.color, "text")}`}>
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryLessons.map((lesson) => {
                    const Icon = lesson.icon;
                    const isCompleted = lesson.status === "completed";
                    const isInProgress = lesson.status === "in-progress";

                    return (
                      <Card
                        key={lesson.id}
                        className="border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer group"
                      >
                        <CardContent className="p-0">
                          {/* Top Image/Icon Section */}
                          <div className={`h-32 ${getColorClasses(lesson.color, "bg")} rounded-t-lg flex items-center justify-center relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                            <Icon className="w-16 h-16 text-white z-10" />
                          </div>

                          {/* Content */}
                          <div className="p-5">
                            {/* Title */}
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                              {lesson.title}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {lesson.description}
                            </p>

                            {/* Tags & Labels */}
                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                              {lesson.label && (
                                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getLabelColor(lesson.label)}`}>
                                  {lesson.label}
                                </span>
                              )}
                              {isCompleted && (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Completed
                                </span>
                              )}
                              {isInProgress && (
                                <span className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-100 px-2 py-1 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  In Progress
                                </span>
                              )}
                              {!isCompleted && !isInProgress && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                  Not Started
                                </span>
                              )}
                            </div>

                            {/* Duration & Button */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {lesson.duration}
                              </span>
                              <Link to={`/topic/${lesson.id}`}>
                                <Button
                                  size="sm"
                                  className={`h-9 ${getColorClasses(lesson.color, "bg")} hover:opacity-90 text-white`}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  {isCompleted ? "Review" : isInProgress ? "Continue" : "Start Learning"}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Info Card */}
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white shadow-sm mt-10">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Map className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Flexible Learning Experience
                </h3>
                <p className="text-sm text-gray-600">
                  All topics are accessible at any time. Follow the recommended path for structured learning,
                  or explore topics freely based on your interests and needs. Each lesson includes video resources
                  and hands-on practice opportunities.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
