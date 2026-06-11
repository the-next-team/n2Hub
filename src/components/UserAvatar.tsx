interface AvatarMeta {
  avatarUrl?:   string | null
  avatarEmoji?: string | null
  avatarBg?:    string | null
  initial?:     string
}

interface Props extends AvatarMeta {
  size?: number   // px
  className?: string
}

export function UserAvatar({ avatarUrl, avatarEmoji, avatarBg, initial = '?', size = 28, className = '' }: Props) {
  const fontSize = Math.round(size * 0.52)
  const style: React.CSSProperties = { width: size, height: size }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="avatar"
        style={style}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    )
  }

  if (avatarEmoji) {
    return (
      <span
        style={{ ...style, backgroundColor: avatarBg ?? '#4f46e5', fontSize }}
        className={`rounded-full flex items-center justify-center shrink-0 select-none ${className}`}
      >
        {avatarEmoji}
      </span>
    )
  }

  return (
    <span
      style={{ ...style, backgroundColor: avatarBg ?? '#4f46e5', fontSize }}
      className={`rounded-full flex items-center justify-center shrink-0 font-semibold text-white ${className}`}
    >
      {initial.toUpperCase()}
    </span>
  )
}
