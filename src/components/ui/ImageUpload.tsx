'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface ImageUploadProps {
  value: File | null
  onChange: (file: File | null) => void
  preview?: string
}

export function ImageUpload({ value, onChange, preview: externalPreview }: ImageUploadProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value) {
      const objectUrl = URL.createObjectURL(value)
      setLocalPreview(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setLocalPreview(null)
    }
  }, [value])

  const currentPreview = localPreview || externalPreview

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.')
        return
      }
      onChange(file)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {currentPreview ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={currentPreview} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-teal-50 text-teal-700 rounded-xl font-medium hover:bg-teal-100 transition-colors w-full sm:w-auto justify-center"
                >
                  <Camera size={20} />
                  <span>Take Photo</span>
                </button>
                <div className="hidden sm:block text-slate-300">or</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center"
                >
                  <Upload size={20} />
                  <span>Upload Photo</span>
                </button>
              </div>
              <p className="text-center text-xs text-slate-500 mt-4">
                Max file size: 5MB. Supported formats: JPEG, PNG, WebP
              </p>
            </div>
            
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg, image/png, image/webp"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ImageUpload
