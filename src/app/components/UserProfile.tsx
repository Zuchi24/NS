import { useState } from "react";
import { useNavigate } from "react-router";
import {
  User,
  IdCard,
  Calendar,
  Edit2,
  Save,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

export function UserProfile() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "Keanne Labiano",
    yearLevel: 2,
    sectionLetter: "A",
    role: "Student",
    email: "Keanne.Labiano@netsim.edu",
    studentId: "2024-00123",
    age: 20,
    gender: "Male",
    birthdate: "2004-05-15",
    joinDate: "January 2024",
  });

  // Computed section value
  const fullSection = `BSIT-${profile.yearLevel}${profile.sectionLetter.toUpperCase()}`;

  const handleQuickEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    toast.success("Profile updated successfully!");
    setIsEditing(false);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 space-y-8">
          {/* Back to Dashboard Button - Top Left */}
          <div className="mb-4">
            <Button 
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              ← Back to Dashboard
            </Button>
          </div>

          {/* Identity Section - Top Card */}
          <Card className="hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden mx-auto max-w-2xl">
            <CardHeader className="relative pb-4 pt-8">
              {/* Quick Edit Button - Top Right */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-6 right-6 h-10 w-10 p-0 shadow-lg hover:shadow-xl bg-white/90 hover:bg-white"
                onClick={handleQuickEdit}
              >
                <Edit2 className="h-5 w-5" />
              </Button>
              
              <div className="flex flex-col items-center space-y-6">
                <Avatar className="w-36 h-36 border-4 border-white shadow-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 ring-4 ring-white/50">
                  <AvatarFallback className="text-5xl font-black text-blue-600 bg-gradient-to-br from-blue-500/20">
                    {profile.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center space-y-3">
                  <CardTitle className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-slate-900 bg-clip-text text-transparent drop-shadow-lg">
                    {profile.name}
                  </CardTitle>
                  <div className="flex flex-wrap gap-3 items-center justify-center">
                    <div className="px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-800 rounded-2xl text-sm font-semibold shadow-sm ring-1 ring-indigo-200/50 backdrop-blur-sm">
                      {fullSection}
                    </div>
                  </div>
                  <Badge className="text-base px-6 py-2.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-800 border border-emerald-200/50 shadow-lg font-semibold tracking-wide">
                    {profile.role.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="flex justify-center">
            {/* Personal Information Card - Centered */}
            <Card className="border-0 bg-white shadow-md w-full max-w-2xl">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
                  <IdCard className="h-6 w-6 text-blue-600" />
                  Personal Information
                </CardTitle>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleQuickEdit}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!isEditing ? (
                  // Display Mode
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1">{profile.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Student ID</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1">{profile.studentId}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Age</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1">{profile.age} years</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{profile.gender}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Birth Date</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1">{profile.birthdate}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Join Date</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1">{profile.joinDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Section</Label>
                      <p className="text-sm font-medium text-gray-900 mt-1">{fullSection}</p>
                    </div>
                  </div>
                ) : (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email" className="text-xs font-semibold text-gray-600 block mb-1">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          className="h-9 border-gray-300"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="studentId" className="text-xs font-semibold text-gray-600 block mb-1">Student ID</Label>
                        <Input
                          id="studentId"
                          className="h-9 border-gray-300 uppercase tracking-wider"
                          value={profile.studentId}
                          onChange={(e) => setProfile({ ...profile, studentId: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="age" className="text-xs font-semibold text-gray-600 block mb-1">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          className="h-9 border-gray-300"
                          value={profile.age}
                          onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender" className="text-xs font-semibold text-gray-600 block mb-1">Gender</Label>
                        <Input
                          id="gender"
                          className="h-9 border-gray-300 capitalize"
                          value={profile.gender}
                          onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="birthdate" className="text-xs font-semibold text-gray-600 block mb-1">Birth Date</Label>
                        <Input
                          id="birthdate"
                          type="date"
                          className="h-9 border-gray-300"
                          value={profile.birthdate}
                          onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="joinDate" className="text-xs font-semibold text-gray-600 block mb-1">Join Date</Label>
                        <Input
                          id="joinDate"
                          className="h-9 border-gray-300"
                          value={profile.joinDate}
                          onChange={(e) => setProfile({ ...profile, joinDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="yearLevel" className="text-xs font-semibold text-gray-600 block mb-1">Year Level</Label>
                        <Input
                          id="yearLevel"
                          type="number"
                          className="h-9 border-gray-300"
                          value={profile.yearLevel}
                          onChange={(e) => setProfile({ ...profile, yearLevel: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="sectionLetter" className="text-xs font-semibold text-gray-600 block mb-1">Section Letter (A, B, C...)</Label>
                        <Input
                          id="sectionLetter"
                          maxLength="1"
                          className="h-9 border-gray-300 uppercase tracking-wider font-semibold"
                          value={profile.sectionLetter.toUpperCase()}
                          onChange={(e) => {
                            const letter = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                            if (letter.length <= 1) {
                              setProfile({ ...profile, sectionLetter: letter });
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleSave} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 h-10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
