import { useState } from "react";
import { Settings, CheckCircle, XCircle, Lightbulb, RotateCcw, ArrowRight, Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { toast } from "sonner";

interface ConfigField {
  name: string;
  label: string;
  placeholder: string;
  correctValue: string;
  validation?: (value: string) => boolean;
}

interface Exercise {
  id: number;
  title: string;
  description: string;
  scenario: string;
  fields: ConfigField[];
  hint: string;
  explanation: string;
}

const exercises: Exercise[] = [
  {
    id: 1,
    title: "Configure a Static IP Address",
    description: "Set up a computer with a static IP in a Class C network",
    scenario: "You need to configure a workstation in the 192.168.1.0/24 network. The router is at 192.168.1.1 and you should use Google's DNS (8.8.8.8).",
    fields: [
      {
        name: "ipAddress",
        label: "IP Address",
        placeholder: "192.168.1.x",
        correctValue: "192.168.1.100",
        validation: (value) => {
          const pattern = /^192\.168\.1\.\d{1,3}$/;
          return pattern.test(value) && value !== "192.168.1.0" && value !== "192.168.1.255" && value !== "192.168.1.1";
        },
      },
      {
        name: "subnetMask",
        label: "Subnet Mask",
        placeholder: "255.255.255.x",
        correctValue: "255.255.255.0",
      },
      {
        name: "defaultGateway",
        label: "Default Gateway",
        placeholder: "192.168.1.x",
        correctValue: "192.168.1.1",
      },
      {
        name: "dnsServer",
        label: "DNS Server",
        placeholder: "8.8.8.x",
        correctValue: "8.8.8.8",
      },
    ],
    hint: "A /24 network uses 255.255.255.0 as the subnet mask. The gateway is typically the first usable IP (.1).",
    explanation: "In a /24 network (Class C), the subnet mask is 255.255.255.0. The default gateway is the router's IP (usually .1), and you can use any valid host IP between .2 and .254 for the computer.",
  },
  {
    id: 2,
    title: "Small Office Network Configuration",
    description: "Configure a device in a smaller subnet",
    scenario: "Your office uses a 192.168.10.0/25 network. The router is at 192.168.10.1. Configure a computer with an appropriate IP address.",
    fields: [
      {
        name: "ipAddress",
        label: "IP Address",
        placeholder: "192.168.10.x",
        correctValue: "192.168.10.50",
        validation: (value) => {
          const pattern = /^192\.168\.10\.\d{1,3}$/;
          const num = parseInt(value.split('.')[3]);
          return pattern.test(value) && num >= 2 && num <= 126;
        },
      },
      {
        name: "subnetMask",
        label: "Subnet Mask",
        placeholder: "255.255.255.x",
        correctValue: "255.255.255.128",
      },
      {
        name: "defaultGateway",
        label: "Default Gateway",
        placeholder: "192.168.10.x",
        correctValue: "192.168.10.1",
      },
    ],
    hint: "A /25 subnet divides the last octet in half. The subnet mask is 255.255.255.128, allowing IPs from .1 to .126.",
    explanation: "A /25 network has a subnet mask of 255.255.255.128, which provides 126 usable host addresses (.1 to .126, with .0 as network and .127 as broadcast).",
  },
  {
    id: 3,
    title: "DHCP vs Static Configuration",
    description: "Understand when to use DHCP or static IP",
    scenario: "You're configuring a file server that other computers need to access reliably. Should it use DHCP or static IP? Enter 'static' or 'dhcp'.",
    fields: [
      {
        name: "configType",
        label: "Configuration Type",
        placeholder: "static or dhcp",
        correctValue: "static",
      },
      {
        name: "reason",
        label: "Why? (servers/clients/printers)",
        placeholder: "Type one word",
        correctValue: "servers",
        validation: (value) => value.toLowerCase() === "servers" || value.toLowerCase() === "server",
      },
    ],
    hint: "Think about what happens if the IP address changes - would that be a problem for this device?",
    explanation: "Servers should use static IPs because other devices need to know their fixed address to connect. DHCP is better for client devices that don't need a consistent address.",
  },
  {
    id: 4,
    title: "Subnet Planning",
    description: "Calculate network and broadcast addresses",
    scenario: "Given the network 172.16.50.0/23, what is the broadcast address?",
    fields: [
      {
        name: "subnetMask",
        label: "Subnet Mask",
        placeholder: "255.255.x.0",
        correctValue: "255.255.254.0",
      },
      {
        name: "networkAddress",
        label: "Network Address",
        placeholder: "172.16.x.0",
        correctValue: "172.16.50.0",
      },
      {
        name: "broadcastAddress",
        label: "Broadcast Address",
        placeholder: "172.16.x.255",
        correctValue: "172.16.51.255",
      },
      {
        name: "usableHosts",
        label: "Number of Usable Hosts",
        placeholder: "Number only",
        correctValue: "510",
      },
    ],
    hint: "A /23 network spans two Class C networks. The broadcast address is the last IP in the range.",
    explanation: "A /23 network (255.255.254.0) provides 512 addresses (2^9), with 510 usable hosts. The network is 172.16.50.0 and broadcast is 172.16.51.255.",
  },
  {
    id: 5,
    title: "Private IP Ranges",
    description: "Identify valid private IP addresses",
    scenario: "Which of these is a valid private IP range for a home network? Enter the network address.",
    fields: [
      {
        name: "classA",
        label: "Class A Private Range (Start)",
        placeholder: "10.x.0.0",
        correctValue: "10.0.0.0",
      },
      {
        name: "classB",
        label: "Class B Private Range (Start)",
        placeholder: "172.x.0.0",
        correctValue: "172.16.0.0",
      },
      {
        name: "classC",
        label: "Class C Private Range (Start)",
        placeholder: "192.168.x.0",
        correctValue: "192.168.0.0",
      },
    ],
    hint: "The three private IP ranges are: 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16.",
    explanation: "RFC 1918 defines three private IP ranges: 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16. These are not routable on the internet.",
  },
  {
    id: 6,
    title: "DNS Configuration",
    description: "Configure primary and secondary DNS servers",
    scenario: "Set up DNS for internet access. Use Google's public DNS (8.8.8.8 and 8.8.4.4).",
    fields: [
      {
        name: "primaryDNS",
        label: "Primary DNS Server",
        placeholder: "8.8.8.x",
        correctValue: "8.8.8.8",
      },
      {
        name: "secondaryDNS",
        label: "Secondary DNS Server",
        placeholder: "8.8.4.x",
        correctValue: "8.8.4.4",
      },
      {
        name: "dnsPort",
        label: "DNS Port Number",
        placeholder: "Port number",
        correctValue: "53",
      },
    ],
    hint: "DNS translates domain names to IP addresses. It uses port 53 by default.",
    explanation: "DNS (Domain Name System) servers resolve domain names to IP addresses. Google's public DNS (8.8.8.8 and 8.8.4.4) are reliable options. DNS uses port 53.",
  },
];

export function NetworkConfigSimulation() {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [validatedFields, setValidatedFields] = useState<Record<string, boolean>>({});
  const [showHint, setShowHint] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const exercise = exercises[currentExercise];
  const progress = ((currentExercise + 1) / exercises.length) * 100;

  const handleInputChange = (fieldName: string, value: string) => {
    setFormValues({
      ...formValues,
      [fieldName]: value,
    });
    
    if (isChecked) {
      setIsChecked(false);
      setIsCorrect(false);
      setValidatedFields({});
    }
  };

  const checkConfiguration = () => {
    const validated: Record<string, boolean> = {};
    let allCorrect = true;

    exercise.fields.forEach(field => {
      const userValue = formValues[field.name]?.trim() || "";
      const isFieldCorrect = field.validation
        ? field.validation(userValue)
        : userValue.toLowerCase() === field.correctValue.toLowerCase();
      
      validated[field.name] = isFieldCorrect;
      if (!isFieldCorrect) allCorrect = false;
    });

    setValidatedFields(validated);
    setIsChecked(true);
    setIsCorrect(allCorrect);

    if (allCorrect) {
      toast.success("Perfect configuration!", {
        description: exercise.explanation,
      });
      setScore(prev => prev + 1);
    } else {
      toast.error("Configuration has errors", {
        description: "Check the highlighted fields and try again.",
      });
    }
  };

  const handleNext = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1);
      resetExercise();
    }
  };

  const resetExercise = () => {
    setFormValues({});
    setValidatedFields({});
    setShowHint(false);
    setIsChecked(false);
    setIsCorrect(false);
  };

  const handleReset = () => {
    setCurrentExercise(0);
    setScore(0);
    resetExercise();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            Network Configuration
          </h1>
          <p className="text-gray-600 mt-2">Learn to configure IP addresses and network settings</p>
        </div>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold">
                Exercise {currentExercise + 1} of {exercises.length}
              </span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="text-sm text-gray-600">
              Score: {score}/{exercises.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercise */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{exercise.title}</CardTitle>
              <CardDescription className="text-base">{exercise.description}</CardDescription>
            </div>
            <Badge variant="secondary">Exercise {exercise.id}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Wifi className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Scenario</h3>
                <p className="text-indigo-100">{exercise.scenario}</p>
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            {exercise.fields.map(field => {
              const value = formValues[field.name] || "";
              const isValidated = isChecked && field.name in validatedFields;
              const isFieldCorrect = validatedFields[field.name];

              return (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name} className="text-base">
                    {field.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={field.name}
                      value={value}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={`text-lg ${
                        isValidated
                          ? isFieldCorrect
                            ? "border-green-500 bg-green-50"
                            : "border-red-500 bg-red-50"
                          : ""
                      }`}
                    />
                    {isValidated && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isFieldCorrect ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {isValidated && !isFieldCorrect && (
                    <p className="text-sm text-red-600">
                      Correct answer: {field.correctValue}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hint */}
          {!isCorrect && (
            <Button
              variant="outline"
              onClick={() => setShowHint(!showHint)}
              className="w-full gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              {showHint ? "Hide Hint" : "Show Hint"}
            </Button>
          )}

          {showHint && !isCorrect && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{exercise.hint}</p>
              </div>
            </div>
          )}

          {/* Explanation */}
          {isChecked && isCorrect && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 mb-1">Excellent!</p>
                  <p className="text-sm text-green-800">{exercise.explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isCorrect ? (
            <Button
              onClick={checkConfiguration}
              className="w-full"
              size="lg"
              disabled={exercise.fields.some(f => !formValues[f.name]?.trim())}
            >
              Check Configuration
            </Button>
          ) : (
            <>
              {currentExercise < exercises.length - 1 ? (
                <Button onClick={handleNext} className="w-full gap-2" size="lg">
                  Next Exercise
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 text-center space-y-3">
                  <h3 className="text-2xl font-bold">All Exercises Complete! 🎉</h3>
                  <p className="text-indigo-100">
                    You scored {score} out of {exercises.length} ({Math.round((score / exercises.length) * 100)}%)
                  </p>
                  <Button onClick={handleReset} variant="secondary" className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Start Over
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reference Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Settings className="w-5 h-5" />
            Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold mb-1">Common Subnet Masks:</p>
              <ul className="space-y-1 text-xs">
                <li>• /24 = 255.255.255.0 (254 hosts)</li>
                <li>• /25 = 255.255.255.128 (126 hosts)</li>
                <li>• /23 = 255.255.254.0 (510 hosts)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Private IP Ranges:</p>
              <ul className="space-y-1 text-xs">
                <li>• 10.0.0.0/8</li>
                <li>• 172.16.0.0/12</li>
                <li>• 192.168.0.0/16</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
