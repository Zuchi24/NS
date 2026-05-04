import { useMemo, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface RoadmapTopic {
  id: number;
  title: string;
  category: string;
}

interface UploadedMaterial {
  id: string;
  file: File;
  title?: string;
}

interface TopicUploads {
  topicId: number;
  files: UploadedMaterial[];
}

const roadmapTopics: RoadmapTopic[] = [
  { id: 1, title: "Introduction to Networking", category: "Start / Fundamentals" },
  { id: 2, title: "Types of Networks", category: "Start / Fundamentals" },
  { id: 3, title: "Network Topologies", category: "Start / Fundamentals" },
  { id: 4, title: "OSI Model", category: "Start / Fundamentals" },
  { id: 5, title: "TCP/IP Model", category: "Start / Fundamentals" },
  { id: 6, title: "IP Addressing", category: "Basic Networking Concepts" },
  { id: 7, title: "Subnetting", category: "Basic Networking Concepts" },
  { id: 8, title: "MAC Address", category: "Basic Networking Concepts" },
  { id: 9, title: "DNS", category: "Basic Networking Concepts" },
  { id: 10, title: "DHCP", category: "Basic Networking Concepts" },
  { id: 11, title: "Router", category: "Network Devices" },
  { id: 12, title: "Switch", category: "Network Devices" },
  { id: 13, title: "Hub & Access Point", category: "Network Devices" },
  { id: 14, title: "Firewall", category: "Network Devices" },
  { id: 15, title: "Straight-through Cable", category: "Cabling and Connections" },
  { id: 16, title: "Crossover Cable", category: "Cabling and Connections" },
  { id: 17, title: "Fiber Optics", category: "Cabling and Connections" },
  { id: 18, title: "Assigning IP Address", category: "Network Configuration" },
  { id: 19, title: "Connecting Devices", category: "Network Configuration" },
  { id: 20, title: "Basic Troubleshooting", category: "Network Configuration" },
  { id: 21, title: "HTTP / HTTPS", category: "Protocols" },
  { id: 22, title: "FTP", category: "Protocols" },
  { id: 23, title: "TCP vs UDP", category: "Protocols" },
  { id: 24, title: "ICMP", category: "Protocols" },
  { id: 25, title: "VLAN", category: "Intermediate Topics" },
  { id: 26, title: "Routing Basics", category: "Intermediate Topics" },
  { id: 27, title: "NAT", category: "Intermediate Topics" },
  { id: 28, title: "Network Security Basics", category: "Intermediate Topics" },
];

export function RoadmapAdminPage() {
  const [selectedTopicId, setSelectedTopicId] = useState(roadmapTopics[0].id);
  const [materialTitle, setMaterialTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [topicUploads, setTopicUploads] = useState<TopicUploads[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTopic = roadmapTopics.find((topic) => topic.id === selectedTopicId) || roadmapTopics[0];
  const uploadedMaterials =
    topicUploads.find((upload) => upload.topicId === selectedTopicId)?.files || [];

  const groupedTopics = useMemo(
    () =>
      roadmapTopics.reduce<Record<string, RoadmapTopic[]>>((groups, topic) => {
        if (!groups[topic.category]) {
          groups[topic.category] = [];
        }
        groups[topic.category].push(topic);
        return groups;
      }, {}),
    []
  );

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast.error("Choose a file before uploading");
      return;
    }

    const filesToUpload = selectedFiles.map((file) => ({
      id: `${selectedTopicId}-${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      title: materialTitle.trim() || undefined,
    }));

    setTopicUploads((currentUploads) => {
      const existingUpload = currentUploads.find(
        (upload) => upload.topicId === selectedTopicId
      );

      if (!existingUpload) {
        return [
          ...currentUploads,
          {
            topicId: selectedTopicId,
            files: filesToUpload,
          },
        ];
      }

      return currentUploads.map((upload) =>
        upload.topicId === selectedTopicId
          ? { ...upload, files: [...upload.files, ...filesToUpload] }
          : upload
      );
    });

    setMaterialTitle("");
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.success("Material uploaded");
  };

  const handleRemove = (materialId: string) => {
    setTopicUploads((currentUploads) =>
      currentUploads.map((upload) =>
        upload.topicId === selectedTopicId
          ? {
              ...upload,
              files: upload.files.filter((material) => material.id !== materialId),
            }
          : upload
      )
    );
    toast.success("Material removed");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Roadmap Topics</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Select a topic to manage its learning materials.
          </p>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
          <div className="space-y-6">
            {Object.entries(groupedTopics).map(([category, topics]) => (
              <section key={category} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {category}
                </h2>
                <div className="space-y-2">
                  {topics.map((topic) => {
                    const isSelected = topic.id === selectedTopicId;

                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {topic.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{topic.category}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Upload Materials</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              {selectedTopic.title}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Material Title
                </label>
                <Input
                  value={materialTitle}
                  onChange={(event) => setMaterialTitle(event.target.value)}
                  placeholder="Optional title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  File
                </label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*,video/*,*/*"
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files || []))
                  }
                />
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Selected file{selectedFiles.length > 1 ? "s" : ""}
                </p>
                <div className="space-y-1">
                  {selectedFiles.map((file) => (
                    <p key={`${file.name}-${file.lastModified}`} className="text-sm text-gray-700">
                      {file.name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleUpload} className="bg-blue-600 hover:bg-blue-700">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Materials</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Files added for {selectedTopic.title}
            </p>
          </CardHeader>
          <CardContent>
            {uploadedMaterials.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 py-10 text-center">
                <FileText className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-700">
                  No files uploaded yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploadedMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {material.title || material.file.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {material.file.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemove(material.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
