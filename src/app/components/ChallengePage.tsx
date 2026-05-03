import { Link, useNavigate } from "react-router";
import { useState } from "react";
import {
  Target,
  Trophy,
  Clock,
  Network,
  Cable,
  Wifi,
  CheckCircle,
  Lock,
  Play,
  ArrowLeft,
  Cpu,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

export function ChallengePage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const challenges = [
    {
      id: 1,
      title: "Assemble System Unit",
      description: "Learn computer hardware by assembling a complete system unit with all essential components",
      difficulty: "Beginner",
      icon: Cpu,
      iconColor: "bg-blue-500",
      timeEstimate: "15 min",
      score: null,
      progress: 0,
      status: "available",
      instructions: [
        "Drag components from the left panel to the system case",
        "Rotate components to match correct orientation",
        "Place each component in its proper slot",
      ],
    },
{
      id: 2,
      title: "Correct Cable Wiring",
      description: "Identify and select the correct cable wiring pattern for different network scenarios",
      difficulty: "Beginner",
      icon: Cable,
      iconColor: "bg-orange-500",
      timeEstimate: "15 min",
      score: null,
      progress: 0,
      status: "available",
      instructions: [
        "Review the cable wiring standards (T568A and T568B)",
        "Identify when to use straight vs crossover cables",
        "Complete the cable selection quiz",
      ],
    },
    // {
    //   id: 3,
    //   title: "Basic IP Configuration",
    //   description: "Configure IP addresses, subnet masks, and default gateways for a small network",
    //   difficulty: "Intermediate",
    //   icon: Wifi,
    //   iconColor: "bg-purple-500",
    //   timeEstimate: "20 min",
    //   score: null,
    //   progress: 45,
    //   status: "in-progress",
    //   instructions: [
    //     "Place 3 PCs and 1 switch on the canvas",
    //     "Assign IP addresses in the same subnet (192.168.1.0/24)",
    //     "Configure subnet masks and verify connectivity",
    //   ],
    // },
    // {
    //   id: 4,
    //   title: "Build Star Topology",
    //   description: "Create a star topology network with multiple devices connected to a central switch",
    //   difficulty: "Intermediate",
    //   icon: Network,
    //   iconColor: "bg-indigo-500",
    //   timeEstimate: "25 min",
    //   score: null,
    //   progress: 0,
    //   status: "available",
    //   instructions: [
    //     "Place 1 switch and 4 PCs on the canvas",
    //     "Create a star topology with the switch at the center",
    //     "Configure all devices with appropriate IP addresses",
    //   ],
    // },
    // {
    //   id: 5,
    //   title: "Router Configuration",
    //   description: "Configure a router to connect two different subnets and enable inter-network communication",
    //   difficulty: "Advanced",
    //   icon: Wifi,
    //   iconColor: "bg-orange-600",
    //   timeEstimate: "30 min",
    //   score: null,
    //   progress: 0,
    //   status: "locked",
    //   instructions: [
    //     "Place 1 router, 2 switches, and 4 PCs",
    //     "Create two separate subnets",
    //     "Configure router interfaces for both subnets",
    //   ],
    // },
    // {
    //   id: 6,
    //   title: "VLAN Configuration",
    //   description: "Set up VLANs on a switch to segment network traffic and improve security",
    //   difficulty: "Advanced",
    //   icon: Network,
    //   iconColor: "bg-purple-600",
    //   timeEstimate: "35 min",
    //   score: null,
    //   progress: 0,
    //   status: "locked",
    //   instructions: [
    //     "Place 1 managed switch and 6 PCs",
    //     "Create 3 VLANs for different departments",
    //     "Assign ports to VLANs",
    //   ],
    // },
  ];

const stats = [
    { label: "Completed", value: "0", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-50" },
    { label: "In Progress", value: "0", icon: Clock, color: "text-orange-600", bgColor: "bg-orange-50" },
    { label: "Total Activities", value: challenges.length.toString(), icon: Trophy, color: "text-blue-600", bgColor: "bg-blue-50" },
  ];

  const filters = ["All", "Beginner", "Intermediate", "Advanced"];

  const filteredChallenges = activeFilter === "All"
    ? challenges
    : challenges.filter(c => c.difficulty === activeFilter);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-50 text-green-700 border-green-200";
      case "Intermediate":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Advanced":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Roboto, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Challenge-Based Learning</h1>
          </div>
          <p className="text-gray-600">
            Test your skills with real-world scenarios and challenges
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="border border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === filter
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Challenges List */}
        <div className="space-y-4">
          {filteredChallenges.map((challenge) => {
            const Icon = challenge.icon;
            const isLocked = challenge.status === "locked";
            const isCompleted = challenge.status === "completed";
            const isInProgress = challenge.status === "in-progress";

            return (
              <Card
                key={challenge.id}
                className={`border border-gray-200 shadow-sm transition-all ${
                  isLocked
                    ? "opacity-60"
                    : "hover:shadow-md hover:border-blue-200"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Icon */}
                    <div className={`w-16 h-16 ${challenge.iconColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      {isLocked ? (
                        <Lock className="w-8 h-8 text-white" />
                      ) : (
                        <Icon className="w-8 h-8 text-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{challenge.title}</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(challenge.difficulty)}`}>
                            {challenge.difficulty}
                          </span>
                          {isCompleted && (
                            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {challenge.score}%
                            </div>
                          )}
                          {isInProgress && (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-4">{challenge.description}</p>

                      {/* Time Estimate */}
                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
                        <Clock className="w-4 h-4" />
                        <span>{challenge.timeEstimate}</span>
                      </div>

                      {/* Instructions */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Steps:</h4>
                        <ul className="space-y-1.5">
                          {challenge.instructions.map((instruction, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-blue-600 font-medium flex-shrink-0 w-4">{idx + 1}.</span>
                              <span>{instruction}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Progress Bar (for in-progress) */}
                      {isInProgress && challenge.progress > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{challenge.progress}%</span>
                          </div>
                          <Progress value={challenge.progress} className="h-2" />
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex">
                        {isLocked ? (
                          <Button disabled className="h-10 px-6 bg-gray-300 text-gray-500 cursor-not-allowed">
                            <Lock className="w-4 h-4 mr-2" />
                            Locked
                          </Button>
                        ) : isCompleted ? (
                          <Link to={
                            challenge.id === 1 ? "/challenge/computer-assembly" :
                            challenge.id === 2 ? "/challenge/cable-wiring" :
                            "/simulations"
                          }>
                            <Button variant="outline" className="h-10 px-6 border-blue-600 text-blue-600 hover:bg-blue-50">
                              <Play className="w-4 h-4 mr-2" />
                              Try Again
                            </Button>
                          </Link>
                        ) : (
                          <Link to={
                            challenge.id === 1 ? "/challenge/computer-assembly" :
                            challenge.id === 2 ? "/challenge/cable-wiring" :
                            "/simulations"
                          }>
                            <Button className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white">
                              <Play className="w-4 h-4 mr-2" />
                              {isInProgress ? "Continue Challenge" : "Start Challenge"}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Achievement Section */}
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy className="w-9 h-9 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Keep up the great work!</h3>
                <p className="text-sm text-gray-600">
                  Complete all challenges to earn the Network Master certificate
                </p>
              </div>
<div className="text-right">
                <div className="text-3xl font-bold text-blue-600">0%</div>
                <div className="text-xs text-gray-600">Complete</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
