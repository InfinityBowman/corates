import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';

/**
 * Toast notification component for displaying real-time notifications
 */
export default function NotificationToast(props) {
  const navigate = useNavigate();

  const getNotificationContent = notification => {
    switch (notification.type) {
      case 'project-invite':
        return {
          title: 'Added to Project',
          message: `You've been added to "${notification.projectName}" as ${notification.role}`,
          action: () => navigate(`/projects/${notification.projectId}`),
          actionLabel: 'Open Project',
        };
      default:
        return {
          title: 'Notification',
          message: notification.message || 'You have a new notification',
          action: null,
          actionLabel: null,
        };
    }
  };

  return (
    <div class='fixed bottom-4 right-4 z-50 space-y-2 max-w-sm'>
      <For each={props.notifications}>
        {notification => {
          const content = getNotificationContent(notification);
          return (
            <div class='bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-slide-in'>
              <div class='flex items-start gap-3'>
                <div class='shrink-0'>
                  <div class='w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center'>
                    <svg
                      class='w-4 h-4 text-blue-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        stroke-width='2'
                        d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                      />
                    </svg>
                  </div>
                </div>
                <div class='flex-1 min-w-0'>
                  <p class='text-sm font-medium text-gray-900'>{content.title}</p>
                  <p class='text-sm text-gray-500 mt-1'>{content.message}</p>
                  <Show when={content.action}>
                    <button
                      onClick={() => {
                        content.action();
                        props.onDismiss(notification.timestamp);
                      }}
                      class='text-sm text-blue-600 hover:text-blue-700 font-medium mt-2'
                    >
                      {content.actionLabel}
                    </button>
                  </Show>
                </div>
                <button
                  onClick={() => props.onDismiss(notification.timestamp)}
                  class='shrink-0 text-gray-400 hover:text-gray-600'
                >
                  <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
