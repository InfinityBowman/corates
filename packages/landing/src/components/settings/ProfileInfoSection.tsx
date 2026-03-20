/**
 * ProfileInfoSection - Avatar, name, email, and member since fields
 * Handles avatar upload with compression and optimistic updates
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { CameraIcon, CheckIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthStore, selectUser, selectUserAvatarUrl } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';
import { SimpleEditable } from '@/components/ui/editable';
import { API_BASE } from '@/config/api';
import { compressImageFile } from '@/lib/imageUtils.js';
import { syncProfileToProjects } from '@/lib/syncUtils';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const AVATAR_MAX_SIZE = 256;
const AVATAR_QUALITY = 0.85;

export function ProfileInfoSection() {
  const user = useAuthStore(selectUser);
  const cachedAvatarUrl = useAuthStore(selectUserAvatarUrl);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [optimisticImage, setOptimisticImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarUrl = optimisticImage || cachedAvatarUrl || user?.image || null;

  const firstName = useMemo(() => {
    if (user?.givenName) return user.givenName as string;
    const name = (user?.name as string) || '';
    return name.split(' ')[0] || '';
  }, [user?.givenName, user?.name]);

  const lastName = useMemo(() => {
    if (user?.familyName) return user.familyName as string;
    const name = (user?.name as string) || '';
    return name.split(' ').slice(1).join(' ') || '';
  }, [user?.familyName, user?.name]);

  const userInitials = useMemo(() => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return (firstName || user?.email || 'U').charAt(0).toUpperCase();
  }, [firstName, lastName, user?.email]);

  const formatDate = (dateString?: string | number | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleFirstNameChange = useCallback(
    async (newFirstName: string) => {
      const givenName = newFirstName?.trim() || '';
      if (givenName === firstName) return;

      const familyName = lastName;
      const fullName = [givenName, familyName].filter(Boolean).join(' ');
      try {
        await updateProfile({
          name: fullName,
          givenName: givenName || null,
          familyName: familyName || null,
        });
        syncProfileToProjects();
      } catch {
        showToast.error('Update Failed', 'Failed to update name. Please try again.');
      }
    },
    [firstName, lastName, updateProfile],
  );

  const handleLastNameChange = useCallback(
    async (newLastName: string) => {
      const familyName = newLastName?.trim() || '';
      if (familyName === lastName) return;

      const givenName = firstName;
      const fullName = [givenName, familyName].filter(Boolean).join(' ');
      try {
        await updateProfile({
          name: fullName,
          givenName: givenName || null,
          familyName: familyName || null,
        });
        syncProfileToProjects();
      } catch {
        showToast.error('Update Failed', 'Failed to update name. Please try again.');
      }
    },
    [firstName, lastName, updateProfile],
  );

  const handleImageSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast.error('Invalid File', 'Please select a JPEG, PNG, GIF, or WebP image.');
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
        syncProfileToProjects();
        setOptimisticImage(null);
        showToast.success('Photo Updated', 'Your profile photo has been updated.');
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
    <div className='flex flex-col gap-6'>
      {/* Avatar and Name Row */}
      <div className='flex items-center gap-6'>
        {/* Avatar */}
        <div className='group relative shrink-0'>
          {avatarUrl ?
            <img
              src={avatarUrl}
              alt={user?.name || 'Profile'}
              className='ring-background size-20 rounded-full object-cover shadow-md ring-2'
              referrerPolicy='no-referrer'
            />
          : <div className='from-primary to-primary/80 text-primary-foreground flex size-20 items-center justify-center rounded-full bg-gradient-to-br text-xl font-semibold shadow-md'>
              {userInitials}
            </div>
          }
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className='bg-foreground/60 absolute inset-0 flex cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 disabled:cursor-wait'
            title='Change profile photo'
          >
            {uploadingImage ?
              <div className='size-5 animate-spin rounded-full border-2 border-white border-t-transparent' />
            : <CameraIcon className='size-5 text-white' />}
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/jpeg,image/png,image/gif,image/webp'
            className='hidden'
            onChange={handleImageSelect}
          />
        </div>

        {/* Name Fields */}
        <div className='min-w-0 flex-1'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
                First Name
              </label>
              <SimpleEditable
                activationMode='click'
                value={firstName || 'Add first name'}
                onSubmit={handleFirstNameChange}
                showEditIcon
                placeholder='First name'
                className='text-foreground text-lg font-medium'
              />
            </div>
            <div>
              <label className='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
                Last Name
              </label>
              <SimpleEditable
                activationMode='click'
                value={lastName || 'Add last name'}
                onSubmit={handleLastNameChange}
                showEditIcon
                placeholder='Last name'
                className='text-foreground text-lg font-medium'
              />
            </div>
          </div>
          <div className='mt-3 flex items-center gap-2'>
            <p className='text-muted-foreground text-sm'>{user?.email as string}</p>
            {!!user?.emailVerified && (
              <Badge variant='success'>
                <CheckIcon className='size-3' />
                Verified
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Member Since */}
      <Separator />
      <div>
        <label className='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
          Member Since
        </label>
        <p className='text-foreground'>{formatDate(user?.createdAt as string | undefined)}</p>
      </div>
    </div>
  );
}
