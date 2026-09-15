'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { IssueCategory, Location, Department } from '@/types/database';
import { CATEGORY_CONFIG, IMPACT_FLAGS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Camera, Upload, X, MapPin, Check, AlertCircle,
  Zap, Droplets, Trash2, BookOpen, FlaskConical, Wifi, Armchair, ShieldAlert,
  Accessibility, MoreHorizontal, ChevronRight, CheckCircle2, Loader2,
  ShieldAlert as ShieldAlertIcon, Ban, BookX, Bug, MonitorX, Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';

const categoryIcons: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-6 h-6" />,
  Droplets: <Droplets className="w-6 h-6" />,
  Trash2: <Trash2 className="w-6 h-6" />,
  BookOpen: <BookOpen className="w-6 h-6" />,
  FlaskConical: <FlaskConical className="w-6 h-6" />,
  Wifi: <Wifi className="w-6 h-6" />,
  Armchair: <Armchair className="w-6 h-6" />,
  ShieldAlert: <ShieldAlert className="w-6 h-6" />,
  Accessibility: <Accessibility className="w-6 h-6" />,
  MoreHorizontal: <MoreHorizontal className="w-6 h-6" />,
};

const impactIcons: Record<string, React.ReactNode> = {
  ShieldAlert: <ShieldAlertIcon className="w-5 h-5" />,
  Ban: <Ban className="w-5 h-5" />,
  BookX: <BookX className="w-5 h-5" />,
  Bug: <Bug className="w-5 h-5" />,
  Droplets: <Droplets className="w-5 h-5" />,
  MonitorX: <MonitorX className="w-5 h-5" />,
  Wrench: <Wrench className="w-5 h-5" />,
};

const steps = ['Photo', 'Category', 'Location', 'Description', 'Impact', 'Review'];

export default function ReportIssuePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedIssue, setSubmittedIssue] = useState<{
    human_id: string; id: string; priority: string; department: string;
  } | null>(null);

  // Form state
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [childLocations, setChildLocations] = useState<Location[]>([]);
  const [description, setDescription] = useState('');
  const [selectedImpacts, setSelectedImpacts] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .is('parent_id', null)
        .eq('active', true)
        .order('name');
      if (data) setLocations(data as Location[]);
    };
    fetchLocations();
  }, []);

  // Fetch child locations when building selected
  useEffect(() => {
    if (!selectedBuilding) {
      setChildLocations([]);
      return;
    }
    const fetchChildren = async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('parent_id', selectedBuilding)
        .eq('active', true)
        .order('name');
      if (data) setChildLocations(data as Location[]);
    };
    fetchChildren();
  }, [selectedBuilding]);

  // Photo handling
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB');
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  };

  // Impact toggle
  const toggleImpact = (id: string) => {
    setSelectedImpacts(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Check for duplicates before submission
  const checkDuplicates = async () => {
    if (!category || !selectedLocation) return;
    const locationToCheck = selectedLocation || selectedBuilding;
    const { data } = await supabase.rpc('find_potential_duplicates', {
      p_category: category,
      p_location_id: locationToCheck,
      p_hours_window: 72,
    });
    if (data && data.length > 0) {
      setDuplicates(data);
      setShowDuplicateModal(true);
      return true;
    }
    return false;
  };

  // Confirm as duplicate
  const confirmDuplicate = async (issueId: string) => {
    if (!user) return;
    try {
      await supabase.from('issue_confirmations').insert({
        issue_id: issueId,
        user_id: user.id,
      });
      // Update confirmation count
      const { data: existing } = await supabase
        .from('issues')
        .select('confirmation_count')
        .eq('id', issueId)
        .single();
      if (existing) {
        await supabase
          .from('issues')
          .update({ confirmation_count: existing.confirmation_count + 1 })
          .eq('id', issueId);
      }
      toast.success('Thanks! Your confirmation was added.');
      setShowDuplicateModal(false);
      router.push(`/student/issues`);
    } catch (err) {
      toast.error('Could not confirm duplicate');
    }
  };

  // Generate title from description
  const generateTitle = (desc: string): string => {
    const words = desc.split(' ').slice(0, 8).join(' ');
    return words.length > 60 ? words.substring(0, 57) + '...' : words;
  };

  // Submit issue
  const submitIssue = async () => {
    if (!user || !profile || !category) return;
    setSubmitting(true);

    try {
      const locationId = selectedLocation || selectedBuilding;
      if (!locationId) throw new Error('Location required');

      const title = generateTitle(description);

      // Insert issue
      const { data: issue, error: issueError } = await supabase
        .from('issues')
        .insert({
          reporter_id: user.id,
          title,
          description,
          category,
          location_id: locationId,
          impact_flags: selectedImpacts,
          status: 'reported',
        })
        .select('*, department:departments(*)')
        .single();

      if (issueError) throw issueError;

      // Upload photo if exists
      if (photo && issue) {
        const fileExt = photo.name.split('.').pop();
        const filePath = `${issue.id}/report/photo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('issue-images')
          .upload(filePath, photo, {
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('issue-images')
            .getPublicUrl(filePath);

          await supabase.from('issue_images').insert({
            issue_id: issue.id,
            image_url: publicUrl.publicUrl,
            image_type: 'report',
            uploaded_by: user.id,
          });
        }
      }

      setSubmittedIssue({
        human_id: issue.human_id,
        id: issue.id,
        priority: issue.priority,
        department: issue.department?.name || 'Pending Assignment',
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Failed to submit issue');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true; // Photo is optional
      case 1: return !!category;
      case 2: return !!(selectedBuilding || selectedLocation);
      case 3: return description.trim().length >= 10;
      case 4: return selectedImpacts.length > 0;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step === 4) {
      // Check for duplicates before review
      const hasDuplicates = await checkDuplicates();
      if (hasDuplicates) return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      submitIssue();
    }
  };

  // Success screen
  if (submitted && submittedIssue) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </motion.div>
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Issue Reported!</h1>
        <p className="text-slate-500 mb-6">Your report has been submitted successfully.</p>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <span className="text-2xl font-bold font-mono text-teal-600">{submittedIssue.human_id}</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-medium text-navy-900">Reported</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Priority</span>
              <span className="font-medium capitalize text-navy-900">{submittedIssue.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Routed to</span>
              <span className="font-medium text-navy-900">{submittedIssue.department}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 w-full max-w-sm">
          <button
            onClick={() => router.push(`/student/issues/${submittedIssue.id}`)}
            className="flex-1 h-12 rounded-xl bg-navy-900 text-white font-semibold hover:bg-navy-800 transition-colors"
          >
            Track Issue
          </button>
          <button
            onClick={() => router.push('/student')}
            className="flex-1 h-12 rounded-xl border border-slate-200 text-navy-900 font-semibold hover:bg-slate-50 transition-colors"
          >
            Go Home
          </button>
        </div>
      </motion.div>
    );
  }

  const locationName = (() => {
    const building = locations.find(l => l.id === selectedBuilding);
    const child = childLocations.find(l => l.id === selectedLocation);
    if (child && building) return `${building.name} → ${child.name}`;
    if (building) return building.name;
    return 'Not selected';
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : router.back()}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-navy-900">Report an Issue</h1>
          <p className="text-xs text-slate-500">Step {step + 1} of {steps.length} — {steps[step]}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full flex-1 transition-all duration-300',
              i <= step ? 'bg-teal-500' : 'bg-slate-200'
            )}
          />
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="min-h-[50vh]"
        >
          {/* STEP 0: Photo */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900 mb-1">Add a photo</h2>
                <p className="text-sm text-slate-500">A photo helps authorities understand the issue quickly.</p>
              </div>

              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100">
                  <Image src={photoPreview} alt="Issue photo" fill className="object-cover" />
                  <button
                    onClick={removePhoto}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center">
                  <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm text-slate-500 mb-4">Take or upload a photo of the issue</p>
                  <div className="flex gap-3 justify-center">
                    <label className="cursor-pointer">
                      <div className="h-10 px-4 rounded-xl bg-navy-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-navy-800 transition-colors">
                        <Camera className="w-4 h-4" />
                        Take Photo
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    <label className="cursor-pointer">
                      <div className="h-10 px-4 rounded-xl border border-slate-200 text-navy-900 text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors">
                        <Upload className="w-4 h-4" />
                        Upload
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mt-3">Max 5MB · JPEG, PNG, WebP</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Category */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900 mb-1">What type of issue?</h2>
                <p className="text-sm text-slate-500">Select the category that best describes the problem.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(CATEGORY_CONFIG) as [IssueCategory, typeof CATEGORY_CONFIG[IssueCategory]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setCategory(key)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all',
                        category === key
                          ? 'border-teal-500 bg-teal-50 shadow-sm'
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      )}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          category === key ? 'bg-teal-100' : 'bg-slate-50'
                        )}
                        style={{ color: config.color }}
                      >
                        {categoryIcons[config.icon]}
                      </div>
                      <span className="text-xs font-medium text-navy-900">{config.label}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900 mb-1">Where is the issue?</h2>
                <p className="text-sm text-slate-500">Select the building or area, then the specific location.</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-navy-900">Building / Area</label>
                <div className="grid grid-cols-2 gap-2">
                  {locations.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedBuilding(loc.id);
                        setSelectedLocation(null);
                      }}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border transition-all text-left text-sm',
                        selectedBuilding === loc.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      )}
                    >
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-navy-900 truncate">{loc.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {childLocations.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-navy-900">Specific Location (Optional)</label>
                  <div className="space-y-2">
                    {childLocations.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => setSelectedLocation(loc.id === selectedLocation ? null : loc.id)}
                        className={cn(
                          'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left text-sm',
                          selectedLocation === loc.id
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        )}
                      >
                        <span className="font-medium text-navy-900">{loc.name}</span>
                        {selectedLocation === loc.id && <Check className="w-4 h-4 text-teal-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Description */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900 mb-1">What&apos;s wrong?</h2>
                <p className="text-sm text-slate-500">Describe the issue briefly. Be specific about what you see.</p>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Water has been leaking near the classroom entrance since this morning..."
                className="w-full h-40 p-4 rounded-2xl border border-slate-200 resize-none text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{description.length < 10 ? `${10 - description.length} more characters needed` : '✓ Good description'}</span>
                <span>{description.length}/500</span>
              </div>
            </div>
          )}

          {/* STEP 4: Impact */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900 mb-1">What&apos;s the impact?</h2>
                <p className="text-sm text-slate-500">Select all that apply. This helps us prioritize correctly.</p>
              </div>

              <div className="space-y-2">
                {IMPACT_FLAGS.map(flag => (
                  <button
                    key={flag.id}
                    onClick={() => toggleImpact(flag.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left',
                      selectedImpacts.includes(flag.id)
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      selectedImpacts.includes(flag.id) ? 'bg-teal-100 text-teal-600' : 'bg-slate-50 text-slate-400'
                    )}>
                      {impactIcons[flag.icon]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy-900">{flag.label}</p>
                      <p className="text-xs text-slate-500">{flag.description}</p>
                    </div>
                    {selectedImpacts.includes(flag.id) && (
                      <Check className="w-5 h-5 text-teal-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900 mb-1">Review your report</h2>
                <p className="text-sm text-slate-500">Make sure everything looks correct before submitting.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {photoPreview && (
                  <div className="relative aspect-video bg-slate-100">
                    <Image src={photoPreview} alt="Issue" fill className="object-cover" />
                  </div>
                )}

                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: category ? CATEGORY_CONFIG[category].color + '20' : undefined,
                        color: category ? CATEGORY_CONFIG[category].color : undefined,
                      }}
                    >
                      {category && categoryIcons[CATEGORY_CONFIG[category].icon]}
                    </div>
                    <span className="font-medium text-sm">{category ? CATEGORY_CONFIG[category].label : ''}</span>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-navy-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {locationName}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">Description</p>
                    <p className="text-sm text-navy-900">{description}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">Impact</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedImpacts.map(id => {
                        const flag = IMPACT_FLAGS.find(f => f.id === id);
                        return (
                          <span key={id} className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-medium">
                            {flag?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="sticky bottom-20 md:bottom-4 pt-4">
        <button
          onClick={handleNext}
          disabled={!canProceed() || submitting}
          className={cn(
            'w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg',
            canProceed() && !submitting
              ? 'bg-navy-900 text-white hover:bg-navy-800 active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : step === steps.length - 1 ? (
            <>
              Submit Report
              <Check className="w-5 h-5" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
        {step === 0 && !photo && (
          <button
            onClick={() => setStep(1)}
            className="w-full text-center text-sm text-slate-500 mt-3 hover:text-slate-700"
          >
            Skip photo for now
          </button>
        )}
      </div>

      {/* Duplicate Modal */}
      <AnimatePresence>
        {showDuplicateModal && duplicates.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center p-4 md:items-center"
            onClick={() => setShowDuplicateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900">Similar issue found</h3>
                  <p className="text-sm text-slate-500">This issue may have already been reported.</p>
                </div>
              </div>

              {duplicates.map((dup: any) => (
                <div key={dup.id} className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-teal-600">{dup.human_id}</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs capitalize text-slate-500">{dup.status?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm font-medium text-navy-900">{dup.title}</p>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => confirmDuplicate(dup.id)}
                      className="flex-1 h-9 rounded-xl bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
                    >
                      Yes, Same Issue
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setStep(5);
                }}
                className="w-full h-10 rounded-xl border border-slate-200 text-sm font-medium text-navy-900 hover:bg-slate-50 transition-colors"
              >
                Report as New Issue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
