import React, { useState } from 'react';

interface MemberAvatarProps {
  name: string;
  initials: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  initials,
  src,
  size = 'md',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'h-7 w-7 text-[11px]'
      : size === 'lg'
      ? 'h-12 w-12 text-sm'
      : 'h-8 w-8 text-xs';

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${dims} rounded-full object-cover border border-[#E2E8F0] shrink-0 bg-[#F1F5F9]`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-[#334155] font-semibold flex items-center justify-center shrink-0 select-none`}
      aria-label={name}
    >
      {initials}
    </div>
  );
};
