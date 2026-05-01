import { useNavigate, useParams } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  ExternalLink,
  FileText,
  FileJson,
  Image,
  FileArchive,
  Presentation,
  Download,
  Upload,
  File,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

// Type definitions for learning materials
interface LearningMaterial {
  id: number;
  title: string;
  type: "pdf" | "ppt" | "doc" | "img" | "zip";
  uploadedBy: string;
  uploadDate: string;
  description?: string;
  fileUrl: string;
}

// Sample learning materials data (to be replaced with API/Firebase/Supabase data)
const learningMaterials: LearningMaterial[] = [
  {
    id: 1,
    title: "Networking Basics.pdf",
    type: "pdf",
    uploadedBy: "Instructor",
    uploadDate: "2024-01-15",
    description: "Comprehensive guide to networking fundamentals",
    fileUrl: "#",
  },
  {
    id: 2,
    title: "Network Topologies.ppt",
    type: "ppt",
    uploadedBy: "Admin",
    uploadDate: "2024-01-20",
    description: "Presentation on network topology types",
    fileUrl: "#",
  },
];

// Helper function to get icon based on file type
const getFileIcon = (type: LearningMaterial["type"]) => {
  switch (type) {
    case "pdf":
      return <FileText className="w-8 h-8 text-red-600" />;
    case "ppt":
      return <Presentation className="w-8 h-8 text-orange-600" />;
    case "doc":
      return <FileText className="w-8 h-8 text-blue-600" />;
    case "img":
      return <Image className="w-8 h-8 text-purple-600" />;
    case "zip":
      return <FileArchive className="w-8 h-8 text-yellow-600" />;
    default:
      return <File className="w-8 h-8 text-gray-600" />;
  }
};

// Helper function to get button text based on file type
const getButtonText = (type: LearningMaterial["type"]) => {
  switch (type) {
    case "pdf":
      return "Open PDF";
    case "ppt":
      return "Open Presentation";
    case "doc":
      return "Open Document";
    case "img":
      return "View Image";
    case "zip":
      return "Download ZIP";
    default:
      return "Open File";
  }
};

interface TopicData {
  id: number;
  title: string;
  overview: string;

  videoUrl?: string;
  youtubeId?: string;
}

// ============================================================
// ROLE-BASED ACCESS CONTROL
// ============================================================
// For this demo, we use a hardcoded role. In production, replace with:
// - Firebase Auth: firebase.auth().currentUser?.getIdTokenResult()
// - Supabase Auth: supabase.auth.getUser()
// - JWT/API: fetch user role from authentication context
// Example: const userRole = user?.role || "student";
const userRole = "student";

// ============================================================
// END ROLE-BASED ACCESS CONTROL
// ============================================================

export function TopicDetailsPage() {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const [isCompleted, setIsCompleted] = useState(false);

  // Topic data (in real app, this would come from API or context)
  const topicData: Record<string, TopicData> = {
    "1": {
      id: 1,
      title: "Introduction to Networking",
      overview:
        "Computer networking is the process of connecting computers and devices to share data, resources, and communication services such as the internet, emails, and file sharing. It includes different types of networks like LAN and WAN, as well as devices such as routers and switches that help data travel between systems. Understanding networking basics is important because it serves as the foundation of modern communication, cybersecurity, and many IT-related fields.",

      youtubeId: "R2mPvd2v4D0",
    },
    "2": {
      id: 2,
      title: "Types of Networks",
      overview:
        "Types of networks refer to the different categories of computer networks based on their size, coverage, and purpose. Common types include Local Area Network (LAN), which connects devices within a small area like a school or office, and Wide Area Network (WAN), which connects networks across large distances through the internet. Understanding these network types helps users identify how devices communicate and share resources in different environments.",
      youtubeId: "mwQcs4h2REw",
    },
    "3": {
      id: 3,
      title: "Network Topologies",
      overview:
        "Network topologies refer to the physical or logical layout of devices in a computer network. Common types include star, bus, ring, mesh, and hybrid topologies, each having different structures, advantages, and uses in communication systems. Understanding network topologies helps learners identify how devices are connected and how data travels within a network.",

      youtubeId: "uSKdjjw5zow",
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Topic Not Found
          </h2>
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

  // Handle file open/download
  const handleFileAction = (fileUrl: string) => {
    if (fileUrl && fileUrl !== "#") {
      window.open(fileUrl, "_blank");
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {currentTopic.title}
          </h1>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Section */}
            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  Overview
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {currentTopic.overview}
                </p>
              </CardContent>
            </Card>

            {/* Learning Materials Section */}
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Learning Materials
                </h2>

                <div className="space-y-3">
                  {/* Render file items if available */}
                  {learningMaterials.length > 0 ? (
                    learningMaterials.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                        onClick={() => handleFileAction(material.fileUrl)}
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(material.type)}
                          <div>
                            <p className="font-semibold text-gray-800">
                              {material.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {material.description ||
                                `Uploaded by ${material.uploadedBy} on ${material.uploadDate}`}
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileAction(material.fileUrl);
                          }}
                        >
                          {material.type === "zip" ? (
                            <Download className="w-4 h-4 mr-1" />
                          ) : (
                            <ExternalLink className="w-4 h-4 mr-1" />
                          )}
                          {getButtonText(material.type)}
                        </Button>
                      </div>
                    ))
                  ) : (
                    /* Empty State */
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mt-4">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">
                        No learning materials uploaded yet.
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Placeholder for Admin - ONLY visible to admin/instructor */}
                {userRole === "admin" && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mt-4 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer">
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-sm text-gray-500">
                      Click to upload learning materials
                    </p>
                    <p className="text-xs text-gray-400">
                      (PDF, PPT, DOC, ZIP supported)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Concepts Section */}

            {/* Examples Section */}
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
                          "_blank",
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
                        <p className="text-sm text-gray-500">
                          No video available yet
                        </p>
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
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Your Progress
                </h3>
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
                          <p className="font-semibold text-green-700">
                            Completed
                          </p>
                          <p className="text-xs text-green-600">Great job!</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                        <div>
                          <p className="font-semibold text-gray-700">
                            Not Completed
                          </p>
                          <p className="text-xs text-gray-500">
                            Mark when finished
                          </p>
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
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Navigation
                </h3>
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
