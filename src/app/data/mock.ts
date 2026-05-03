export interface Student {
  id: string;
  name: string;
  studentId: string;
  email: string;
  status: 'Passed' | 'Needs Improvement' | 'Active';
  completionRate: number;
  completedActivities: number;
  ongoingActivities: number;
  year: string;
  section: string;
}

export interface Activity {
  id: string;
  name: string;
  score: number;
  timeSpent: string;
  status: 'Completed' | 'In Progress' | 'Not Started';
  progress: number;
}

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const SECTIONS = ['Section A', 'Section B', 'Section C', 'Section D', 'Section E', 'Section F', 'Section G'];

export const MOCK_STUDENTS: Record<string, Student[]> = {};

// Generate mock students for each year and section
YEARS.forEach(year => {
  SECTIONS.forEach(section => {
    const key = `${year}-${section}`;
    MOCK_STUDENTS[key] = [
      {
        id: `s1-${key}`,
        name: 'Keanne Labiano',
        studentId: '2024-00123',
        email: 'Keanne.Labiano@netsim.edu',
        status: 'Passed',
        completionRate: 25,
        completedActivities: 1,
        ongoingActivities: 1,
        year,
        section,
      },
      {
        id: `s2-${key}`,
        name: 'Jordan Smith',
        studentId: '2024-00456',
        email: 'jordan.smith@netsim.edu',
        status: 'Needs Improvement',
        completionRate: 45,
        completedActivities: 1,
        ongoingActivities: 1,
        year,
        section,
      },
      {
        id: `s3-${key}`,
        name: 'Casey Johnson',
        studentId: '2024-00789',
        email: 'casey.johnson@netsim.edu',
        status: 'Passed',
        completionRate: 92,
        completedActivities: 2,
        ongoingActivities: 0,
        year,
        section,
      },
      {
        id: `s4-${key}`,
        name: 'Morgan Lee',
        studentId: '2024-01011',
        email: 'morgan.lee@netsim.edu',
        status: 'Active',
        completionRate: 70,
        completedActivities: 1,
        ongoingActivities: 1,
        year,
        section,
      },
    ];
  });
});

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    name: 'Basic Router Configuration',
    score: 95,
    timeSpent: '45m',
    status: 'Completed',
    progress: 100,
  },
  {
    id: '2',
    name: 'VLAN Implementation',
    score: 88,
    timeSpent: '1h 20m',
    status: 'Completed',
    progress: 100,
  },
  {
    id: '3',
    name: 'Static Routing Lab',
    score: 0,
    timeSpent: '30m',
    status: 'In Progress',
    progress: 65,
  },
  {
    id: '4',
    name: 'DHCP Server Setup',
    score: 92,
    timeSpent: '55m',
    status: 'Completed',
    progress: 100,
  },
  {
    id: '5',
    name: 'Network Troubleshooting',
    score: 0,
    timeSpent: '0m',
    status: 'Not Started',
    progress: 0,
  },
];
