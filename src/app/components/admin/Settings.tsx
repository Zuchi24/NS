import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Save, Shield, Globe, Palette } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const navigate = useNavigate();
  const [platformName, setPlatformName] = useState('NetSim');
  const [platformEmail, setPlatformEmail] = useState('admin@netsim.com');
  const [maxStudents, setMaxStudents] = useState('200');
  const [enableRegistration, setEnableRegistration] = useState(true);
  const [enableChallenges, setEnableChallenges] = useState(true);
  const [enableRoadmap, setEnableRoadmap] = useState(true);

  const handleSaveSettings = () => {
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-gray-600">Configure and manage platform-wide settings</p>
      </div>

      {/* General Settings */}
      <Card className="border-gray-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">General Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="platformName" className="text-sm font-semibold text-gray-700">
              Platform Name
            </Label>
            <Input
              id="platformName"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label htmlFor="platformEmail" className="text-sm font-semibold text-gray-700">
              Admin Email
            </Label>
            <Input
              id="platformEmail"
              type="email"
              value={platformEmail}
              onChange={(e) => setPlatformEmail(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label htmlFor="maxStudents" className="text-sm font-semibold text-gray-700">
              Maximum Students
            </Label>
            <Input
              id="maxStudents"
              type="number"
              value={maxStudents}
              onChange={(e) => setMaxStudents(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Settings */}
      <Card className="border-gray-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Feature Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Enable Student Registration</div>
              <div className="text-sm text-gray-600">Allow new students to create accounts</div>
            </div>
            <Checkbox
              checked={enableRegistration}
              onCheckedChange={(checked) => setEnableRegistration(checked as boolean)}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Enable Challenges</div>
              <div className="text-sm text-gray-600">
                Allow students to access challenge-based learning
              </div>
            </div>
            <Checkbox
              checked={enableChallenges}
              onCheckedChange={(checked) => setEnableChallenges(checked as boolean)}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Enable Roadmap</div>
              <div className="text-sm text-gray-600">Allow students to access learning roadmap</div>
            </div>
            <Checkbox
              checked={enableRoadmap}
              onCheckedChange={(checked) => setEnableRoadmap(checked as boolean)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="border-gray-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Security Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Security settings including password policies, session management, and access controls
              can be configured here.
            </p>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700">Minimum Password Length</Label>
            <Input type="number" defaultValue="8" className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              Session Timeout (minutes)
            </Label>
            <Input type="number" defaultValue="60" className="mt-1 h-10" />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
          Cancel
        </Button>
        <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
