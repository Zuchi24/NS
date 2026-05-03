// Enhanced mock data for admin dashboard with year level information

export interface ChallengeData {
  id: string;
  title: string;
  yearLevel: number; // 1, 2, 3, 4
  completed: number;
  total: number;
  avgScore: number;
}

export interface RoadmapNode {
  id: string;
  title: string;
  description: string;
  category: string; // Maps to year levels
  completed: boolean;
  yearLevel: number;
}

export const challengeStats: ChallengeData[] = [
  // Year 1 Challenges
  { id: "ch1", title: "Assemble System Unit", yearLevel: 1, completed: 124, total: 156, avgScore: 86 },
  { id: "ch2", title: "Cable Wiring", yearLevel: 1, completed: 142, total: 156, avgScore: 88 },
  
  // Year 2 Challenges
  { id: "ch3", title: "IP Configuration", yearLevel: 2, completed: 98, total: 156, avgScore: 75 },
  { id: "ch4", title: "Star Topology", yearLevel: 2, completed: 67, total: 156, avgScore: 71 },
  
  // Year 3 Challenges
  { id: "ch5", title: "Router Configuration", yearLevel: 3, completed: 23, total: 156, avgScore: 68 },
  { id: "ch6", title: "VLAN Configuration", yearLevel: 3, completed: 12, total: 156, avgScore: 65 },
];

export const roadmapData: RoadmapNode[] = [
  // Year 1: Fundamentals
  { id: "r1", title: "Intro to Networks", description: "", category: "Fundamentals", completed: true, yearLevel: 1 },
  { id: "r2", title: "OSI Model", description: "", category: "Fundamentals", completed: true, yearLevel: 1 },
  { id: "r3", title: "Network Types", description: "", category: "Fundamentals", completed: true, yearLevel: 1 },
  { id: "r4", title: "Network Topology", description: "", category: "Fundamentals", completed: false, yearLevel: 1 },
  
  // Year 1-2: Basic Networking Concepts
  { id: "r5", title: "IP Addressing", description: "", category: "Basic Networking Concepts", completed: true, yearLevel: 1 },
  { id: "r6", title: "Subnetting", description: "", category: "Basic Networking Concepts", completed: true, yearLevel: 1 },
  { id: "r7", title: "DHCP", description: "", category: "Basic Networking Concepts", completed: false, yearLevel: 2 },
  { id: "r8", title: "DNS", description: "", category: "Basic Networking Concepts", completed: false, yearLevel: 2 },
  
  // Year 2: Network Devices & Cabling
  { id: "r9", title: "Hub & Switch", description: "", category: "Network Devices", completed: true, yearLevel: 2 },
  { id: "r10", title: "Router Basics", description: "", category: "Network Devices", completed: false, yearLevel: 2 },
  { id: "r11", title: "UTP Cabling", description: "", category: "Cabling and Connections", completed: true, yearLevel: 2 },
  { id: "r12", title: "Fiber Optics", description: "", category: "Cabling and Connections", completed: false, yearLevel: 2 },
  
  // Year 3: Network Configuration
  { id: "r13", title: "Static Routing", description: "", category: "Network Configuration", completed: true, yearLevel: 3 },
  { id: "r14", title: "Dynamic Routing", description: "", category: "Network Configuration", completed: false, yearLevel: 3 },
  { id: "r15", title: "VLAN Setup", description: "", category: "Network Configuration", completed: false, yearLevel: 3 },
  { id: "r16", title: "ACL Configuration", description: "", category: "Network Configuration", completed: false, yearLevel: 3 },
  
  // Year 3: Protocols
  { id: "r17", title: "TCP/IP", description: "", category: "Protocols", completed: true, yearLevel: 3 },
  { id: "r18", title: "UDP", description: "", category: "Protocols", completed: true, yearLevel: 3 },
  { id: "r19", title: "ARP", description: "", category: "Protocols", completed: false, yearLevel: 3 },
  { id: "r20", title: "ICMP", description: "", category: "Protocols", completed: false, yearLevel: 3 },
  
  // Year 4: Intermediate Topics
  { id: "r21", title: "QoS Configuration", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r22", title: "Network Security", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r23", title: "VPN Setup", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r24", title: "Load Balancing", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r25", title: "Cloud Networking", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r26", title: "Network Monitoring", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r27", title: "Troubleshooting", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
  { id: "r28", title: "Network Design", description: "", category: "Intermediate Topics", completed: false, yearLevel: 4 },
];

// Map categories to year levels
export const categoryToYearLevel: Record<string, number> = {
  "Fundamentals": 1,
  "Basic Networking Concepts": 1,
  "Network Devices": 2,
  "Cabling and Connections": 2,
  "Network Configuration": 3,
  "Protocols": 3,
  "Intermediate Topics": 4,
};

export const getYearLabel = (year: number): string => {
  const labels: Record<number, string> = {
    1: "Year 1",
    2: "Year 2",
    3: "Year 3",
    4: "Year 4",
  };
  return labels[year] || `Year ${year}`;
};

export const getPerformanceColor = (percentage: number): string => {
  if (percentage >= 80) return "#10b981"; // Green
  if (percentage >= 60) return "#f59e0b"; // Yellow
  return "#ef4444"; // Red
};
