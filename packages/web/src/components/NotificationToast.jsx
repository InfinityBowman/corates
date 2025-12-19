import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiBell, FiX } from 'solid-icons/fi';

/**
 * Toast notification component for displaying real-time notifications
 */
export default function NotificationToast(props) {
  const navigate = useNavigate();

  const getNotificationContent = notification => {
    if (notification.type === 'project-invite') {
      return {
        title: 'Added to Project',
        message: `You've been added to "${notification.projectName}" as ${notification.role}`,
        action: () => navigate(`/projects/${notification.projectId}`),
        actionLabel: 'Open Project',
      };
    }
    return {
      title: 'Notification',
      message: notification.message || 'You have a new notification',
      action: null,
      actionLabel: null,
    };
  };

  return (
    <div class='fixed right-4 bottom-4 z-50 max-w-sm space-y-2'>
      <For each={props.notifications}>
        {notification => {
          const content = getNotificationContent(notification);
          return (
            <div class='animate-slide-in rounded-lg border border-gray-200 bg-white p-4 shadow-lg'>
              <div class='flex items-start gap-3'>
                <div class='shrink-0'>
                  <div class='flex h-8 w-8 items-center justify-center rounded-full bg-blue-100'>
                    <FiBell class='h-4 w-4 text-blue-600' />
                  </div>
                </div>
                <div class='min-w-0 flex-1'>
                  <p class='text-sm font-medium text-gray-900'>{content.title}</p>
                  <p class='mt-1 text-sm text-gray-500'>{content.message}</p>
                  <Show when={content.action}>
                    <button
                      onClick={() => {
                        content.action();
                        props.onDismiss(notification.timestamp);
                      }}
                      class='mt-2 text-sm font-medium text-blue-600 hover:text-blue-700'
                    >
                      {content.actionLabel}
                    </button>
                  </Show>
                </div>
                <button
                  onClick={() => props.onDismiss(notification.timestamp)}
                  class='shrink-0 text-gray-400 hover:text-gray-600'
                >
                  <FiX class='h-4 w-4' />
                </button>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
