/** Avatar, name, and academic affiliation, saved as one form. */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CameraIcon, CheckIcon, UserIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore, selectUser, selectUserAvatarUrl } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { API_BASE } from '@/config/api';
import { FILE_SIZE_LIMITS } from '@corates/workers/constants';
import { compressImageFile } from '@/lib/imageUtils.js';
import { ROLES, TITLE_OPTIONS } from '@/components/auth/RoleSelector';
import { SettingsSection, SettingsField } from './primitives';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_SIZE = 256;
const AVATAR_QUALITY = 0.85;
const AVATAR_LIMIT_MB = FILE_SIZE_LIMITS.AVATAR / (1024 * 1024);
const NONE = '_none';
const STANDARD_TITLES = TITLE_OPTIONS.filter(o => o.value && o.value !== 'other').map(o => o.value);

interface Draft {
  firstName: string;
  lastName: string;
  persona: string;
  titleSelection: string;
  customTitle: string;
  institution: string;
  department: string;
}

function draftFromUser(user: Record<string, unknown> | null): Draft {
  const name = (user?.name as string) || '';
  const title = (user?.title as string) || '';
  const isCustom = !!title && !STANDARD_TITLES.includes(title);

  return {
    firstName: (user?.givenName as string) || name.split(' ')[0] || '',
    lastName: (user?.familyName as string) || name.split(' ').slice(1).join(' ') || '',
    persona: (user?.persona as string) || '',
    titleSelection: isCustom ? 'other' : title || NONE,
    customTitle: isCustom ? title : '',
    institution: (user?.institution as string) || '',
    department: (user?.department as string) || '',
  };
}

function resolveTitle(draft: Draft) {
  if (draft.titleSelection === 'other') return draft.customTitle.trim();
  if (draft.titleSelection === NONE) return '';
  return draft.titleSelection;
}

function formatJoined(value?: string | number | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ProfileForm() {
  const user = useAuthStore(selectUser);
  const cachedAvatarUrl = useAuthStore(selectUserAvatarUrl);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const [draft, setDraft] = useState<Draft>(() => draftFromUser(user));
  const [baseline, setBaseline] = useState<Draft>(() => draftFromUser(user));
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [optimisticImage, setOptimisticImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id as string | undefined;
  useEffect(() => {
    const next = draftFromUser(user as Record<string, unknown> | null);
    setDraft(next);
    setBaseline(next);
    // Only reset when the signed-in account changes, not on every profile write.
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const avatarUrl = optimisticImage || cachedAvatarUrl || user?.image || null;
  const joined = formatJoined(user?.createdAt as string | undefined);
  const isDirty = (Object.keys(draft) as Array<keyof Draft>).some(k => draft[k] !== baseline[k]);

  const initials =
    draft.firstName && draft.lastName ?
      `${draft.firstName.charAt(0)}${draft.lastName.charAt(0)}`.toUpperCase()
    : (draft.firstName || (user?.email as string) || 'U').charAt(0).toUpperCase();

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value })),
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    const givenName = draft.firstName.trim();
    const familyName = draft.lastName.trim();
    try {
      await updateProfile({
        name: [givenName, familyName].filter(Boolean).join(' '),
        givenName: givenName || null,
        familyName: familyName || null,
        persona: draft.persona || null,
        title: resolveTitle(draft) || null,
        institution: draft.institution.trim() || null,
        department: draft.department.trim() || null,
      });
      setBaseline(draft);
      showToast.success('Profile updated', 'Your changes have been saved.');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Update Failed' });
    } finally {
      setSaving(false);
    }
  }, [draft, updateProfile]);

  const handleImageSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast.error('Invalid file', 'Choose a JPEG, PNG, or WebP image.');
        return;
      }

      setUploadingImage(true);
      let localUrl: string | null = null;

      try {
        const compressedFile = await compressImageFile(file, {
          maxSize: AVATAR_MAX_SIZE,
          quality: AVATAR_QUALITY,
        });

        localUrl = URL.createObjectURL(compressedFile);
        setOptimisticImage(localUrl);

        const formData = new FormData();
        formData.append('avatar', compressedFile);

        const response = await fetch(`${API_BASE}/api/users/avatar`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'Upload failed');
        }

        const { url } = await response.json();
        await updateProfile({ image: url });
        setOptimisticImage(null);
        showToast.success('Photo updated', 'Your profile photo has been updated.');
      } catch (err) {
        setOptimisticImage(null);
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Upload Failed' });
      } finally {
        setUploadingImage(false);
        if (localUrl) URL.revokeObjectURL(localUrl);
        if (event.target) event.target.value = '';
      }
    },
    [updateProfile],
  );

  return (
    <SettingsSection
      title='Personal information'
      description='Shown to collaborators on projects you share.'
      icon={UserIcon}
      footer={
        <>
          <p className='text-muted-foreground text-[13px]'>
            {joined ? `Member since ${joined}` : ''}
          </p>
          <div className='flex items-center gap-2'>
            {isDirty && (
              <Button variant='ghost' onClick={() => setDraft(baseline)} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSave} disabled={!isDirty || saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </>
      }
    >
      <div className='flex flex-wrap items-center gap-5 px-5 py-5'>
        <div className='group relative shrink-0'>
          <Avatar className='ring-background size-20 shadow-sm ring-2'>
            <AvatarImage
              src={avatarUrl || undefined}
              alt={(user?.name as string) || 'Profile'}
              referrerPolicy='no-referrer'
            />
            <AvatarFallback className='from-primary to-primary/75 text-primary-foreground bg-gradient-to-br text-xl font-semibold'>
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className='bg-foreground/55 focus-visible:ring-ring absolute inset-0 flex cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-100'
            aria-label='Change profile photo'
          >
            {uploadingImage ?
              <Spinner size='sm' variant='white' />
            : <CameraIcon className='size-5 text-white' />}
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={handleImageSelect}
          />
        </div>

        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='text-foreground truncate text-sm font-medium'>{user?.email as string}</p>
            {!!user?.emailVerified && (
              <Badge variant='success'>
                <CheckIcon className='size-3' />
                Verified
              </Badge>
            )}
          </div>
          <Button
            variant='outline'
            size='sm'
            className='mt-2'
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? 'Uploading...' : 'Change photo'}
          </Button>
          <p className='text-muted-foreground mt-2 text-xs'>
            JPEG, PNG, or WebP, up to {AVATAR_LIMIT_MB} MB.
          </p>
        </div>
      </div>

      <div className='grid gap-5 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3'>
        <SettingsField label='First name'>
          {id => (
            <Input
              id={id}
              value={draft.firstName}
              onChange={e => set('firstName', e.target.value)}
              placeholder='First name'
              maxLength={100}
            />
          )}
        </SettingsField>

        <SettingsField label='Last name'>
          {id => (
            <Input
              id={id}
              value={draft.lastName}
              onChange={e => set('lastName', e.target.value)}
              placeholder='Last name'
              maxLength={100}
            />
          )}
        </SettingsField>

        <SettingsField label='Persona' hint='How you use CoRATES.'>
          {id => (
            <Select value={draft.persona} onValueChange={v => set('persona', v)}>
              <SelectTrigger id={id} className='w-full'>
                <SelectValue placeholder='Select a persona' />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </SettingsField>

        <SettingsField label='Title'>
          {id => (
            <div className='flex gap-2'>
              <Select value={draft.titleSelection} onValueChange={v => set('titleSelection', v)}>
                <SelectTrigger id={id} className='w-full'>
                  <SelectValue placeholder='Select a title' />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map(option => (
                    <SelectItem key={option.value || NONE} value={option.value || NONE}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.titleSelection === 'other' && (
                <Input
                  value={draft.customTitle}
                  onChange={e => set('customTitle', e.target.value)}
                  placeholder='Your title'
                  maxLength={50}
                  aria-label='Custom title'
                />
              )}
            </div>
          )}
        </SettingsField>

        <SettingsField label='Institution'>
          {id => (
            <Input
              id={id}
              value={draft.institution}
              onChange={e => set('institution', e.target.value)}
              placeholder='University or organization'
              maxLength={200}
            />
          )}
        </SettingsField>

        <SettingsField label='Department'>
          {id => (
            <Input
              id={id}
              value={draft.department}
              onChange={e => set('department', e.target.value)}
              placeholder='Department or faculty'
              maxLength={200}
            />
          )}
        </SettingsField>
      </div>
    </SettingsSection>
  );
}
