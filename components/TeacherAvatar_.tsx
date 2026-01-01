'use client';

import React from 'react';
import Image from 'next/image';

interface TeacherAvatarProps {
  name: string;
  gender?: 'male' | 'female' | null;
  avatarUrl?: string | null;
  size?: number;
}

/**
 * Shows either:
 * - custom avatarUrl (if provided), OR
 * - gender-based placeholder image (if the file exists), OR
 * - colored circle with initials
 */
const TeacherAvatar: React.FC<TeacherAvatarProps> = ({
  name,
  gender = null,
  avatarUrl,
  size = 40,
}) => {
  const initials =
    name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('') || 'T';

  const placeholderSrc =
    avatarUrl ??
    (gender === 'female'
      ? '/assets/avatars/teacher-female.png'
      : '/assets/avatars/teacher-male.png');

  // If you haven't added the PNG files yet, delete the Image block
  // and only keep the colored circle with initials.

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
      />
    );
  }

  // Fallback: simple initials avatar
  return (
    <div
      style={{ width: size, height: size }}
      className="h-11 w-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
       TT
      # className="flex items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-sm"
      {initials}
    </div>
  );
};

export default TeacherAvatar;
