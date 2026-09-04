'use client';

import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast !bg-surface !text-text !border-0 !rounded-2xl !shadow-float !font-sans !text-sm',
          title: '!font-medium',
          description: '!text-text-3',
          actionButton: '!bg-blue !text-white !rounded-full',
          cancelButton: '!bg-sky !text-text-2 !rounded-full',
          icon: 'group-data-[type=error]:!text-red group-data-[type=success]:!text-green group-data-[type=warning]:!text-orange group-data-[type=info]:!text-blue',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
