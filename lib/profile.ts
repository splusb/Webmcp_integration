"use client";

/**
 * Shared client-side skill profile.
 *
 * Like the tracker (lib/tracker.ts), the app has no login/database, so
 * localStorage is the single source of truth for "who the user is": their
 * skills, interests, experience level, and contribution preferences. The
 * agent's set_skill_profile tool writes here; get_recommendations reads here;
 * and (optionally) the search page can show/edit it. This is what lets the app
 * "remember" the user across turns and refreshes.
 *
 * A "profile:updated" event is dispatched on writes so any open UI (e.g. a
 * profile chip on the search page) can re-render live.
 */

import type { TrackStatus } from "@/lib/tracker";

export const PROFILE_KEY = "skill_profile";
export const PROFILE_EVENT = "profile:updated";

export type ExperienceLevel = "beginner" | "intermediate" | "senior";
export type ContributionType =
  | "code"
  | "documentation"
  | "testing"
  | "design"
  | "translation";

export interface SkillProfile {
  /** Languages / frameworks the user knows (e.g. ["Rust", "TypeScript"]). */
  skills: string[];
  /** Domains / topics the user cares about (e.g. ["developer tools"]). */
  interests: string[];
  /** Overall experience level, or null when unspecified. */
  experienceLevel: ExperienceLevel | null;
  /** Preferred kinds of contribution, if stated. */
  preferredContributionType: ContributionType[];
  /** ISO timestamp of the last update, or null when never set. */
  updatedAt: string | null;
}

/** An empty profile — returned when nothing has been stored yet. */
export function emptyProfile(): SkillProfile {
  return {
    skills: [],
    interests: [],
    experienceLevel: null,
    preferredContributionType: [],
    updatedAt: null,
  };
}

/** Whether a profile carries any usable signal for recommendations. */
export function isProfileEmpty(p: SkillProfile): boolean {
  return p.skills.length === 0 && p.interests.length === 0;
}

export function readProfile(): SkillProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      experienceLevel: parsed.experienceLevel ?? null,
      preferredContributionType: Array.isArray(parsed.preferredContributionType)
        ? parsed.preferredContributionType
        : [],
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return emptyProfile();
  }
}

function writeProfile(profile: SkillProfile): SkillProfile {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT));
    } catch {
      /* ignore quota/serialization errors */
    }
  }
  return profile;
}

/** Case-insensitive de-duplicating union that preserves first-seen casing. */
function mergeUnique(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  for (const item of incoming) {
    const key = item.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

export interface ProfilePatch {
  skills?: string[];
  interests?: string[];
  experienceLevel?: ExperienceLevel | null;
  preferredContributionType?: ContributionType[];
}

/**
 * Edge case 1 — MERGE: updates append to (and de-duplicate) the existing
 * skills / interests / contribution types rather than replacing them, so
 * "also add Go" keeps prior skills. experienceLevel is a scalar, so a provided
 * value replaces the old one; omit it to leave it unchanged.
 */
export function updateProfile(patch: ProfilePatch): SkillProfile {
  const current = readProfile();
  const next: SkillProfile = {
    skills: patch.skills ? mergeUnique(current.skills, patch.skills) : current.skills,
    interests: patch.interests
      ? mergeUnique(current.interests, patch.interests)
      : current.interests,
    experienceLevel:
      patch.experienceLevel !== undefined
        ? patch.experienceLevel
        : current.experienceLevel,
    preferredContributionType: patch.preferredContributionType
      ? (mergeUnique(
          current.preferredContributionType,
          patch.preferredContributionType
        ) as ContributionType[])
      : current.preferredContributionType,
    updatedAt: new Date().toISOString(),
  };
  return writeProfile(next);
}

/** Reset the whole profile ("forget me" / "clear my skills"). */
export function clearProfile(): SkillProfile {
  return writeProfile(emptyProfile());
}

/** Case-insensitive removal of items from a list. */
function removeMatching(list: string[], remove: string[]): string[] {
  const drop = new Set(remove.map((r) => r.trim().toLowerCase()));
  return list.filter((item) => !drop.has(item.trim().toLowerCase()));
}

export interface ProfileRemoval {
  skills?: string[];
  interests?: string[];
  preferredContributionType?: ContributionType[];
}

/**
 * Remove specific skills / interests / contribution types from the profile,
 * leaving everything else intact. Matching is case-insensitive, so "drop Go"
 * removes "Go" regardless of casing. Returns the updated profile.
 */
export function removeFromProfile(removal: ProfileRemoval): SkillProfile {
  const current = readProfile();
  const next: SkillProfile = {
    skills: removal.skills ? removeMatching(current.skills, removal.skills) : current.skills,
    interests: removal.interests
      ? removeMatching(current.interests, removal.interests)
      : current.interests,
    experienceLevel: current.experienceLevel,
    preferredContributionType: removal.preferredContributionType
      ? (removeMatching(
          current.preferredContributionType,
          removal.preferredContributionType
        ) as ContributionType[])
      : current.preferredContributionType,
    updatedAt: new Date().toISOString(),
  };
  return writeProfile(next);
}
