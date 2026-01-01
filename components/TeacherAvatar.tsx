'use client';

import * as React from 'react';
import Image from 'next/image';

interface TeacherAvatarProps {
  name: string;
  gender?: 'male' | 'female' | null;
  avatarUrl?: string | null;
  size?: number;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? '').toUpperCase();
  const b = (parts[1]?.[0] ?? '').toUpperCase();
  return (a + b) || 'T';
}

export default function TeacherAvatar({ 
  name,
  gender = null,
  avatarUrl = null,
  size = 40,
}: TeacherAvatarProps) {
  const initials = initialsFromName(name || 'Teacher');

  // Optional local placeholders (only if you actually add these files)
  const placeholderSrc =
    gender === 'female'
      ? '/assets/avatars/teacher-female.png'
      : '/assets/avatars/teacher-male.png';

  // If you don't have local placeholder images, just keep initials fallback.
  const srcToUse = avatarUrl || null; // or: avatarUrl || placeholderSrc

  if (srcToUse) {
    return (
      <Image
        src={srcToUse}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-emerald-600 text-white font-bold shadow-sm shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${name} avatar`}
      title={name}
    >
      <span className="text-sm">{initials}</span>
    </div>
  );
}
