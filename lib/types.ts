// Core types for the OpenSource Discovery Hub

export interface Project {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  topics: string[];
  openIssueCount: number;
  goodFirstIssueCount: number;
  lastActivity: string;
  license: string | null;
  contributorFriendliness: "high" | "medium" | "low";
  matchScore?: number;
  /** Selected skills this project was matched against (drives graph edges). */
  matchedSkills?: string[];
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  url: string;
  labels: string[];
  state: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  isAssigned: boolean;
  difficulty: "good-first-issue" | "medium" | "complex";
  body: string;
}

export interface ProjectSummary {
  project: {
    id: string;
    name: string;
    purpose: string;
    techStack: string[];
    license: string;
    stars: number;
    forks: number;
    openIssues: number;
  };
  community: {
    contributors: number;
    maintainerResponseTime: string;
    prMergeTime: string;
    communityHealth: string;
    hasDiscord: boolean;
    hasDiscussions: boolean;
  };
  contribution: {
    hasContributingGuide: boolean;
    requiresCLA: boolean;
    hasCodeOfConduct: boolean;
    testingRequired: boolean;
    reviewProcess: string;
    goodFirstIssueCount: number;
  };
  recentActivity: {
    lastCommit: string;
    commitsThisMonth: number;
    prsThisMonth: number;
    releasesThisYear: number;
  };
}

export interface IssueExplanation {
  issue: {
    number: number;
    title: string;
    url: string;
  };
  explanation: {
    summary: string;
    background: string;
    technicalContext: string;
    suggestedApproach: string[];
    relevantFiles: string[];
    estimatedEffort: string;
    skillsNeeded: string[];
  };
}

export interface ContributionRequirements {
  projectId: string;
  requirements: {
    hasCLA: boolean;
    claUrl?: string;
    codeStyle: string;
    testingRequired: boolean;
    testFramework: string;
    branchNaming: string;
    commitFormat: string;
    prTemplate: boolean;
    reviewProcess: string;
    additionalNotes: string[];
  };
}

export interface TrackedContribution {
  id: string;
  projectId: string;
  issueId?: string;
  status: "interested" | "in-progress" | "pr-submitted" | "merged" | "abandoned";
  notes?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentorshipProject {
  id: string;
  name: string;
  program: string;
  year: number;
  url: string;
  technologies: string[];
  description: string;
  mentorCount: number;
  projectIdeas: number;
  acceptingApplications: boolean;
}

export interface SearchProjectsInput {
  technologies?: string[];
  domain?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  minStars?: number;
  maxStars?: number;
  hasGoodFirstIssues?: boolean;
  activelyMaintained?: boolean;
  limit?: number;
}

export interface MatchSkillsInput {
  skills: string[];
  interests?: string[];
  experienceLevel?: "beginner" | "intermediate" | "senior";
  timeCommitment?: "one-time" | "occasional" | "regular";
  preferredContributionType?: string[];
}

export interface FindIssuesInput {
  projectId: string;
  labels?: string[];
  difficulty?: "good-first-issue" | "medium" | "complex";
  skills?: string[];
  issueType?: "bug" | "feature" | "documentation" | "testing";
  excludeAssigned?: boolean;
  excludeStale?: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    suggestions?: string[];
    alternatives?: { id: string; name: string; matchReason: string }[];
  };
}
