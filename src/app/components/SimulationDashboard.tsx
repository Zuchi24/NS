import { Link } from "react-router";
import { Cable, Network, Settings, Trophy, BookOpen, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

export function SimulationDashboard() {
  const modules = [
    {
      id: "cable-wiring",
      title: "Cable Wiring Identification",
      description: "Learn to identify different cable types and their proper wiring configurations",
      icon: Cable,
      color: "from-blue-500 to-blue-600",
      path: "/cable-wiring",
      progress: 0,
      exercises: 5,
    },
    {
      id: "device-connection",
      title: "Network Device Connection",
      description: "Practice connecting routers, switches, and computers in proper network topologies",
      icon: Network,
      color: "from-purple-500 to-purple-600",
      path: "/device-connection",
      progress: 0,
      exercises: 4,
    },
    {
      id: "network-config",
      title: "Network Configuration",
      description: "Configure IP addresses, subnet masks, and basic network settings",
      icon: Settings,
      color: "from-indigo-500 to-indigo-600",
      path: "/network-config",
      progress: 0,
      exercises: 6,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Welcome to NetSim Learn</h1>
            <p className="text-blue-100 text-lg">
              Master networking fundamentals through interactive simulations
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-300" />
            <div>
              <p className="text-sm text-blue-100">Total Progress</p>
              <p className="text-2xl font-bold">0%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Path */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Learning Modules</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <Link key={module.id} to={module.path}>
                <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-2 hover:border-blue-300">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-14 h-14 bg-gradient-to-br ${module.color} rounded-xl flex items-center justify-center shadow-lg`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full">
                        Module {index + 1}
                      </div>
                    </div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-semibold text-gray-900">{module.progress}%</span>
                      </div>
                      <Progress value={module.progress} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>{module.exercises} Exercises</span>
                      </div>
                      <span className="text-blue-600 font-semibold hover:underline">
                        Start Learning →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Tips */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <BookOpen className="w-5 h-5" />
            Learning Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-amber-900">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>Start with Cable Wiring to understand the physical layer of networking</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>Use hints when stuck - learning is about understanding, not memorization</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>Complete all exercises in order for the best learning experience</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
