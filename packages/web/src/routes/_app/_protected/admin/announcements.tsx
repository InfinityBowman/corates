import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  sendAnnouncementAction,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_BODY_MAX,
} from '@/server/functions/admin-announcements.functions';
import { showToast } from '@/lib/toast';
import { AdminPage, AdminPanel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export const Route = createFileRoute('/_app/_protected/admin/announcements')({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const trimmedHref = href.trim();
  const hrefValid = trimmedHref === '' || trimmedHref.startsWith('/');
  const canSend = title.trim().length > 0 && body.trim().length > 0 && hrefValid;

  async function handleSend() {
    setSending(true);
    try {
      const { sent } = await sendAnnouncementAction({
        data: { title: title.trim(), body: body.trim(), href: trimmedHref || null },
      });
      showToast.success('Announcement sent', `Delivered to ${sent} user${sent === 1 ? '' : 's'}.`);
      setTitle('');
      setBody('');
      setHref('');
      setConfirming(false);
    } catch (err) {
      showToast.error('Send failed', (err as Error).message || 'Could not send the announcement');
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminPage
      title='Announcements'
      description='Send an in-app notice to every user. It lands in each inbox immediately and cannot be recalled, so keep it short and link out for detail.'
    >
      <AdminPanel title='New announcement' padded className='max-w-2xl'>
        <form
          className='flex flex-col gap-4'
          onSubmit={e => {
            e.preventDefault();
            if (canSend) setConfirming(true);
          }}
        >
          <div>
            <Label htmlFor='announcement-title' className='mb-1'>
              Title
            </Label>
            <Input
              id='announcement-title'
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={ANNOUNCEMENT_TITLE_MAX}
              placeholder='New instrument: ROBINS-I V2'
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='announcement-body' className='mb-1'>
              Message
            </Label>
            <Textarea
              id='announcement-body'
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={ANNOUNCEMENT_BODY_MAX}
              rows={4}
              placeholder='One or two sentences. Shown under the title in the inbox.'
            />
            <p className='text-muted-foreground mt-1 text-xs tabular-nums'>
              {body.length}/{ANNOUNCEMENT_BODY_MAX}
            </p>
          </div>
          <div>
            <Label htmlFor='announcement-href' className='mb-1'>
              Link (optional)
            </Label>
            <Input
              id='announcement-href'
              value={href}
              onChange={e => setHref(e.target.value)}
              placeholder='/resources'
              autoComplete='off'
              aria-invalid={!hrefValid}
            />
            <p className='text-muted-foreground mt-1 text-xs'>
              {hrefValid ?
                'A path inside the app. Opening the notification navigates there.'
              : 'Must start with a slash.'}
            </p>
          </div>
          <div className='flex justify-end'>
            <Button type='submit' disabled={!canSend}>
              Send to all users
            </Button>
          </div>
        </form>
      </AdminPanel>

      <AlertDialog open={confirming} onOpenChange={open => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              Every user gets a notification titled &ldquo;{title.trim()}&rdquo;. This cannot be
              recalled once sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? 'Sending...' : 'Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
