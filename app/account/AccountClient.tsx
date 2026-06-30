'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ColorAvatar } from '@/components/ColorAvatar'
import { Camera } from 'lucide-react'

interface Props {
  userId: string
  displayName: string
  avatarUrl: string | null
}

// Compress and crop image to a square JPEG at target size
async function compressImage(file: File, size = 200, quality = 0.65): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!

      // Centre-crop to square
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)

      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function AccountClient({ userId, displayName, avatarUrl: initialAvatarUrl }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const compressed = await compressImage(file)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(userId, compressed, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(userId)
      // Bust cache with a timestamp so the browser fetches the new image
      const urlWithBust = `${data.publicUrl}?t=${Date.now()}`

      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
      setAvatarUrl(urlWithBust)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAvatar() {
    setUploading(true)
    setError('')
    try {
      await supabase.storage.from('avatars').remove([userId])
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
      setAvatarUrl(null)
    } catch (err: any) {
      setError(err.message ?? 'Failed to remove avatar')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 flex flex-col items-center gap-4">
        <div className="relative">
          <ColorAvatar name={displayName} avatarUrl={avatarUrl} size={80} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[var(--gold)] text-[var(--bg)] flex items-center justify-center shadow-lg transition-all duration-75 active:scale-90 disabled:opacity-50"
          >
            <Camera size={14} />
          </button>
        </div>

        <div className="text-center">
          <p className="font-medium text-[var(--text)]">{displayName}</p>
          {uploading && (
            <p className="text-xs text-[var(--muted)] mt-1">Uploading…</p>
          )}
          {error && (
            <p className="text-xs text-[var(--red)] mt-1">{error}</p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex gap-2 w-full">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] transition-all duration-75 active:scale-[0.98] active:opacity-80 disabled:opacity-40"
          >
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {avatarUrl && (
            <button
              onClick={removeAvatar}
              disabled={uploading}
              className="py-2 px-4 rounded-lg border border-[var(--red)]/40 text-sm text-[var(--red)] transition-all duration-75 active:scale-[0.98] active:opacity-80 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-[10px] text-[var(--muted)] text-center">
          Images are cropped to a square and compressed automatically.
        </p>
      </div>
    </div>
  )
}
