import { toast } from 'sonner';

export const showToast = {
  success: (message: string) => {
    toast.success(message);
  },
  
  error: (message: string) => {
    toast.error(message);
  },
  
  warning: (message: string) => {
    toast.warning(message);
  },
  
  info: (message: string) => {
    toast.info(message);
  },
  
  loading: (message: string) => {
    return toast.loading(message);
  },
  
  promise: <T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    });
  },
  
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },
  
  // Custom confirm dialog replacement
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void) => {
    toast(message, {
      action: {
        label: 'Confirm',
        onClick: onConfirm,
      },
      cancel: {
        label: 'Cancel',
        onClick: onCancel || (() => {}),
      },
      duration: Infinity,
    });
  },
  
  // CAD-specific toast helpers
  operationSuccess: (operation: string, objectName?: string) => {
    const message = objectName 
      ? `${operation} completed successfully for ${objectName}`
      : `${operation} completed successfully`;
    toast.success(message);
  },
  
  operationError: (operation: string, error: string) => {
    toast.error(`${operation} failed: ${error}`);
  },
  
  operationLoading: (operation: string, objectName?: string) => {
    const message = objectName 
      ? `${operation} ${objectName}...`
      : `${operation}...`;
    return toast.loading(message);
  },
  
  exportSuccess: (format: string, filename?: string) => {
    const message = filename 
      ? `Exported ${filename} as ${format.toUpperCase()}`
      : `Export to ${format.toUpperCase()} completed`;
    toast.success(message);
  },
  
  importSuccess: (filename: string) => {
    toast.success(`Imported ${filename} successfully`);
  },
  
  engineStatus: (status: 'initializing' | 'ready' | 'fallback' | 'error', details?: string) => {
    switch (status) {
      case 'initializing':
        return toast.loading('Initializing CAD engine...');
      case 'ready':
        toast.success('CAD engine ready');
        break;
      case 'fallback':
        toast.warning(`CAD engine running in fallback mode${details ? `: ${details}` : ''}`);
        break;
      case 'error':
        toast.error(`CAD engine error${details ? `: ${details}` : ''}`);
        break;
    }
  },
}; 