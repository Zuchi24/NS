import { useNavigate, useParams } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface TopicData {
  id: number;
  title: string;
  overview: string;
  keyConcepts: string[];
  examples: string[];
  videoUrl?: string;
  youtubeId?: string;
}

export function TopicDetailsPage() {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const [isCompleted, setIsCompleted] = useState(false);

  // Topic data (in real app, this would come from API or context)
  const topicData: Record<string, TopicData> = {
    "1": {
      id: 1,
      title: "Computer Hardware Components",
      overview:
        "Computer hardware components are the physical parts that make up a computer system. Understanding these components is essential for anyone working with networks, as they form the foundation of computing devices that connect to networks. This lesson covers the main hardware components including the motherboard, CPU, RAM, storage devices, and power supply.",
      keyConcepts: [
        "Motherboard: The main circuit board that connects all components",
        "CPU (Central Processing Unit): The brain of the computer that processes instructions",
        "RAM (Random Access Memory): Temporary storage for active programs and data",
        "Storage Devices: Hard drives (HDD) and solid-state drives (SSD) for permanent data storage",
        "Power Supply Unit (PSU): Converts electrical power to usable form for components",
        "GPU (Graphics Processing Unit): Handles graphics and video processing",
        "Cooling Systems: Fans and heatsinks that prevent overheating",
      ],
      examples: [
        "A typical desktop computer motherboard has slots for RAM, sockets for CPU, and connectors for storage devices",
        "Modern CPUs can have multiple cores (quad-core, octa-core) for parallel processing",
        "SSDs are faster than HDDs because they have no moving parts and use flash memory",
        "A gaming computer requires a powerful GPU for rendering high-quality graphics",
      ],
      youtubeId: "ExxFxD4OSZ0",
    },
    "2": {
      id: 2,
      title: "Connection Types & Communication",
      overview:
        "Understanding different types of connections is crucial for networking. This lesson explores various physical and wireless connection methods used in modern computing, including serial, parallel, USB, and network connections. Each connection type has specific use cases, advantages, and limitations.",
      keyConcepts: [
        "Serial Connection: Transmits data one bit at a time (RS-232, COM ports)",
        "Parallel Connection: Transmits multiple bits simultaneously (printer ports)",
        "USB (Universal Serial Bus): Modern standard for connecting peripherals",
        "Network Connections: Ethernet (wired) and Wi-Fi (wireless)",
        "Bluetooth: Short-range wireless technology for device pairing",
        "Data Transfer Rates: Measured in bits per second (bps) or bytes per second",
        "Hot-Swapping: Ability to connect/disconnect devices without restarting",
      ],
      examples: [
        "USB 3.0 can transfer data at up to 5 Gbps, much faster than USB 2.0's 480 Mbps",
        "Ethernet cables connect computers directly to network switches or routers",
        "Bluetooth is commonly used for wireless keyboards, mice, and headphones",
        "Thunderbolt connections support both data transfer and video output",
      ],
    },
    "3": {
      id: 3,
      title: "Basics of Computer Networking",
      overview:
        "Computer networking is the practice of connecting computers and devices to share resources and communicate. This foundational lesson introduces core networking concepts, terminology, and principles that apply to all types of networks, from small home networks to large enterprise systems.",
      keyConcepts: [
        "Network: A group of interconnected devices that can communicate",
        "Protocols: Rules and standards that govern network communication (TCP/IP, HTTP)",
        "Client-Server Model: Architecture where clients request services from servers",
        "Peer-to-Peer: Model where devices communicate directly without a central server",
        "Bandwidth: Maximum data transfer rate of a network connection",
        "Latency: Delay in data transmission across a network",
        "Packet: Small unit of data transmitted over a network",
      ],
      examples: [
        "A home network connects laptops, phones, and smart TVs to share internet access",
        "Email uses client-server model: email client requests messages from email server",
        "File sharing between two computers on same network demonstrates peer-to-peer",
        "Video streaming requires high bandwidth and low latency for smooth playback",
      ],
      youtubeId: "3QhU9jd03a0",
    },
  };

  const currentTopic = topicData[topicId || "1"];
  const currentId = parseInt(topicId || "1");
  const hasPrevious = currentId > 1;
  const hasNext = currentId < Object.keys(topicData).length;

  if (!currentTopic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Topic Not Found</h2>
          <Button onClick={() => navigate("/roadmap")}>Back to Roadmap</Button>
        </div>
      </div>
    );
  }

  const handlePrevious = () => {
    if (hasPrevious) navigate(`/topic/${currentId - 1}`);
  };

  const handleNext = () => {
    if (hasNext) navigate(`/topic/${currentId + 1}`);
  };

  const handleMarkCompleted = () => {
    setIsCompleted(!isCompleted);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Roboto, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/roadmap")}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roadmap
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentTopic.title}</h1>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Section */}
            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Overview</h2>
                <p className="text-gray-700 leading-relaxed">{currentTopic.overview}</p>
              </CardContent>
            </Card>

            {/* Key Concepts Section */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Key Concepts</h2>
                <ul className="space-y-3">
                  {currentTopic.keyConcepts.map((concept, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      </div>
                      <span className="text-gray-700">{concept}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Examples Section */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Examples</h2>
                <div className="space-y-3">
                  {currentTopic.examples.map((example, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-green-700">{index + 1}</span>
                      </div>
                      <p className="text-gray-700 text-sm">{example}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Video & Progress */}
          <div className="lg:col-span-1 space-y-6">
            {/* Video Learning Section */}
            <Card className="border-2 border-blue-300 shadow-sm bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  <Play className="w-5 h-5 inline mr-2 text-blue-600" />
                  Watch Tutorial
                </h3>

                {currentTopic.youtubeId ? (
                  <div className="space-y-3">
                    {/* YouTube Embed */}
                    <div className="relative w-full pb-[56.25%] bg-gray-900 rounded-lg overflow-hidden">
                      <iframe
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${currentTopic.youtubeId}`}
                        title={currentTopic.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                    <Button
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      onClick={() =>
                        window.open(
                          `https://www.youtube.com/watch?v=${currentTopic.youtubeId}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Watch on YouTube
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Placeholder */}
                    <div className="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Play className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No video available yet</p>
                      </div>
                    </div>
                    <Button className="w-full" disabled>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Watch on YouTube
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress Section */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Your Progress</h3>
                <div className="space-y-4">
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isCompleted ? "bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-700">Completed</p>
                          <p className="text-xs text-green-600">Great job!</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                        <div>
                          <p className="font-semibold text-gray-700">Not Completed</p>
                          <p className="text-xs text-gray-500">Mark when finished</p>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    onClick={handleMarkCompleted}
                    className={`w-full ${
                      isCompleted
                        ? "bg-gray-600 hover:bg-gray-700"
                        : "bg-green-600 hover:bg-green-700"
                    } text-white`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isCompleted ? "Mark as Incomplete" : "Mark as Completed"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Navigation</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handlePrevious}
                    disabled={!hasPrevious}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous Topic
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleNext}
                    disabled={!hasNext}
                  >
                    Next Topic
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
