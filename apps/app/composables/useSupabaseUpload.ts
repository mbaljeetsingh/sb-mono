import { ref, computed, onUnmounted } from 'vue';
import { useSupabaseClient } from '#imports';

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @param {string} size - Force specific size unit
 * @returns {string} Formatted size string
 */
export const formatBytes = (
  bytes: number,
  decimals = 2,
  size: string | undefined = undefined
) => {
  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  if (bytes === 0 || bytes === undefined) {
    return size !== undefined ? `0 ${size}` : '0 bytes';
  }

  const i =
    size !== undefined
      ? sizes.indexOf(size)
      : Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export interface FileWithPreview extends File {
  preview?: string;
  errors: { code: string; message: string }[];
}

export interface UseSupabaseUploadOptions {
  bucketName: string;
  path?: string;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  cacheControl?: number;
  upsert?: boolean;
}

/**
 * Vue composable for handling file uploads to Supabase storage
 * @param {UseSupabaseUploadOptions} options - Upload configuration
 */
export function useSupabaseUpload(options: UseSupabaseUploadOptions) {
  const supabase = useSupabaseClient();
  const {
    bucketName,
    path = '',
    allowedMimeTypes = [],
    maxFileSize = Number.POSITIVE_INFINITY,
    maxFiles = 1,
    cacheControl = 3600,
    upsert = false,
  } = options;

  // State
  const files = ref<FileWithPreview[]>([]);
  const loading = ref(false);
  const errors = ref<{ name: string; message: string }[]>([]);
  const successes = ref<string[]>([]);
  const isDragActive = ref(false);
  const isDragReject = ref(false);
  const inputRef = ref<HTMLInputElement | null>(null);

  // Computed
  const isSuccess = computed(() => {
    if (errors.value.length === 0 && successes.value.length === 0) {
      return false;
    }
    return (
      errors.value.length === 0 && successes.value.length === files.value.length
    );
  });

  /**
   * Check if a file type matches allowed MIME types
   */
  const isFileTypeAllowed = (file: { type: string }) => {
    if (allowedMimeTypes.length === 0) return true;

    return allowedMimeTypes.some((type) => {
      if (type.endsWith('/*')) {
        // Wildcard match (e.g., 'image/*')
        const prefix = type.slice(0, -2);
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });
  };

  /**
   * Validate a file and return any errors
   */
  const validateFile = (file: File) => {
    const fileErrors = [];

    if (!isFileTypeAllowed(file)) {
      fileErrors.push({
        code: 'file-invalid-type',
        message: `File type ${file.type} is not allowed`,
      });
    }

    if (file.size > maxFileSize) {
      fileErrors.push({
        code: 'file-too-large',
        message: `File is larger than ${formatBytes(maxFileSize, 2)}`,
      });
    }

    return fileErrors;
  };

  /**
   * Handle dropped or selected files
   */
  const onDrop = (acceptedFiles: File[], rejectedFiles: any[] = []) => {
    // Filter out duplicates
    const existingNames = new Set(files.value.map((f) => f.name));

    const validFiles = acceptedFiles
      .filter((file) => !existingNames.has(file.name))
      .map((file) => {
        const preview = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined;
        const fileErrors = validateFile(file);

        return Object.assign(file, { preview, errors: fileErrors });
      });

    const invalidFiles = rejectedFiles.map(({ file, errors: rejErrors }) => {
      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined;

      return Object.assign(file, { preview, errors: rejErrors || [] });
    });

    // Check for too-many-files error
    const newFiles = [...files.value, ...validFiles, ...invalidFiles];
    if (newFiles.length > maxFiles) {
      newFiles.forEach((file) => {
        if (!file.errors.some((e: any) => e.code === 'too-many-files')) {
          file.errors = [
            ...file.errors,
            {
              code: 'too-many-files',
              message: `Only ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`,
            },
          ];
        }
      });
    }

    files.value = newFiles;
  };

  /**
   * Set files directly
   */
  const setFiles = (newFiles: FileWithPreview[]) => {
    // Clean up old previews
    files.value.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });

    files.value = newFiles;

    // Re-validate too-many-files errors
    if (newFiles.length <= maxFiles) {
      files.value = newFiles.map((file) => {
        if (file.errors.some((e) => e.code === 'too-many-files')) {
          return Object.assign(file, {
            errors: file.errors.filter((e) => e.code !== 'too-many-files'),
          });
        }
        return file;
      });
    }

    // Clear errors if no files
    if (newFiles.length === 0) {
      errors.value = [];
    }
  };

  /**
   * Set upload errors
   */
  const setErrors = (newErrors: { name: string; message: string }[]) => {
    errors.value = newErrors;
  };

  /**
   * Upload all valid files to Supabase
   */
  const onUpload = async () => {
    loading.value = true;

    // Filter files with errors to retry, or upload new files
    const filesWithUploadErrors = errors.value.map((e) => e.name);
    const filesToUpload =
      filesWithUploadErrors.length > 0
        ? [
            ...files.value.filter((f) =>
              filesWithUploadErrors.includes(f.name)
            ),
            ...files.value.filter(
              (f) =>
                !successes.value.includes(f.name) &&
                !filesWithUploadErrors.includes(f.name)
            ),
          ]
        : files.value.filter((f) => f.errors.length === 0);

    const responses = await Promise.all(
      filesToUpload.map(async (file) => {
        const filePath = path ? `${path}/${file.name}` : file.name;

        const { error } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            cacheControl: cacheControl.toString(),
            upsert,
          });

        if (error) {
          return { name: file.name, message: error.message };
        }
        return { name: file.name, message: undefined };
      })
    );

    const responseErrors = responses
      .filter((r) => r.message !== undefined)
      .map((r) => ({ name: r.name, message: r.message! }));
    errors.value = responseErrors;

    const responseSuccesses = responses.filter((r) => r.message === undefined);
    const newSuccesses = Array.from(
      new Set([...successes.value, ...responseSuccesses.map((r) => r.name)])
    );
    successes.value = newSuccesses;

    loading.value = false;
  };

  /**
   * Get props for the root dropzone element
   */
  const getRootProps = (additionalProps = {}) => ({
    onDragenter: handleDragEnter,
    onDragleave: handleDragLeave,
    onDragover: handleDragOver,
    onDrop: handleDrop,
    onClick: openFilePicker,
    ...additionalProps,
  });

  /**
   * Get props for the hidden file input
   */
  const getInputProps = () => ({
    ref: inputRef,
    type: 'file',
    style: { display: 'none' },
    accept: allowedMimeTypes.join(','),
    multiple: maxFiles !== 1,
    onChange: handleInputChange,
  });

  // Event handlers
  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    isDragActive.value = true;

    // Check if dragged items are rejected
    const items = event.dataTransfer?.items;
    if (items && items.length > 0) {
      const hasInvalidType = Array.from(items).some(
        (item) =>
          item.kind === 'file' && !isFileTypeAllowed({ type: item.type })
      );
      isDragReject.value = hasInvalidType;
    }
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    isDragActive.value = false;
    isDragReject.value = false;
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    isDragActive.value = false;
    isDragReject.value = false;

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    onDrop(droppedFiles);
  };

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const selectedFiles = Array.from(target.files || []);
    onDrop(selectedFiles);
    // Reset input so same file can be selected again
    if (target) {
      target.value = '';
    }
  };

  const openFilePicker = () => {
    inputRef.value?.click();
  };

  // Cleanup preview URLs on unmount
  onUnmounted(() => {
    files.value.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
  });

  return {
    // State
    files,
    setFiles,
    loading,
    errors,
    setErrors,
    successes,
    isSuccess,
    isDragActive,
    isDragReject,
    inputRef,

    // Options (for child components)
    maxFileSize,
    maxFiles,
    allowedMimeTypes,

    // Methods
    onDrop,
    onUpload,
    getRootProps,
    getInputProps,
    openFilePicker,
  };
}
