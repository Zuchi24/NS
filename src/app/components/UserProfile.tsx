import { useState } from "react";
import { useNavigate } from "react-router";
import {
  User,
  Mail,
  IdCard,
  Award,
  Calendar,
  ArrowLeft,
  Save,
  Edit2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Progress } from "./ui/progress";

export function UserProfile() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "John BJ",
    email: "john.doe@university.edu",
    studentId: "2023001",
    role: "Student",
    joinDate: "January 2023",
  });

  const achievements = [
    {
      title: "First Simulation",
      description: "Completed your first simulation",
      earned: true,
    },
    {
      title: "Cable Expert",
      description: "Mastered all cable wiring exercises",
      earned: true,
    },
    {
      title: "Network Builder",
      description: "Built 10 network topologies",
      earned: true,
    },
    {
      title: "Challenge Master",
      description: "Completed 5 challenges",
      earned: false,
    },
    {
      title: "Perfect Score",
      description: "Achieved 100% on any exercise",
      earned: false,
    },
    {
      title: "Networking Pro",
      description: "Completed all modules",
      earned: false,
    },
  ];

  const stats = [
    { label: "Completed Simulations", value: "12" },
    { label: "Total Score", value: "1,245" },
    { label: "Challenges Completed", value: "3" },
    { label: "Current Streak", value: "7 days" },
  ];

  const recentActivity = [
    { title: "Basic IP Configuration", date: "2 hours ago", score: 95 },
    { title: "Build Star Topology", date: "1 day ago", score: 88 },
    { title: "Cable Wiring Challenge", date: "2 days ago", score: 92 },
  ];

  const handleSave = () => {
    toast.success("Profile updated successfully");
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
            <Button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-gray-200">
              <CardHeader>
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="w-24 h-24 bg-blue-100">
                    <AvatarFallback className="text-3xl font-bold text-blue-600">
                      {profile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">
                      {profile.name}
                    </h2>
                    <Badge className="mt-2 bg-blue-100 text-blue-700">
                      {profile.role}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        value={profile.name}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Student ID</Label>
                      <Input
                        value={profile.studentId}
                        onChange={(e) =>
                          setProfile({ ...profile, studentId: e.target.value })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <IdCard className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        ID: {profile.studentId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        Joined {profile.joinDate}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Learning Progress */}
            

            {/* Achievements */}
            
            {/* Recent Activity */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Your latest completed exercises
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {activity.title}
                        </h4>
                        <p className="text-sm text-gray-500">{activity.date}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {activity.score}%
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
